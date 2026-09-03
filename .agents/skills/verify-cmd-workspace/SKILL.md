---
name: verify-cmd-workspace
description: Verify CMD Workspace changes through static checks, tests, Electron smoke tests, terminal lifecycle scenarios, database migrations, and diff review. Use before declaring a milestone or terminal-related fix complete.
---

# Verify CMD Workspace

Read [references/verification-matrix.md](references/verification-matrix.md). Select every check relevant to changed behavior; compilation alone is insufficient.

Start with git status and changed files. Run formatting/linting, TypeScript checks, unit tests, and builds using repository scripts, then exercise the affected user flow. Capture commands, exit codes, and platform limitations.

For PTY work, verify process identity survives project switching and view attach/detach. For persistence, apply migrations to an empty database and test restart reconciliation. For scheduling, test success, timeout, cancellation, failure, and cycle rejection.

Review for secrets, renderer database access, unsafe IPC, unbounded buffers, `shell: true`, command interpolation, unrelated changes, and missing error states. Report pass, fail, or not-run for each check.
