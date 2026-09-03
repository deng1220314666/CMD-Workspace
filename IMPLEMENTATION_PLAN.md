# Implementation plan

## M0 — Repository foundation

- Initialize Electron + React + TypeScript + Vite with pnpm.
- Establish `main`, `preload`, `renderer`, `shared`, `database`, and `tests` boundaries.
- Add lint, formatting, typecheck, unit test, packaging, and development commands.
- Add environment validation and a local PostgreSQL Docker Compose file.

Acceptance: development window opens; renderer has no Node.js globals; lint, typecheck, and unit tests pass.

## M1 — One real interactive terminal

- Spawn PowerShell through node-pty in the main process.
- Render it through xterm.js with bidirectional IPC.
- Support ANSI colors, keyboard input, Ctrl+C, resize, exit state, restart, and bounded output buffering.

Acceptance: `node`, `python`, `npm run dev`, and a long-running command behave interactively; resizing does not corrupt output.

## M2 — Projects and multiple terminals

- Import a local project directory and display it in the left sidebar.
- Create, rename, reorder, restart, and close terminal tabs.
- Maintain independent active-terminal selection per project.
- Switching projects keeps all PTYs alive and restores screen contents.

Acceptance: two projects can each run at least two terminals; repeated switching does not change their PIDs or stop output.

## M3 — PostgreSQL persistence

- Add migrations for projects, terminal profiles, terminal runs, task definitions, dependencies, and app state.
- Restore projects and terminal profiles on startup.
- Record run start, exit status, duration, exit code, and optional log path.
- Reconcile stale `running` rows after an unclean app exit.

Acceptance: application restart restores configuration; it never pretends an old PID is a live PTY.

## M4 — Scheduler

- Add one-click project start and stop.
- Support task dependencies with cycle detection.
- Implement readiness conditions: process started, delay, TCP port, HTTP health, and prerequisite success.
- Add bounded retries and restart policies with visible state transitions.

Acceptance: backend readiness can gate frontend startup; cycles are rejected; failed readiness times out and explains why.

## M5 — Product hardening

- Running-task close confirmation and optional minimize-to-tray behavior.
- Structured application logs and bounded terminal log files.
- Keyboard shortcuts, empty/error/loading states, database migration UX, and packaged Windows smoke test.

Acceptance: closing, crashing, restarting, migration failure, missing project paths, and command failure are recoverable and understandable.

## Deferred

- Background daemon that survives UI exit
- Remote control and multi-machine agents
- Authentication and multi-user collaboration
- AI command generation or autonomous execution
- Cloud terminal history synchronization

## Active delivery: M0 + M1

Scope: repository foundation plus one real interactive terminal. PostgreSQL is limited to a development service and startup environment validation; no business schema, migrations, or scheduler are included.

Acceptance checks:

- [x] Install dependencies from `pnpm-lock.yaml`.
- [ ] Open an isolated Electron window with a typed preload API and no renderer Node.js globals.
- [ ] Start a real PowerShell PTY in a validated working directory and render it with xterm.js.
- [x] Verify input, ANSI/Unicode output, Ctrl+C, resize, exit, restart, failure handling, and bounded history.
- [ ] Run format check, lint, typecheck, unit tests, production build, and a practical Electron development smoke check.
- [ ] Validate the Docker Compose PostgreSQL configuration and document any unavailable daemon or ConPTY checks.

Environment note (2026-09-02): Electron 41.10.5 and 43.4.0 both crash when the managed runner launches a Chromium GPU process, so renderer-in-window checks remain pending in that account. Real Electron-ABI ConPTY sessions and terminal-manager lifecycle checks pass outside the Chromium window. `docker compose config --quiet` passes; service reachability still needs a normal Docker Desktop session.

Development service configuration update:

- [x] Configure a new PostgreSQL `cmd_workspace` database on port 5433 with the local `nexus` credentials and UTC timezone; do not use `miniopen`.
- [x] Configure passwordless Redis on port 6380 using database 1.
- [x] Confirm PostgreSQL on port 5433 and Redis on port 6380 are reachable; the managed account still cannot access Docker's control pipe.

## Active delivery: M2

Scope: transient local-project import and multi-terminal management. Persistence remains deferred to M3.

Acceptance checks:

- [x] Import and validate local project folders through main-process IPC.
- [x] Create, select, rename, reorder, restart, and close terminal tabs per project.
- [x] Remember each project's selected terminal while switching projects.
- [x] Keep every PTY and its PID unchanged while its project view is detached.
- [x] Restore buffered output without gaps or duplication when a terminal view reattaches.
- [x] Require explicit graceful-stop or force-kill confirmation before closing a live terminal.
- [x] Pass format, lint, typecheck, unit tests, production build, packaging, Compose syntax validation, and real ConPTY lifecycle/PID-stability smoke tests.
- [ ] Complete the practical renderer-in-window check from a normal desktop session; the managed runner cannot start Chromium's GPU process.

## Active delivery: M3

Scope: PostgreSQL-backed project, terminal-profile, application-state, and terminal-run persistence using Drizzle ORM and repeatable SQL migrations. Live PTY objects and high-frequency output remain exclusively in bounded main-process memory.

Acceptance checks:

- [x] Add reviewable Drizzle schemas and repeatable migrations for projects, terminal profiles, terminal runs, tasks, task dependencies, and application state.
- [x] Restore projects, terminal profiles, ordering, and active selections without treating stored PIDs as live processes.
- [x] Persist profile creation, rename, reorder, and deletion through validated main-process IPC.
- [x] Record run start, state transitions, exit code, duration, error summary, and optional log path without storing terminal output.
- [x] Reconcile stale starting/running/stopping runs to interrupted on startup.
- [x] Verify unique normalized paths, ownership/cascades, task dependency constraints, and cycle rejection.
- [x] Apply migrations to an empty database, reapply them, and exercise persistence/restart reconciliation against PostgreSQL.
- [x] Pass format, lint, typecheck, unit tests, production build, packaging, ConPTY regression, and security review.
- [ ] Complete practical renderer-in-window persistence verification from a normal desktop session; the managed runner's Chromium GPU process exits before the window loads.

### M3 packaged configuration fix

- [x] Provide safe local PostgreSQL/Redis defaults so a packaged executable does not depend on its launch working directory.
- [x] Allow explicit overrides from process environment, an executable-adjacent `.env`, and the application user-data `.env`.
- [x] Suppress persistence writes when database initialization failed and show one actionable startup error.
- [x] Verify configuration precedence, static checks, database smoke, and production compilation.
- [x] Repackage after the running CMD Workspace processes released the old executable, and verify the packaged archive contains the new configuration loader and defaults.

### M3 project annotations

- [x] Add nullable project remark-name and purpose columns through an additive Drizzle migration.
- [x] Expose validated main-process persistence IPC for updating project annotations.
- [x] Add an accessible sidebar editor while retaining the real folder name and path.
- [x] Restore annotations after restart and verify migration, persistence, UI state, static checks, database smoke, and packaging.
