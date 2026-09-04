# Persistence and UI

## Persistence

Follow the existing PostgreSQL/Drizzle naming, UUID, migration, repository, transaction, and timestamp conventions. Extend rather than replace existing data access.

Likely durable entities:

- AI providers: name, type, base URL, protocol mode, model, credential reference, enabled state.
- Conversations: optional project association, title, provider/model snapshot, timestamps.
- Messages: role, content, lifecycle status, sequence, usage, timestamps.
- Context attachment metadata: source terminal/project, kind, line/byte count, redaction count, optional retention flag.
- Usage records only if the product displays usage; label provider-reported estimates accurately.

Never store API keys, authorization headers, raw SDK errors, or credential ciphertext in PostgreSQL when credentials are device-local. Do not persist full terminal attachments by default. Use forward migrations and test both fresh install and upgrade.

On restart, pending/streaming messages become `interrupted`. Do not claim a remote request is still active without verified recovery.

## Assistant panel

Use the existing component system and design tokens. Prefer a resizable, collapsible right-side panel that does not reduce terminal usability below the supported minimum layout.

Required states:

- No provider configured.
- Credential missing/unavailable.
- Connection test idle/testing/succeeded/failed.
- Empty conversation.
- Sending/streaming.
- Cancelling/cancelled.
- Authentication, model, rate-limit, timeout, network, compatibility, and unknown errors.
- Interrupted message after restart.
- Context attached/redacted/too large.

Required controls:

- Provider/model selector.
- New/switch/rename/delete conversation.
- Composer and send.
- Stop generation.
- Retry without duplicating the user message.
- Copy response/code block.
- Context chip and preview/remove action.
- Insert command text without execution.

## UX rules

- Display which provider/model receives data.
- Do not display or offer to reveal a saved key.
- Disable send with an actionable reason when provider/credential/model is invalid.
- Preserve streamed partial text on cancellation or recoverable failure.
- Keep composer input on send failure unless a message was already committed.
- Virtualize or bound long conversation rendering when needed.
- Avoid rerender paths that recreate xterm.js instances.
- Sanitize Markdown and external links.

## Provider settings

Collect only:

- Friendly name.
- Provider type/protocol mode.
- Base URL when applicable.
- Model identifier.
- API key input for replacement only.
- Timeout and optional privacy settings where supported.

For custom origins, display the normalized destination and require renewed confirmation before transmitting an existing credential to a changed origin.
