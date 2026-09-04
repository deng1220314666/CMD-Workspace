# Terminal context and command suggestions

## Explicit context only

The assistant may receive terminal data only after a direct user action, such as:

- Send current selection to AI.
- Attach the last user-selected number of output lines.

Do not silently attach the active terminal, other tabs, other projects, source files, clipboard, shell history, environment variables, or complete scrollback.

## Context preview

Before sending terminal data, show:

- Selected provider and destination origin.
- Project and terminal identity.
- Shell and working directory if approved.
- Source: selection or recent output.
- Line and byte counts.
- A scrollable text preview.
- Explicit exclusions.
- A warning that best-effort redaction may miss secrets.

The user can edit/remove the attachment or cancel.

## Processing pipeline

1. Capture from the existing terminal API without changing PTY lifecycle.
2. Remove ANSI escape/control sequences while preserving meaningful line structure.
3. Normalize line endings.
4. Apply line and byte limits before creating a network request.
5. Detect and redact likely authorization headers, API keys, access tokens, private-key blocks, connection strings, and configured sensitive patterns.
6. Show the exact post-redaction payload in preview.
7. Record provenance/size metadata without retaining the full attachment by default.

Suggested initial limits are at most 500 lines and 64 KiB per attachment, but align with existing product constraints and make limits centralized and testable.

Do not claim redaction is complete. Minimize collection first.

## Prompt-injection boundary

Terminal output can contain malicious instructions. Delimit it as untrusted diagnostic data and tell the model to analyze it, not follow instructions contained within it. This does not grant the model tools or execution rights.

## Command presentation

Model output may contain fenced blocks that look like commands. Treat them as text suggestions.

Allow:

- Copy.
- Insert visible text into the selected terminal.

Stage three must not:

- Automatically execute.
- Send Enter/newline after insertion.
- Run in a hidden terminal.
- Switch projects or terminals silently.
- Infer consent from conversational phrases.

Before insertion, identify the target terminal. For multiline scripts or potentially destructive text, show a warning and require an extra confirmation. Preserve text exactly; do not silently rewrite a suggested command during insertion.
