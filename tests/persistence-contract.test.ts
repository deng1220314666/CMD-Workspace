import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { assertAcyclicDependencies } from '../src/database/dependency-graph'
import { aiProviders, terminalRuns } from '../src/database/schema'

describe('persistence contract', () => {
  it('rejects self dependencies, unknown ownership, and cycles', () => {
    expect(() =>
      assertAcyclicDependencies(
        ['a'],
        [{ taskId: 'a', prerequisiteTaskId: 'a' }],
      ),
    ).toThrow('itself')
    expect(() =>
      assertAcyclicDependencies(
        ['a'],
        [{ taskId: 'a', prerequisiteTaskId: 'missing' }],
      ),
    ).toThrow('outside the project')
    expect(() =>
      assertAcyclicDependencies(
        ['a', 'b'],
        [
          { taskId: 'a', prerequisiteTaskId: 'b' },
          { taskId: 'b', prerequisiteTaskId: 'a' },
        ],
      ),
    ).toThrow('cycle')
  })

  it('keeps terminal output out of PostgreSQL run records', () => {
    expect(Object.keys(getTableColumns(terminalRuns))).not.toContain('output')
    expect(Object.keys(getTableColumns(terminalRuns))).not.toContain('buffer')
  })

  it('keeps AI credential material out of PostgreSQL', () => {
    const columns = Object.keys(getTableColumns(aiProviders))
    expect(columns).toContain('credentialId')
    expect(columns).not.toContain('apiKey')
    expect(columns).not.toContain('secret')
    expect(columns).not.toContain('ciphertext')
  })
})
