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

## Active delivery: terminal workspace UX and safe copy

Scope: refine the existing local-project command-center interface and add terminal copy interactions that never steal plain `Ctrl+C` from the running PTY.

Acceptance checks:

- [x] Copy selected terminal text with `Ctrl+C`, `Ctrl+Shift+C`, `Ctrl+Insert`, the terminal copy button, and the selection context menu.
- [x] Keep plain `Ctrl+C` routed to the PTY when there is no selection so interactive CLIs receive their interrupt signal.
- [x] Surface copy availability and feedback through a narrow clipboard capability without exposing raw Node.js access.
- [x] Improve workspace hierarchy, responsive behavior, keyboard focus, terminal density, and actionable empty/error states.
- [x] Preserve terminal runtime IDs and PIDs while switching projects and while attaching/detaching terminal views.
- [x] Pass format, lint, typecheck, unit tests, production build, packaging, and applicable ConPTY lifecycle smoke tests.

## Active delivery: workspace UI phase 1

Scope: refine only the project sidebar, terminal tab strip, and renderer layout. Preserve all PTY, database, IPC, preload, and process-management behavior.

Acceptance checks:

- [x] Use a compact resizable 180-320px project sidebar with a 240px default and locally persisted width.
- [x] Keep terminal views mounted while switching projects or tabs so xterm viewport state is retained.
- [x] Use a 36px accessible terminal tab strip with shell and text status cues, keyboard navigation, and labelled actions.
- [x] Keep the main workspace usable at 1440x900 and 1024x768 without oversized headings, gradients, or unnecessary chrome.
- [x] Pass lint and type checking and review the diff for changes outside the renderer UI scope.

## Completed delivery: terminal workspace UI phase 2

Scope: add renderer-owned horizontal and vertical terminal splits, resizable panes, safe shell selection, terminal tools, and keyboard shortcuts while preserving stable PTY/runtime ownership. Reuse existing terminal-profile columns; do not add a database migration.

Acceptance checks:

- [x] Create horizontal and vertical splits with `react-resizable-panels`, persist renderer layout locally, and resize each visible xterm through the existing fit/resize path.
- [x] Keep one stable xterm instance per runtime across project, tab, pane, and layout changes; only restart replaces its view generation.
- [x] Create PowerShell or Command Prompt profiles using validated shell identifiers mapped to fixed executables and argument arrays.
- [x] Rename terminals and show starting, running, exited, and failed states with text and semantic color in tabs and panes.
- [x] Route every live-terminal close through the existing graceful/force confirmation flow and PID check.
- [x] Support terminal find, copy, paste, clear, split, focus, tab navigation, rename, new-terminal, and close shortcuts without stealing plain Ctrl+C from a running PTY.
- [x] Pass format, lint, typecheck, unit tests, production build, applicable ConPTY lifecycle smoke tests, and diff/security review.

## Completed fix: compact viewport fit

Scope: keep the workbench fully contained by the Electron viewport, compact the CMD Workspace and terminal-pane title typography, and prevent idle status text from wrapping or creating scrollbars.

Acceptance checks:

- [x] The root workspace and workbench can shrink within the viewport without clipping the terminal status bar.
- [x] The application window defaults to 1280×820 and enforces the 1024×768 desktop minimum.
- [x] Terminal pane titles remain single-line and the idle state uses the compact `Idle` label.

## Completed fix: compact new-terminal action

Scope: replace the persistent Shell selector with a compact split-button while retaining explicit PowerShell and Command Prompt creation.

Acceptance checks:

- [x] Clicking `+` immediately creates a terminal using the remembered Shell.
- [x] The adjacent arrow opens a keyboard-accessible menu whose choices immediately create the selected Shell.
- [x] Existing terminals, PTYs, shortcuts, and split creation behavior remain unchanged.

## Completed fix: desktop scrollbar styling

Scope: replace native Chromium scrollbar visuals with compact dark-theme styling without changing scroll behavior or terminal lifecycle.

Acceptance checks:

- [x] Project lists, terminal tabs, and xterm history use consistent low-contrast scrollbar tracks and handles.
- [x] Hover and active states remain visible without overpowering terminal content.
- [x] Horizontal tab scrolling stays compact and all scrollable regions retain mouse, wheel, touchpad, and keyboard behavior.

## Completed fix: application branding asset

Scope: use `src/public/logo/logo-2.png` consistently for in-app branding, the Electron window, and the packaged Windows executable.

Acceptance checks:

- [x] Vite copies the shared logo into the Renderer build and the sidebar displays it without changing layout dimensions.
- [x] Electron uses the shared PNG for the development window and packaged runtime.
- [x] electron-builder writes a multi-size `build/icon.ico` into the unpacked Windows executable.

## Completed fix: Windows installer command

Scope: expose a repeatable NSIS installer command and document the difference between unpacked and installable artifacts.

Acceptance checks:

- [x] `pnpm package:installer` is configured to build an x64 Windows NSIS installer.
- [x] English and Simplified Chinese documentation identify both artifact locations.
- [x] Both documents warn that unsigned installers can trigger Windows SmartScreen and recommend code signing for public distribution.
