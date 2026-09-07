import { randomUUID } from 'node:crypto'
import type { PersistenceRepository } from '../../database/repository'
import type {
  AIConnectionTestResult,
  AIErrorCode,
  AIProviderConfig,
  AISaveProviderRequest,
} from '../../shared/ai'
import { CredentialService } from './credential-service'

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

export function normalizeProviderBaseUrl(
  type: AISaveProviderRequest['type'],
  value?: string,
) {
  if (type === 'openai') return OPENAI_BASE_URL
  let url: URL
  try {
    url = new URL(value ?? '')
  } catch {
    throw new Error('Base URL must be a valid absolute URL')
  }
  if (url.username || url.password)
    throw new Error('Base URL must not contain a username or password')
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))
    throw new Error(
      'Base URL must use HTTPS, except for local loopback services',
    )
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '') || '/v1'
  return url.toString().replace(/\/$/, '')
}

export function errorCodeForStatus(status: number): AIErrorCode {
  if (status === 401) return 'authentication'
  if (status === 403) return 'permission'
  if (status === 404) return 'model-not-found'
  if (status === 429) return 'rate-limited'
  if (status >= 400 && status < 500) return 'provider-incompatible'
  return 'invalid-response'
}

export class AIProviderService {
  constructor(
    private readonly repository: PersistenceRepository,
    private readonly credentials: CredentialService,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async listProviders(): Promise<AIProviderConfig[]> {
    return Promise.all(
      (await this.repository.listAIProviders()).map((row) =>
        this.toPublic(row),
      ),
    )
  }

  async saveProvider(
    request: AISaveProviderRequest,
  ): Promise<AIProviderConfig> {
    const existing = request.providerId
      ? await this.repository.findAIProvider(request.providerId)
      : null
    if (request.providerId && !existing)
      throw new Error('AI provider does not exist')
    const baseUrl = normalizeProviderBaseUrl(request.type, request.baseUrl)
    const originChanged = existing
      ? new URL(existing.baseUrl).origin !== new URL(baseUrl).origin
      : false
    if (
      originChanged &&
      !request.apiKey &&
      (await this.credentials.status(existing!.credentialId)) === 'configured'
    )
      throw new Error(
        'Changing the provider destination requires entering the API key again',
      )
    const rotateCredential = Boolean(existing && originChanged)
    const credentialId = rotateCredential
      ? randomUUID()
      : (existing?.credentialId ?? randomUUID())
    if (rotateCredential)
      await this.credentials.set(credentialId, request.apiKey!.trim())
    let row
    try {
      row = await this.repository.saveAIProvider({
        id: existing?.id ?? randomUUID(),
        credentialId,
        name: request.name,
        type: request.type,
        protocol: request.type === 'openai' ? 'responses' : 'chat-completions',
        baseUrl,
        model: request.model,
        timeoutMs: request.timeoutMs,
        enabled: true,
      })
    } catch (error) {
      if (rotateCredential)
        await this.credentials.delete(credentialId).catch(() => undefined)
      throw error
    }
    if (request.apiKey && !rotateCredential)
      await this.credentials.set(row.credentialId, request.apiKey.trim())
    if (rotateCredential)
      await this.credentials
        .delete(existing!.credentialId)
        .catch(() => undefined)
    return this.toPublic(row)
  }

  async deleteProvider(providerId: string): Promise<void> {
    const deleted = await this.repository.deleteAIProvider(providerId)
    await this.credentials.delete(deleted.credentialId)
  }

  async deleteCredential(providerId: string): Promise<AIProviderConfig> {
    const row = await this.requireProvider(providerId)
    await this.credentials.delete(row.credentialId)
    return this.toPublic(row)
  }

  async testConnection(providerId: string): Promise<AIConnectionTestResult> {
    const row = await this.requireProvider(providerId)
    const started = Date.now()
    if ((await this.credentials.status(row.credentialId)) !== 'configured')
      return {
        ok: false,
        code: 'authentication',
        message: 'Configure an API key before testing this provider',
        latencyMs: Date.now() - started,
      }
    const apiKey = await this.credentials.resolve(row.credentialId)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), row.timeoutMs)
    try {
      const responses = row.protocol === 'responses'
      const response = await this.fetcher(
        `${row.baseUrl}${responses ? '/responses' : '/chat/completions'}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(
            responses
              ? {
                  model: row.model,
                  input: 'Reply OK',
                  max_output_tokens: 1,
                  store: false,
                }
              : {
                  model: row.model,
                  messages: [{ role: 'user', content: 'Reply OK' }],
                  max_tokens: 1,
                },
          ),
          signal: controller.signal,
        },
      )
      if (!response.ok) {
        const code = errorCodeForStatus(response.status)
        return {
          ok: false,
          code,
          message: messageForCode(code),
          latencyMs: Date.now() - started,
        }
      }
      const payload = await readBoundedJson(response)
      if (
        !payload ||
        typeof payload !== 'object' ||
        (responses
          ? !('output' in payload)
          : !Array.isArray((payload as { choices?: unknown }).choices))
      )
        return {
          ok: false,
          code: 'invalid-response',
          message: messageForCode('invalid-response'),
          latencyMs: Date.now() - started,
        }
      return {
        ok: true,
        message: 'Connection succeeded',
        latencyMs: Date.now() - started,
      }
    } catch (error) {
      const code: AIErrorCode =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'timeout'
          : 'network'
      return {
        ok: false,
        code,
        message: messageForCode(code),
        latencyMs: Date.now() - started,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  private async requireProvider(providerId: string) {
    const row = await this.repository.findAIProvider(providerId)
    if (!row) throw new Error('AI provider does not exist')
    return row
  }

  private async toPublic(
    row: NonNullable<
      Awaited<ReturnType<PersistenceRepository['findAIProvider']>>
    >,
  ) {
    return {
      providerId: row.id,
      name: row.name,
      type: row.type,
      protocol: row.protocol,
      baseUrl: row.baseUrl,
      model: row.model,
      timeoutMs: row.timeoutMs,
      enabled: row.enabled,
      credentialStatus: await this.credentials.status(row.credentialId),
      destinationOrigin: new URL(row.baseUrl).origin,
    } satisfies AIProviderConfig
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > 1_000_000) throw new Error('response too large')
  const text = await response.text()
  if (text.length > 1_000_000) throw new Error('response too large')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function messageForCode(code: AIErrorCode) {
  const messages: Record<AIErrorCode, string> = {
    authentication: 'Authentication failed; replace the API key',
    permission: 'The credential cannot access this model',
    'model-not-found': 'The configured model was not found',
    'rate-limited': 'The provider rate limit was reached',
    timeout: 'The connection test timed out',
    network: 'The provider could not be reached',
    'invalid-response': 'The provider returned an invalid response',
    'provider-incompatible':
      'The endpoint is not compatible with the selected protocol',
    cancelled: 'The connection test was cancelled',
    unknown: 'The connection test failed',
  }
  return messages[code]
}
