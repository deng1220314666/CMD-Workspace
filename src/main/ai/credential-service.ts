import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import type { AICredentialStatus } from '../../shared/ai'

interface CredentialCipher {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export class CredentialService {
  constructor(
    private readonly filePath: string,
    private readonly cipher: CredentialCipher = safeStorage,
  ) {}

  async status(id: string): Promise<AICredentialStatus> {
    if (!this.cipher.isEncryptionAvailable()) return 'unavailable'
    try {
      return (await this.readAll())[id] ? 'configured' : 'missing'
    } catch {
      return 'error'
    }
  }

  async set(id: string, secret: string): Promise<void> {
    this.requireAvailable()
    const encrypted = this.cipher.encryptString(secret).toString('base64')
    const current = await this.readAll()
    await this.writeAll({ ...current, [id]: encrypted })
  }

  async delete(id: string): Promise<void> {
    this.requireAvailable()
    const current = await this.readAll()
    if (!(id in current)) return
    delete current[id]
    await this.writeAll(current)
  }

  async resolve(id: string): Promise<string> {
    this.requireAvailable()
    const encrypted = (await this.readAll())[id]
    if (!encrypted) throw new Error('AI provider credential is not configured')
    try {
      return this.cipher.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
      throw new Error('AI provider credential could not be decrypted')
    }
  }

  private requireAvailable() {
    if (!this.cipher.isEncryptionAvailable())
      throw new Error('Secure credential storage is unavailable on this device')
  }

  private async readAll(): Promise<Record<string, string>> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('invalid credential store')
      return Object.fromEntries(
        Object.entries(value).filter(
          ([key, entry]) =>
            /^[0-9a-f-]{36}$/i.test(key) && typeof entry === 'string',
        ),
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw new Error('Secure credential store could not be read')
    }
  }

  private async writeAll(value: Record<string, string>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(value), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      })
      await rename(temporary, this.filePath)
    } catch {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw new Error('Secure credential store could not be updated')
    }
  }
}
