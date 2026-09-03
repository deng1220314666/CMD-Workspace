import { describe, expect, it, vi } from 'vitest'
import type { PersistenceRepository } from '../src/database/repository'
import { TerminalRunTracker } from '../src/main/run-tracker'

describe('TerminalRunTracker', () => {
  it('records lifecycle summaries without receiving output events', async () => {
    const startRun = vi.fn().mockResolvedValue('run-1')
    const repository = {
      startRun,
      markRunStopping: vi.fn().mockResolvedValue(undefined),
      finishRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as PersistenceRepository
    const tracker = new TerminalRunTracker(
      repository,
      '00000000-0000-4000-8000-000000000001',
    )
    await tracker.recordStart('profile-1', {
      terminalId: 'terminal-1',
      cwd: 'C:\\work',
      status: 'running',
      pid: 123,
      output: 'must not reach PostgreSQL',
      lastSequence: 9,
    })
    await tracker.recordStatus({
      terminalId: 'terminal-1',
      status: 'stopping',
      pid: 123,
    })
    await tracker.recordStatus({
      terminalId: 'terminal-1',
      status: 'exited',
      pid: null,
      exitCode: 0,
    })

    expect(repository.startRun).toHaveBeenCalledWith({
      profileId: 'profile-1',
      applicationInstanceId: '00000000-0000-4000-8000-000000000001',
      diagnosticPid: 123,
    })
    expect(repository.markRunStopping).toHaveBeenCalledWith('run-1')
    expect(repository.finishRun).toHaveBeenCalledWith('run-1', {
      state: 'exited',
      exitCode: 0,
      errorSummary: undefined,
    })
    expect(JSON.stringify(startRun.mock.calls)).not.toContain(
      'must not reach PostgreSQL',
    )
  })
})
