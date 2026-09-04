# Acceptance criteria

Verify the current slice plus all previously completed slices that it can affect. Report unchecked or failed items honestly.

## Provider and credential checks

- Provider settings persist without key material.
- A key can be created, replaced, detected, used, and deleted after application restart.
- Renderer code/state/DOM/browser storage cannot retrieve the saved key.
- PostgreSQL, logs, telemetry, crash output, exports, IPC responses, snapshots, and errors contain no key or authorization header.
- Secure storage unavailability has a blocking, truthful error; there is no plaintext fallback.
- Changing a custom provider origin does not silently reuse/send the old credential.
- Connection test handles success, invalid key, forbidden model, rate limit, timeout, network loss, cancellation, and malformed compatibility response.

## Streaming checks

- Text appears incrementally and in order.
- Each request produces one terminal event.
- Stop aborts the actual network operation and retains partial text.
- Two conversations or windows do not receive each other's events.
- Rapid send/stop/retry does not create duplicate or stale output.
- Subscriptions and abort controllers are cleaned up.
- Long output remains responsive and bounded.
- Restart marks unfinished messages interrupted.

## Context checks

- No terminal data is sent without an explicit user action and preview.
- Preview shows the exact post-processing payload and destination provider.
- ANSI/control sequences are handled without destroying useful diagnostics.
- Line/byte limits work for Unicode and Windows line endings.
- Known secret patterns are redacted and redaction counts are shown without revealing values.
- Other projects, terminals, files, clipboard, environment variables, and complete history are excluded.
- Terminal content is treated as untrusted diagnostic data.

## Command-suggestion checks

- Suggested commands are text only.
- Copy preserves expected text.
- Insert targets the terminal the user selected and never sends Enter.
- Multiline/destructive-looking suggestions receive the intended warning.
- Project switching, panel toggling, and insertion do not recreate or kill PTYs/xterm instances.

## Security and UI checks

- `contextIsolation` remains enabled and renderer Node integration remains disabled.
- IPC payloads and senders are validated in the privileged process.
- Generated Markdown cannot run script, invoke Node, or open unsafe protocols.
- Empty, loading, streaming, cancelled, interrupted, and all mapped error states are understandable and keyboard accessible.
- The AI panel works at the project's minimum supported window size and can be collapsed/resized.

## Quality gates

- Unit tests cover provider mapping, error sanitization, redaction, limits, URL validation, stream state, and cancellation.
- Integration tests cover credentials across restart, provider request/stream/cancel, IPC isolation, message persistence, and terminal attachment.
- Repository lint, type-check, tests, and production build pass.
- Database migrations pass on a fresh database and from the prior schema.
- Final diff contains no automatic command execution, file-writing tools, repository-wide source scan, PTY refactor, unrelated UI redesign, MCP, or autonomous-agent behavior.

## Completion report

Report:

- Completed slice and observable behaviors.
- Files/schema changed.
- Tests and builds run with results.
- Security checks performed.
- Acceptance items not verified.
- Remaining risks and recommended next slice.
