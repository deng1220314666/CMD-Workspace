import { randomUUID } from 'node:crypto'
import { stat, realpath } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { IPty } from 'node-pty'
import * as pty from 'node-pty'
import type {
  TerminalCreateRequest,
  TerminalDataEvent,
  TerminalSnapshot,
  TerminalShell,
  TerminalStatus,
  TerminalStatusEvent,
} from '../shared/terminal'
import { BoundedTerminalBuffer } from './bounded-buffer'

interface Runtime {
  id: string
  cwd: string
  shell: TerminalShell
  cols: number
  rows: number
  pty: IPty | null
  status: TerminalStatus
  pid: number | null
  sequence: number
  buffer: BoundedTerminalBuffer
  exitCode?: number
  message?: string
  exitWaiters: Array<() => void>
}

interface TerminalManagerOptions {
  onData: (event: TerminalDataEvent) => void
  onStatus: (event: TerminalStatusEvent) => void
  maxBufferBytes?: number
}

export class TerminalManager {
  private readonly runtimes = new Map<string, Runtime>()
  private readonly maxBufferBytes: number

  constructor(private readonly options: TerminalManagerOptions) {
    this.maxBufferBytes = options.maxBufferBytes ?? 1024 * 1024
  }

  async create(request: TerminalCreateRequest): Promise<TerminalSnapshot> {
    const cwd = await this.resolveDirectory(request.cwd)
    const runtime: Runtime = {
      id: randomUUID(),
      cwd,
      shell: request.shell ?? 'powershell',
      cols: request.cols,
      rows: request.rows,
      pty: null,
      status: 'starting',
      pid: null,
      sequence: 0,
      buffer: new BoundedTerminalBuffer(this.maxBufferBytes),
      exitWaiters: [],
    }
    this.runtimes.set(runtime.id, runtime)
    this.spawn(runtime)
    return this.snapshot(runtime.id)
  }

  list(): TerminalSnapshot[] {
    return [...this.runtimes.values()].map((runtime) =>
      this.toSnapshot(runtime),
    )
  }

  snapshot(terminalId: string): TerminalSnapshot {
    return this.toSnapshot(this.get(terminalId))
  }

  write(terminalId: string, data: string): void {
    const runtime = this.get(terminalId)
    if (
      !runtime.pty ||
      runtime.status === 'exited' ||
      runtime.status === 'failed'
    )
      throw new Error('Terminal is not running')
    runtime.pty.write(data)
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const runtime = this.get(terminalId)
    runtime.cols = cols
    runtime.rows = rows
    if (runtime.pty && ['starting', 'running'].includes(runtime.status))
      runtime.pty.resize(cols, rows)
  }

  stop(terminalId: string): void {
    const runtime = this.get(terminalId)
    if (!runtime.pty || !['starting', 'running'].includes(runtime.status))
      return
    this.setStatus(runtime, 'stopping')
    runtime.pty.write('\x03')
  }

  kill(terminalId: string): void {
    const runtime = this.get(terminalId)
    if (!runtime.pty) return
    runtime.pty.kill()
  }

  async restart(
    terminalId: string,
    expectedPid: number | null = null,
  ): Promise<TerminalSnapshot> {
    const runtime = this.get(terminalId)
    this.assertExpectedPid(runtime, expectedPid)
    if (runtime.pty) await this.terminate(runtime, 'force')
    runtime.buffer.clear()
    runtime.exitCode = undefined
    runtime.message = undefined
    this.setStatus(runtime, 'starting')
    this.spawn(runtime)
    return this.toSnapshot(runtime)
  }

  async close(
    terminalId: string,
    mode: 'graceful' | 'force',
    expectedPid: number | null = null,
  ): Promise<void> {
    const runtime = this.get(terminalId)
    this.assertExpectedPid(runtime, expectedPid)
    if (runtime.pty) await this.terminate(runtime, mode)
    this.runtimes.delete(terminalId)
  }

  dispose(): void {
    for (const runtime of this.runtimes.values()) runtime.pty?.kill()
    this.runtimes.clear()
  }

