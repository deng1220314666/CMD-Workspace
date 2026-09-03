import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

interface TerminalViewProps {
  terminalId: string
  onError: (message: string) => void
}

export function TerminalView({ terminalId, onError }: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: 'Cascadia Mono, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: {
        background: '#0b1118',
        foreground: '#d7e0e7',
        cursor: '#e7a93b',
        selectionBackground: '#31506b88',
        black: '#15212d',
        brightBlack: '#536675',
        red: '#ef6b73',
        green: '#7ec699',
        yellow: '#e7bb66',
        blue: '#72a7d8',
        magenta: '#b19cd9',
        cyan: '#63c5c8',
        white: '#d7e0e7',
      },
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(hostRef.current)

    let lastSequence = 0
    let snapshotLoaded = false
    const pendingEvents: Array<{ sequence: number; data: string }> = []
    const unsubscribe = window.cmdWorkspace.terminal.onData((event) => {
      if (event.terminalId !== terminalId) return
      if (!snapshotLoaded) {
        pendingEvents.push(event)
      } else if (event.sequence > lastSequence) {
        lastSequence = event.sequence
        terminal.write(event.data)
      }
    })
    void window.cmdWorkspace.terminal
      .snapshot({ terminalId })
      .then((snapshot) => {
        terminal.write(snapshot.output)
        lastSequence = snapshot.lastSequence
        snapshotLoaded = true
        for (const event of pendingEvents) {
          if (event.sequence > lastSequence) {
            lastSequence = event.sequence
            terminal.write(event.data)
          }
        }
        requestAnimationFrame(() => {
          fitAddon.fit()
          terminal.focus()
        })
      })
      .catch((error: unknown) =>
        onError(error instanceof Error ? error.message : String(error)),
      )
    const input = terminal.onData((data) => {
      void window.cmdWorkspace.terminal
        .write({ terminalId, data })
        .catch((error: unknown) =>
          onError(error instanceof Error ? error.message : String(error)),
        )
    })
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      void window.cmdWorkspace.terminal
        .resize({ terminalId, cols: terminal.cols, rows: terminal.rows })
        .catch(() => undefined)
    })
    observer.observe(hostRef.current)
    return () => {
      unsubscribe()
      input.dispose()
      observer.disconnect()
      terminal.dispose()
    }
  }, [onError, terminalId])

  return (
    <div
      className="terminal-host"
      ref={hostRef}
      aria-label="Interactive PowerShell terminal"
    />
  )
}
