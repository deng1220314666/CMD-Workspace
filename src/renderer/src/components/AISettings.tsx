import { useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  AIConnectionTestResult,
  AIProviderConfig,
  AIProviderType,
} from '../../../shared/ai'

interface Props {
  open: boolean
  onClose: () => void
  onError: (message: string) => void
}
interface Draft {
  providerId?: string
  name: string
  type: AIProviderType
  baseUrl: string
  model: string
  timeoutMs: number
}
const emptyDraft = (): Draft => ({
  name: 'OpenAI',
  type: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  timeoutMs: 15_000,
})
const draftFrom = (item: AIProviderConfig): Draft => ({
  providerId: item.providerId,
  name: item.name,
  type: item.type,
  baseUrl: item.baseUrl,
  model: item.model,
  timeoutMs: item.timeoutMs,
})

export function AISettings({ open, onClose, onError }: Props) {
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AIConnectionTestResult | null>(null)
  const keyRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    let active = true
    void window.cmdWorkspace.ai
      .listProviders()
      .then((items) => {
        if (!active) return
        setProviders(items)
        setDraft(items[0] ? draftFrom(items[0]) : emptyDraft())
      })
      .catch((error: unknown) =>
        onError(error instanceof Error ? error.message : String(error)),
      )
    return () => {
      active = false
    }
  }, [onError, open])
  if (!open) return null
  const selected = providers.find(
    (item) => item.providerId === draft.providerId,
  )
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const key = keyRef.current?.value.trim()
      const saved = await window.cmdWorkspace.ai.saveProvider({
        ...draft,
        baseUrl: draft.type === 'openai' ? undefined : draft.baseUrl,
        apiKey: key || undefined,
      })
      if (keyRef.current) keyRef.current.value = ''
      setProviders((items) => [
        ...items.filter((item) => item.providerId !== saved.providerId),
        saved,
      ])
      setDraft(draftFrom(saved))
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  const refreshProvider = (saved: AIProviderConfig) =>
    setProviders((items) =>
      items.map((item) =>
        item.providerId === saved.providerId ? saved : item,
      ),
    )
  return (
    <div className="modal-backdrop ai-settings-backdrop" role="presentation">
      <section
        className="ai-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
      >
        <header className="ai-settings-header">
          <div>
            <p className="eyebrow">SETTINGS</p>
            <h2 id="ai-settings-title">AI Providers</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="ai-settings-body">
          <nav className="ai-provider-list" aria-label="AI providers">
            {providers.map((item) => (
              <button
                type="button"
                className={item.providerId === draft.providerId ? 'active' : ''}
                key={item.providerId}
                onClick={() => {
                  setDraft(draftFrom(item))
                  setResult(null)
                }}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.type} · {item.credentialStatus}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft())
                setResult(null)
              }}
            >
              + New provider
            </button>
          </nav>
          <form
            className="ai-provider-form"
            onSubmit={(event) => void save(event)}
          >
            <label>
              <span>Name</span>
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              <span>Provider</span>
              <select
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as AIProviderType
                  setDraft({
                    ...draft,
                    type,
                    baseUrl:
                      type === 'openai'
                        ? 'https://api.openai.com/v1'
                        : 'http://localhost:11434/v1',
                  })
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="openai-compatible">OpenAI Compatible</option>
              </select>
            </label>
            <label>
              <span>Base URL</span>
              <input
                required
                disabled={draft.type === 'openai'}
                value={draft.baseUrl}
                onChange={(event) =>
                  setDraft({ ...draft, baseUrl: event.target.value })
                }
              />
            </label>
            <label>
              <span>Model</span>
              <input
                required
                maxLength={200}
                value={draft.model}
                placeholder="Model identifier"
                onChange={(event) =>
                  setDraft({ ...draft, model: event.target.value })
                }
              />
            </label>
            <label>
              <span>
                API key{' '}
                {selected?.credentialStatus === 'configured' && '(configured)'}
              </span>
              <input
                ref={keyRef}
                type="password"
                autoComplete="new-password"
                placeholder={
                  selected?.credentialStatus === 'configured'
                    ? 'Leave blank to keep current key'
                    : 'Enter API key'
                }
              />
            </label>
            <label>
              <span>Timeout (seconds)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={draft.timeoutMs / 1000}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    timeoutMs: Number(event.target.value) * 1000,
                  })
                }
              />
            </label>
            {selected && (
              <p className="ai-destination">
                Requests go to <strong>{selected.destinationOrigin}</strong>
              </p>
            )}
            {result && (
              <p
                className={`ai-test-result ${result.ok ? 'success' : 'failure'}`}
                role="status"
              >
                {result.message} · {result.latencyMs}ms
              </p>
            )}
            <div className="dialog-actions ai-settings-actions">
              {draft.providerId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void window.cmdWorkspace.ai
                      .deleteCredential({ providerId: draft.providerId! })
                      .then(refreshProvider)
                      .catch((error: unknown) =>
                        onError(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                  }
                >
                  Delete key
                </button>
              )}
              {draft.providerId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void window.cmdWorkspace.ai
                      .testConnection({ providerId: draft.providerId! })
                      .then(setResult)
                      .catch((error: unknown) =>
                        onError(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                      .finally(() => setBusy(false))
                  }}
                >
                  Test Connection
                </button>
              )}
              {draft.providerId && (
                <button
                  className="danger-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${draft.name}?`)) return
                    setBusy(true)
                    void window.cmdWorkspace.ai
                      .deleteProvider({ providerId: draft.providerId! })
                      .then(() => {
                        const next = providers.filter(
                          (item) => item.providerId !== draft.providerId,
                        )
                        setProviders(next)
                        setDraft(next[0] ? draftFrom(next[0]) : emptyDraft())
                      })
                      .catch((error: unknown) =>
                        onError(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                      .finally(() => setBusy(false))
                  }}
                >
                  Delete provider
                </button>
              )}
              <button type="submit" disabled={busy}>
                {busy ? 'Working…' : 'Save provider'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
