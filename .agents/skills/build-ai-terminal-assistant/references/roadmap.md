# Stage-three roadmap

Implement the stage as four independently usable slices. Do not combine all slices in one large change unless the user explicitly requests it and the repository can safely absorb it.

## Slice 3.1: provider and credentials

Deliver:

- Internal provider contract and registry.
- OpenAI configuration model with room for OpenAI-compatible configuration.
- Main-process credential service using the supported secure-storage capability of the installed Electron version.
- Provider settings UI.
- Create/replace, presence, delete, and test-connection operations.
- Sanitized error taxonomy.

Do not build the chat UI in this slice. Verify that a stored key survives an application restart, can be replaced/deleted, and cannot be retrieved from the renderer.

## Slice 3.2: streaming chat

Deliver:

- OpenAI adapter and then the OpenAI-compatible adapter.
- Provider-neutral stream events.
- Assistant side panel, conversations, message rendering, composer, model/provider selector, stop action, retry action, and empty/error states.
- Per-request cancellation and stale-event protection.
- Local conversation persistence and bounded context construction.

Do not attach terminal data automatically.

## Slice 3.3: explicit terminal context

Deliver:

- “Send selection to AI”.
- “Attach recent output” with a bounded line choice.
- Context preview that identifies provider, project, terminal, shell, working directory, line/byte count, and excluded data.
- ANSI/control-sequence cleanup, size limits, best-effort secret redaction, and user confirmation.
- Context provenance stored separately from message content when persistence is enabled.

Do not scan files or environment variables.

## Slice 3.4: safe command suggestions

Deliver:

- Detect command-like fenced blocks for presentation only.
- Copy command.
- Insert command text into a clearly identified active terminal without sending Enter.
- Multiline and potentially destructive-command warnings.

Do not add an execute button in stage three.

## Stop conditions

Pause the slice instead of guessing when:

- The installed Electron version lacks the expected credential API.
- Existing IPC or database conventions cannot be determined.
- The product must support shared/team API keys instead of bring-your-own-key.
- A provider requires a protocol incompatible with the configured adapter.
- Implementing the request would expose a key to the renderer or execute model output.