  private spawn(runtime: Runtime): void {
    try {
      const { executable, args } = this.shellCommand(runtime.shell)
      const child = pty.spawn(executable, args, {
        name: 'xterm-256color',
        cols: runtime.cols,
        rows: runtime.rows,
        cwd: runtime.cwd,
        env: this.stringEnvironment(),
        useConpty: process.platform === 'win32',
      })
      runtime.pty = child
      runtime.pid = child.pid
      this.setStatus(runtime, 'running')
      child.onData((data) => {
        runtime.sequence += 1
        runtime.buffer.append(data)
        this.options.onData({
          terminalId: runtime.id,
          sequence: runtime.sequence,
          data,
        })
      })
      child.onExit(({ exitCode }) => {
        runtime.pty = null
        runtime.pid = null
        runtime.exitCode = exitCode
        this.setStatus(runtime, exitCode === 0 ? 'exited' : 'failed', exitCode)
        for (const resolve of runtime.exitWaiters.splice(0)) resolve()
      })
    } catch (error) {
      runtime.pty = null
      runtime.pid = null
      runtime.message = error instanceof Error ? error.message : String(error)
      this.setStatus(runtime, 'failed', undefined, runtime.message)
    }
  }

  private setStatus(
    runtime: Runtime,
    status: TerminalStatus,
    exitCode?: number,
    message?: string,
  ): void {
    runtime.status = status
    this.options.onStatus({
      terminalId: runtime.id,
      status,
      pid: runtime.pid,
      exitCode,
      message,
    })
  }

  private async terminate(
    runtime: Runtime,
    mode: 'graceful' | 'force',
  ): Promise<void> {
    const child = runtime.pty
    if (!child) return
    const exited = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = runtime.exitWaiters.indexOf(onExit)
        if (index >= 0) runtime.exitWaiters.splice(index, 1)
        reject(
          new Error(
            mode === 'graceful'
              ? 'Terminal did not stop gracefully; confirm force close to terminate its process tree'
              : 'Terminal process tree did not exit after force close',
          ),
        )
      }, 5_000)
      const onExit = () => {
        clearTimeout(timeout)
        resolve()
      }
      runtime.exitWaiters.push(onExit)
    })
    if (mode === 'graceful') {
      this.setStatus(runtime, 'stopping')
      child.write('\x03')
      child.write('exit\r')
    } else {
      child.kill()
    }
    await exited
  }

  private get(terminalId: string): Runtime {
    const runtime = this.runtimes.get(terminalId)
    if (!runtime) throw new Error('Terminal does not exist')
    return runtime
  }

  private assertExpectedPid(
    runtime: Runtime,
    expectedPid: number | null,
  ): void {
    if (runtime.pid !== expectedPid)
      throw new Error(
        'Terminal PID changed; review the current process before trying again',
      )
  }

  private toSnapshot(runtime: Runtime): TerminalSnapshot {
    return {
      terminalId: runtime.id,
      status: runtime.status,
      pid: runtime.pid,
      cwd: runtime.cwd,
      shell: runtime.shell,
      output: runtime.buffer.toString(),
      lastSequence: runtime.sequence,
      exitCode: runtime.exitCode,
      message: runtime.message,
    }
  }

  private async resolveDirectory(input: string): Promise<string> {
    const resolved = path.resolve(input || os.homedir())
    const info = await stat(resolved).catch(() => null)
    if (!info?.isDirectory())
      throw new Error(`Working directory does not exist: ${resolved}`)
    return realpath(resolved)
  }

  private stringEnvironment(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }

  private shellCommand(shell: TerminalShell): {
    executable: string
    args: string[]
  } {
    if (process.platform !== 'win32')
      return {
        executable: process.env.SHELL ?? '/bin/bash',
        args: ['--noprofile'],
      }
    const system32 = path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
    )
    return shell === 'cmd'
      ? { executable: path.join(system32, 'cmd.exe'), args: ['/Q'] }
      : {
          executable: path.join(
            system32,
            'WindowsPowerShell',
            'v1.0',
            'powershell.exe',
          ),
          args: ['-NoLogo'],
        }
  }
}
