# Streaming IPC

## Operations

Adapt names to the repository's IPC conventions. The surface normally needs:

- list/save/delete providers
- set/check/delete credential
- test connection
- list/create/rename/delete conversations
- start/cancel chat request
- subscribe/unsubscribe to stream events

Validate all renderer inputs again in the privileged process with the repository's existing schema library.

## Request lifecycle

1. Renderer creates or receives a stable request ID.
2. Main process verifies sender, conversation, provider, credential status, model, and approved context.
3. Main process registers an `AbortController` before emitting `started`.
4. Provider events are normalized and routed only to the requesting window/conversation.
5. Completion, failure, or cancellation produces exactly one terminal event.
6. Main process removes controllers and listeners in `finally`.

Reject or idempotently return duplicate live request IDs. A stale event must not mutate a different or newer message.

## Subscription rules

- A preload subscription returns an unsubscribe function.
- React effects clean subscriptions on unmount.
- Do not add a new IPC listener for every token.
- Batch tiny deltas on a short UI cadence when necessary to avoid excessive renders.
- Bound queued text and fail safely if the renderer cannot keep up.
- Closing the AI panel should detach its view subscription, not necessarily cancel the request; choose and document product behavior.
- Closing the owning window cancels or deliberately hands off its active requests.

## Cancellation

`cancelChat(requestId)` aborts the actual network request. Mark the assistant message cancelled without deleting already streamed text. Cancellation is not an error eligible for automatic retry.

## Persistence ordering

- Create the user message and pending assistant message before starting the provider request.
- Append/buffer deltas without one database write per token.
- Flush periodically or at terminal state.
- On application crash/restart, convert pending/streaming messages to interrupted.
- Do not persist secret-bearing raw requests or headers.

## Rendering

Treat model Markdown as untrusted. Sanitize rendered HTML, disable raw HTML by default, restrict link protocols, and open external links through a validated main-process action. Never enable Node capabilities for generated content.
