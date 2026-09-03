import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  loadEnvironment,
  validateEnvironment,
} from '../src/database/environment'

describe('validateEnvironment', () => {
  it('accepts PostgreSQL and Redis URLs', () => {
    const result = validateEnvironment({
      DATABASE_URL:
        'postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable',
      DATABASE_TIMEZONE: 'UTC',
      REDIS_URL: 'redis://127.0.0.1:6380/1',
    })
    expect(result.error).toBeNull()
    expect(result.databaseTimezone).toBe('UTC')
    expect(result.redisUrl).toBe('redis://127.0.0.1:6380/1')
  })

  it('reports missing values and unsupported protocols', () => {
    expect(validateEnvironment({}).error).toContain('DATABASE_URL')
    expect(
      validateEnvironment({
        DATABASE_URL: 'http://localhost',
        REDIS_URL: 'http://localhost:6380/1',
      }).error,
    ).toContain('postgres')
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost/cmd_workspace',
        REDIS_URL: 'http://localhost:6380/1',
      }).error,
    ).toContain('redis')
  })

  it('uses packaged defaults and applies file then process overrides', () => {
    expect(loadEnvironment({}, []).databaseUrl).toContain('/cmd_workspace')
    const directory = mkdtempSync(path.join(tmpdir(), 'cmd-workspace-env-'))
    const executableConfig = path.join(directory, 'executable.env')
    const userConfig = path.join(directory, 'user.env')
    try {
      writeFileSync(
        executableConfig,
        'DATABASE_URL=postgresql://file:one@localhost/file_db\n',
      )
      writeFileSync(userConfig, 'REDIS_URL=redis://localhost:6390/2\n')
      const loaded = loadEnvironment(
        { DATABASE_URL: 'postgresql://process:one@localhost/process_db' },
        [executableConfig, userConfig],
      )
      expect(loaded.databaseUrl).toContain('/process_db')
      expect(loaded.redisUrl).toBe('redis://localhost:6390/2')
      expect(loaded.databaseTimezone).toBe('UTC')
      expect(loaded.error).toBeNull()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
