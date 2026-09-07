export type AIProviderType = 'openai' | 'openai-compatible'
export type AIProtocol = 'responses' | 'chat-completions'
export type AICredentialStatus =
  | 'missing'
  | 'configured'
  | 'unavailable'
  | 'error'

export type AIErrorCode =
  | 'authentication'
  | 'permission'
  | 'model-not-found'
  | 'rate-limited'
  | 'timeout'
  | 'network'
  | 'invalid-response'
  | 'provider-incompatible'
  | 'cancelled'
  | 'unknown'

export interface AIProviderConfig {
  providerId: string
  name: string
  type: AIProviderType
  protocol: AIProtocol
  baseUrl: string
  model: string
  timeoutMs: number
  enabled: boolean
  credentialStatus: AICredentialStatus
  destinationOrigin: string
}

export interface AISaveProviderRequest {
  providerId?: string
  name: string
  type: AIProviderType
  baseUrl?: string
  model: string
  timeoutMs: number
  apiKey?: string
}

export interface AIProviderIdRequest {
  providerId: string
}

export interface AIConnectionTestResult {
  ok: boolean
  code?: AIErrorCode
  message: string
  latencyMs: number
}

export interface AIChatRequest {
  requestId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
}

export interface AIChatChunk {
  requestId: string
  text: string
}

export interface AIProviderApi {
  listProviders(): Promise<AIProviderConfig[]>
  saveProvider(request: AISaveProviderRequest): Promise<AIProviderConfig>
  deleteProvider(request: AIProviderIdRequest): Promise<void>
  deleteCredential(request: AIProviderIdRequest): Promise<AIProviderConfig>
  testConnection(request: AIProviderIdRequest): Promise<AIConnectionTestResult>
}

export interface AIProvider {
  chat(request: AIChatRequest, signal: AbortSignal): AsyncIterable<AIChatChunk>
  testConnection(signal: AbortSignal): Promise<AIConnectionTestResult>
  listModels?(signal: AbortSignal): Promise<Array<{ id: string }>>
}
