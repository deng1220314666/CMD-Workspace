# Verification matrix

## Always

- Install from lockfile; lint, TypeScript, unit tests, and production build pass.
- Electron starts without main, preload, or renderer errors.
- Final diff contains no credentials, generated junk, or unrelated edits.

## PTY/runtime

- Shell starts in the configured directory.
- Input, ANSI output, Unicode, Ctrl+C, resize, REPL, exit, restart, and failure states work.
- Repeated project switching preserves PIDs and output.
- Closing one terminal leaves siblings intact; noisy output remains memory-bounded.

## PostgreSQL

- Empty and upgrade migrations pass; configuration survives restart.
- Stale runs become interrupted; stored PIDs are never treated as live.
- Constraint errors are actionable.

## Scheduler

- Dependencies start topologically; readiness gates downstream tasks.
- Timeout, cancellation, retry exhaustion, and cycles are deterministic and visible.
- Project stop respects reverse dependency order.

