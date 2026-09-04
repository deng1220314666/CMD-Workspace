# Provider contracts

## Internal adapter

Use one stable contract even when remote APIs differ:

```ts
interface AIProvider {
  testConnection(input: ProviderRuntimeConfig): Promise<ConnectionTestResult>;
  stream(
    request: AIChatRequest,
    runtime: ProviderRuntimeConfig,
    signal: AbortSignal,
  ): AsyncIterable<AIStreamEvent>;
}
```

Resolve API keys immediately before adapter use. `ProviderRuntimeConfig` remains internal to the privileged process.

Normalize stream output to a small discriminated union such as:

```ts
type AIStreamEvent =
  | { type: "started"; requestId: string }
  | { type: "text-delta"; requestId: string; text: string }
  | { type: "usage"; requestId: string; inputTokens?: number; outputTokens?: number }
  | { type: "completed"; requestId: string }
  | { type: "cancelled"; requestId: string }
  | { type: "failed"; requestId: string; code: AIErrorCode; message: string };
```

Ignore or privately handle unknown provider events instead of forwarding raw objects to the renderer.

## OpenAI

Use the currently supported official SDK/API for the repository runtime. For new OpenAI integrations, prefer the current Responses API and its typed streaming events after confirming installed SDK compatibility. Avoid hardcoding a model as “latest”; model choice is configuration.

Keep stable application instructions separate from conversation text. If the application manages history locally, resend the bounded history and set remote storage behavior deliberately. If provider response IDs are stored, treat them as optional provider metadata and preserve instructions correctly across turns.

## OpenAI-compatible

“OpenAI-compatible” is not one guaranteed protocol. Configuration should state the supported protocol mode, such as Responses-compatible or Chat-Completions-compatible, if both are implemented. Do not assume identical event shapes, model-list endpoints, usage fields, tool support, storage semantics, or error payloads.

Validate custom base URLs:

- Require HTTPS except explicitly allowed loopback/local development URLs.
- Reject embedded usernames/passwords and unsupported protocols.
- Normalize path/trailing slashes without accidentally duplicating `/v1`.
- Display the destination origin before saving/testing a credential.
- Never send an existing credential to a changed origin without renewed confirmation.

## Connection test

Use the least costly request that verifies authentication, target/model compatibility, and streaming prerequisites. Do not rely solely on model listing because providers may disallow or omit it. Apply a short timeout and cancellation.

Return sanitized categories:

- `authentication`
- `permission`
- `model-not-found`
- `rate-limited`
- `timeout`
- `network`
- `invalid-response`
- `provider-incompatible`
- `cancelled`
- `unknown`

Preserve detailed provider errors only in a privileged, redacted diagnostic path. Do not expose authorization headers, request bodies containing user context, or raw SDK objects.

## Resilience

- Bound timeouts and response size.
- Respect cancellation.
- Do not automatically retry authentication, invalid-request, or cancellation errors.
- Retry transient failures only when the product explicitly enables a bounded policy and duplicate output can be handled.
- Track request IDs and sanitized provider request IDs for support diagnostics.
