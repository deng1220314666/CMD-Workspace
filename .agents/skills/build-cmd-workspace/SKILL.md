---
name: build-cmd-workspace
description: Build or extend the CMD Workspace Electron application, including project navigation, multi-terminal UI, scheduling, and milestone delivery. Use for product features and end-to-end implementation; use narrower skills for isolated runtime or persistence work.
---

# Build CMD Workspace

Read the repository `AGENTS.md` and `IMPLEMENTATION_PLAN.md`. Identify the active milestone from the user's request; if none is stated, implement only the earliest incomplete milestone.

Before changing code, inspect the repository, existing package manager, current tests, and git status. Preserve working code and user changes. Prefer a vertical slice that can be run and observed over broad scaffolding.

For terminal-process work, invoke `$implement-pty-runtime`. For PostgreSQL schema or lifecycle work, invoke `$design-pgsql-persistence`. Before completion, invoke `$verify-cmd-workspace`.

Use [references/product-contract.md](references/product-contract.md) when implementing navigation, terminal behavior, or scheduling semantics.

Do not add deferred features unless requested. Do not silently switch frameworks or replace a real PTY with command execution mocks.
