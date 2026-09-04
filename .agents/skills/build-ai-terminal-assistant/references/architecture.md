# Architecture

## Trust boundaries

Use four layers:

```text
Renderer UI
  -> narrow preload bridge
    -> main-process AI application service
      -> provider adapter / credential service / repositories
```

The renderer displays configuration and stream events but does not own credentials or construct privileged provider clients. Keep Node integration disabled and context isolation enabled. Adapt to existing application boundaries rather than duplicating them.

## Suggested responsibilities

- AI application service: validates requests, resolves sanitized provider configuration and credentials, coordinates cancellation, invokes adapters, and maps errors.
- Provider registry: maps a stable provider type to an adapter.
- Provider adapter: converts internal requests/events to one provider protocol.
- Credential service: encrypts, stores, resolves, replaces, and deletes secrets in the main process.
- Context builder: accepts only user-approved context, enforces limits, and produces a provider-neutral prompt payload.
- Conversation repository: persists providers without keys, conversations, messages, usage, and optional context metadata.
- Preload bridge: exposes typed commands and subscriptions with unsubscribe behavior.
- Renderer feature: owns transient presentation state, not secrets or process capabilities.

## Shared domain contracts

Prefer provider-neutral types:

```ts
type AIProviderType = "openai" | "openai-compatible";

type AIProviderConfig = {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl?: string;
  model: string;
  credentialId: string;
  enabled: boolean;
};

type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AIChatRequest = {
  requestId: string;
  conversationId: string;
  providerId: string;
  messages: AIChatMessage[];
  approvedContext?: ApprovedTerminalContext;
};
```

Do not expose provider SDK objects, raw HTTP responses, response headers, or secret-bearing errors across IPC.

## State ownership

- Persistent provider configuration excludes key material.
- Credential state is represented externally only as `missing`, `configured`, `unavailable`, or `error`.
- Active request/abort-controller maps are runtime-only and keyed by request ID.
- Conversation/message state may be persisted locally; provider-side conversation IDs are optional adapter metadata, not core identity.
- Terminal/xterm/PTy ownership remains with the existing terminal subsystem.

## Privacy default

Prefer locally managed conversation history and disable provider-side storage when supported and consistent with the selected provider. Explain any provider behavior that cannot honor this setting. Do not promise that a remote provider does not retain data; surface provider policy separately.
