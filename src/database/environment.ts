import { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'

export const localEnvironmentDefaults = {
  DATABASE_URL:
    'postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable',
  DATABASE_TIMEZONE: 'UTC',
  REDIS_URL: 'redis://127.0.0.1:6380/1',
} as const

const environmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      {
        message: 'must use the postgres or postgresql protocol',
      },
    ),
  DATABASE_TIMEZONE: z.string().trim().min(1).default('UTC'),
  REDIS_URL: z
    .url()
    .refine(
      (value) => ['redis:', 'rediss:'].includes(new URL(value).protocol),
      {
        message: 'must use the redis or rediss protocol',
      },
    ),
})

export interface EnvironmentResult {
  databaseUrl?: string
  databaseTimezone?: string
  redisUrl?: string
  error: string | null
}

export function validateEnvironment(
  environment: NodeJS.ProcessEnv,
): EnvironmentResult {
  const result = environmentSchema.safeParse(environment)
  if (result.success) {
    return {
      databaseUrl: result.data.DATABASE_URL,
      databaseTimezone: result.data.DATABASE_TIMEZONE,
      redisUrl: result.data.REDIS_URL,
      error: null,
    }
  }
  return {
    error: `Environment configuration is invalid: ${result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  }
}

export function loadEnvironment(
  processEnvironment: NodeJS.ProcessEnv,
  configPaths: readonly string[],
): EnvironmentResult {
  const merged: NodeJS.ProcessEnv = { ...localEnvironmentDefaults }
  for (const configPath of [...new Set(configPaths)]) {
    if (!existsSync(configPath)) continue
    try {
      Object.assign(merged, parse(readFileSync(configPath)))
    } catch (error) {
      return {
        error: `Could not read environment configuration ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
  for (const [key, value] of Object.entries(processEnvironment))
    if (typeof value === 'string') merged[key] = value
  return validateEnvironment(merged)
}
