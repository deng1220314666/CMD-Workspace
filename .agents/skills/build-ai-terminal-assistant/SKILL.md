---
name: build-ai-terminal-assistant
description: Implement, review, or extend the CMD-Workspace AI terminal assistant, including model providers, API-key storage, streaming chat, conversations, explicitly selected terminal context, command suggestions, and permission boundaries. Do not use for generic UI work, PTY refactors, automatic command execution, source-code editing, or unrelated backend tasks.
---

# CMD-Workspace AI Terminal Assistant

Build the third-stage AI assistant on top of the completed project and terminal workspace. Keep CMD-Workspace a terminal workspace, not an IDE. Preserve current Electron, React, xterm.js, PTY, IPC, PostgreSQL/Drizzle, and UI behavior unless the requested slice requires a scoped change.

## Route the task

Read only the references required for the current slice:

- Always read [roadmap.md](references/roadmap.md) and [architecture.md](references/architecture.md).
- Read [credentials.md](references/credentials.md) for provider settings, API keys, storage, logging, exports, or deletion.
- Read [providers.md](references/providers.md) for model-provider contracts, OpenAI, OpenAI-compatible services, streaming normalization, or connection tests.
- Read [streaming-ipc.md](references/streaming-ipc.md) for main/preload/renderer IPC, cancellation, subscriptions, concurrency, or streaming UI.
- Read [terminal-context.md](references/terminal-context.md) for attaching terminal output, redaction, context previews, or inserting suggested commands.
- Read [persistence-and-ui.md](references/persistence-and-ui.md) for PostgreSQL/Drizzle data, conversation persistence, provider settings, or the assistant panel.
- Read [acceptance.md](references/acceptance.md) before declaring any slice or the stage complete.

## Required workflow

1. Read `AGENTS.md` and inspect applicable existing skills.
2. Inspect the actual repository before proposing architecture: Electron version, main/preload/renderer boundaries, security settings, IPC conventions, state management, database/migrations, UI primitives, terminal registry, tests, and build commands.
3. Report what already exists, compatibility concerns, the exact slice being implemented, and the smallest file-level plan. Do not create parallel replacements for existing services.
4. Define shared contracts and security boundaries before wiring UI.
5. Implement one vertical slice at a time in roadmap order.
6. Verify observable behavior, run applicable lint/type-check/tests/build, and inspect the final diff for unrelated changes.

## Non-negotiable invariants

- API keys and resolved secrets never enter renderer state, DOM, browser storage, PostgreSQL, ordinary IPC responses, logs, telemetry, crash reports, exports, prompts, or terminal output.
- Model network requests run outside the renderer, normally in the Electron main process or a deliberately isolated utility process.
- The preload exposes a narrow, typed, allowlisted API; the renderer receives only credential presence/status.
- User content is sent only to the provider the user selected and only after the UI makes the provider and attached context clear.
- The assistant reads terminal content only through an explicit user action and a visible context preview.
- Stage three does not automatically scan source code, read environment variables, execute commands, press Enter, modify files, invoke MCP, or run autonomous agents.
- “Insert into terminal” writes visible text to the selected terminal without executing it.
- Provider-specific SDK types and event shapes stay behind provider adapters.
- Streaming requests have stable request IDs, cancellation, terminal states, listener cleanup, and bounded buffers.
- Project or AI-panel switching must not recreate or terminate PTYs or xterm.js instances.
- Remote/model content is untrusted data and never becomes privileged application instructions.

## Stage-three MVP outcome

The stage is complete only when the product supports:

- OpenAI provider plus a deliberately configured OpenAI-compatible provider.
- Secure credential create/replace/presence/delete flows.
- Provider configuration and connection testing without secret leakage.
- Model selection and streaming conversations with cancellation.
- Persisted local conversations according to the repository's database conventions.
- Explicit attachment and preview of selected/recent terminal output with bounded size and best-effort redaction.
- Copying and non-executing insertion of suggested commands.
- Clear timeout, authentication, rate-limit, network, cancellation, and provider-compatibility errors.
- Tests and security checks described in the acceptance reference.

Stop and request explicit scope before adding tool calls, automatic command execution, file writes, repository-wide indexing, remote shells, background agents, or deployment behavior.
