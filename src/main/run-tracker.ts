import type { PersistenceRepository } from '../database/repository'
import type { TerminalSnapshot, TerminalStatusEvent } from '../shared/terminal'

export class TerminalRunTracker {
  private readonly runIds = new Map<string, string>()
  private readonly profileIds = new Map<string, string>()

  constructor(
    private readonly repository: PersistenceRepository,
    private readonly applicationInstanceId: string,
  ) {}

  profileIdFor(terminalId: string): string | null {
    return this.profileIds.get(terminalId) ?? null
  }

  async recordStart(
    profileId: string,
    runtime: TerminalSnapshot,
  ): Promise<void> {
    const runId = await this.repository.startRun({
      profileId,
      applicationInstanceId: this.applicationInstanceId,
      diagnosticPid: runtime.pid,
    })
    this.profileIds.set(runtime.terminalId, profileId)
    this.runIds.set(runtime.terminalId, runId)
    if (runtime.status === 'failed') {
      await this.repository.finishRun(runId, {
        state: 'failed',
        errorSummary: runtime.message,
      })
      if (this.runIds.get(runtime.terminalId) === runId)
        this.runIds.delete(runtime.terminalId)
    }
  }

  async recordStatus(event: TerminalStatusEvent): Promise<void> {
    const runId = this.runIds.get(event.terminalId)
    if (!runId) return
    if (event.status === 'stopping')
      await this.repository.markRunStopping(runId)
    if (event.status === 'exited' || event.status === 'failed') {
      await this.repository.finishRun(runId, {
        state: event.status,
        exitCode: event.exitCode,
        errorSummary: event.message,
      })
      if (this.runIds.get(event.terminalId) === runId)
        this.runIds.delete(event.terminalId)
    }
  }

  forget(terminalId: string): void {
    this.profileIds.delete(terminalId)
    this.runIds.delete(terminalId)
  }
}
