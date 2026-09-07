import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CredentialService } from '../src/main/ai/credential-service'
import {
  errorCodeForStatus,
  normalizeProviderBaseUrl,
} from '../src/main/ai/provider-service'

const temporaryDirectories: string[] = []
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('AI provider security', () => {
  it('normalizes safe destinations and rejects embedded credentials', () => {
    expect(normalizeProviderBaseUrl('openai')).toBe('https://api.openai.com/v1')
    expect(
      normalizeProviderBaseUrl(
        'openai-compatible',
        'http://localhost:11434/v1/',
      ),
    ).toBe('http://localhost:11434/v1')
    expect(() =>
      normalizeProviderBaseUrl(
        'openai-compatible',
        'https://user:secret@example.com/v1',
      ),
    ).toThrow('username or password')
    expect(() =>
      normalizeProviderBaseUrl('openai-compatible', 'http://example.com/v1'),
    ).toThrow('HTTPS')
  })

  it('maps remote failures without returning provider bodies', () => {
    expect(errorCodeForStatus(401)).toBe('authentication')
    expect(errorCodeForStatus(403)).toBe('permission')
    expect(errorCodeForStatus(404)).toBe('model-not-found')
    expect(errorCodeForStatus(429)).toBe('rate-limited')
    expect(errorCodeForStatus(500)).toBe('invalid-response')
  })

  it('stores only encrypted credential bytes and never exposes read-back status', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'cmd-ai-credential-'),
    )
    temporaryDirectories.push(directory)
    const file = path.join(directory, 'credentials.json')
    const cipher = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
      decryptString: (value: Buffer) =>
        value.toString().replace(/^encrypted:/, ''),
    }
    const service = new CredentialService(file, cipher)
    const id = crypto.randomUUID()
    await service.set(id, 'FAKE_TEST_SECRET')
    expect(await service.status(id)).toBe('configured')
    const restartedService = new CredentialService(file, cipher)
    expect(await restartedService.resolve(id)).toBe('FAKE_TEST_SECRET')
    expect(await readFile(file, 'utf8')).not.toContain('FAKE_TEST_SECRET')
    await service.delete(id)
    expect(await service.status(id)).toBe('missing')
  })
})
