---
name: design-pgsql-persistence
description: Design, migrate, or debug PostgreSQL and Drizzle persistence for CMD Workspace projects, terminal profiles, schedules, dependencies, application state, and run summaries. Do not use for live PTY transport or high-frequency output streaming.
---

# Design PostgreSQL Persistence

Inspect current migrations and schema before editing. Use additive, reviewable migrations and preserve user data. Keep database access in the Electron main-process persistence layer, never the renderer.

Read [references/data-contract.md](references/data-contract.md). Use JSONB only for genuinely variable configuration; keep identifiers, ownership, ordering, timestamps, and status queryable.

Use transactions for project deletion, terminal reordering, graph replacement, and multi-row run transitions. Enforce ownership through foreign keys.

On startup, reconcile unfinished runs to `interrupted`; never reconnect to stored PIDs. Store run summaries and optional log paths, not every PTY data event.

Verify migrations from an empty database and the previous schema version. Test constraints, cascades, unique paths, dependency validation, and actionable error reporting.
