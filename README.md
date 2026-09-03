# CMD Workspace

CMD Workspace is a Windows-first desktop application for organizing local projects and their interactive terminals in one place. Each project can keep multiple live PowerShell or Command Prompt sessions, and switching projects never terminates their PTY processes.

> Current version: `0.1.0`. The local terminal workspace and PostgreSQL persistence milestones are complete. Task orchestration, production installers, and code signing are still planned.

## Highlights

- Import local project directories and switch between them from a compact, resizable sidebar.
- Add project aliases and purpose notes without losing the real directory name or path.
- Create multiple independent PowerShell or Command Prompt terminals per project.
- Split the terminal workspace horizontally or vertically and resize panes.
- Rename, reorder, start, restart, switch, and close terminal profiles.
- Keep live PTYs and stable runtime IDs running while projects, tabs, and panes are switched.
- Search terminal output, copy selections, paste text, and clear the viewport.
- Show explicit `starting`, `running`, `exited`, and `failed` process states.
- Confirm before closing or restarting a terminal that still has a live process.
- Persist projects, terminal profiles, application selection, and run summaries in PostgreSQL.
- Restore configuration after an application restart without treating historical PIDs as live processes.

## Technology

- Electron, React, TypeScript, and Vite
- xterm.js and node-pty with Windows ConPTY
- PostgreSQL, Drizzle ORM, and SQL migrations
- Vitest, ESLint, and Prettier
- pnpm

## Architecture

```text
React renderer
  |-- project navigation and terminal layouts
  |-- stable xterm.js view registry
  |-- renderer-only selection and split state
  |
  +-- narrow typed contextBridge API
        |
Electron main process
  |-- validated IPC handlers
  |-- TerminalManager
  |     +-- node-pty / Windows ConPTY
  |     +-- bounded in-memory output buffers
  |
  +-- PersistenceRepository
        +-- Drizzle ORM / PostgreSQL
```

The application maintains these security and lifecycle boundaries:

- The renderer does not spawn processes, connect directly to PostgreSQL, or receive raw Node.js access.
- `contextIsolation` remains enabled and `nodeIntegration` remains disabled.
- IPC payloads are validated before use.
- Shell choices are validated identifiers mapped to fixed executable and argument arrays.
- Live terminal output remains in bounded main-process memory instead of being streamed into PostgreSQL.
- PTY instances are owned by the main process and keyed by stable runtime IDs.
- Project and tab selection only attach or hide terminal views; they do not stop PTYs.

## Requirements

- Windows 10 or Windows 11, x64
- Node.js 22 LTS or newer
- pnpm 10; this repository declares `pnpm@10.15.0`
- Docker Desktop or an accessible PostgreSQL instance

`node-pty` normally uses a prebuilt native module. If a local source build is required, install these Visual Studio Build Tools components:

- Desktop development with C++
- The matching MSVC toolset and Windows SDK
- Spectre-mitigated libraries for the selected toolset and architecture

## Quick start

### 1. Install dependencies

```powershell
corepack enable
pnpm install --frozen-lockfile
```

### 2. Create the local configuration

```powershell
Copy-Item .env.example .env
```

The default development values are:

```dotenv
DATABASE_URL=postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable
DATABASE_TIMEZONE=UTC
REDIS_URL=redis://127.0.0.1:6380/1
```

These credentials are intended only for local development. Do not reuse them for a public or production database.

### 3. Start local services

```powershell
docker compose up -d postgres redis
docker compose ps
```

PostgreSQL stores application configuration and terminal run summaries. Redis is reserved for future orchestration work and does not store PTY output.

If PostgreSQL is already running but the `cmd_workspace` database does not exist, run:

```powershell
pnpm db:create
```

This command can only create the fixed `cmd_workspace` database; it does not reset existing data.

### 4. Start the desktop application

```powershell
pnpm dev
```

Pending Drizzle migrations are applied when the application starts.

## Using the workspace

1. Select **Import project** and choose a local directory.
2. Use the project action button to add an alias or purpose note.
3. Select **+** to create a terminal using the current default Shell.
4. Use the arrow beside **+** to create either PowerShell or Command Prompt explicitly.
5. Use the split buttons or keyboard shortcuts to add horizontal or vertical terminal panes.
6. Double-click a terminal tab, or press `F2`, to rename it.
7. Switch projects or tabs freely. Their background PTYs continue running and buffered output remains available.
8. After restarting the application, restored profiles are idle until **Start** creates a new PTY and PID.

## Keyboard shortcuts

| Shortcut                        | Action                                   |
| ------------------------------- | ---------------------------------------- |
| `Ctrl+Shift+N`                  | Create a terminal                        |
| `Ctrl+Shift+H`                  | Split horizontally                       |
| `Ctrl+Shift+J`                  | Split vertically                         |
| `Ctrl+PageUp` / `Ctrl+PageDown` | Select the previous or next terminal tab |
| `F2`                            | Rename the active terminal               |
| `Ctrl+Shift+W`                  | Close the active terminal                |
| `Ctrl+F`                        | Search terminal output                   |
| `Ctrl+Shift+C` or `Ctrl+Insert` | Copy selected terminal text              |
| `Ctrl+Shift+V`                  | Paste into the active terminal           |
| `Ctrl+Shift+K`                  | Clear the terminal viewport              |

When terminal text is selected, `Ctrl+C` copies the selection. Without a selection, plain `Ctrl+C` is sent to the running PTY so interactive commands still receive the interrupt signal.

## Configuration precedence

Development mode reads `.env` from the repository root. A packaged application uses built-in local defaults and then applies configuration from these sources, with later values taking precedence:

1. `.env` beside `CMD Workspace.exe`
2. `%APPDATA%\cmd-workspace\.env`
3. Windows environment variables inherited by the process

This allows an unpacked build to connect to another PostgreSQL instance without rebuilding the application.

## Persistence model

The Drizzle schema is defined in [`src/database/schema.ts`](src/database/schema.ts), and migrations are stored in [`drizzle/`](drizzle/).

| Table               | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `projects`          | Project names, annotations, normalized paths, and ordering              |
| `terminal_profiles` | Terminal titles, working directories, Shell configuration, and ordering |
| `terminal_runs`     | Run status, diagnostic PID, timestamps, exit codes, and error summaries |
| `tasks`             | Reserved task and readiness configuration for future orchestration      |
| `task_dependencies` | Task dependency and ownership constraints                               |
| `application_state` | Small, versioned application selection state                            |

PostgreSQL does not store live PTY objects, high-frequency terminal output, keyboard input streams, or reconnectable process handles.

Terminal pane layouts are renderer state and are stored locally. They do not require a database migration and do not affect PTY ownership.

## Commands

| Command              | Purpose                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`           | Run Vite, Electron TypeScript watch mode, and the desktop application         |
| `pnpm build`         | Type-check Electron code and create production renderer assets                |
| `pnpm package`       | Create the unpacked Windows application                                       |
| `pnpm db:create`     | Create the fixed `cmd_workspace` database on an existing PostgreSQL server    |
| `pnpm db:generate`   | Generate an incremental migration from the Drizzle schema                     |
| `pnpm test`          | Run the Vitest unit test suite                                                |
| `pnpm smoke:db`      | Verify migrations, restoration, constraints, ordering, and run reconciliation |
| `pnpm smoke:pty`     | Verify interactive ConPTY behavior, Unicode, resize, and interruption         |
| `pnpm smoke:manager` | Verify multiple terminal lifecycles and stable runtime IDs/PIDs               |
| `pnpm lint`          | Run ESLint                                                                    |
| `pnpm typecheck`     | Type-check renderer, main, and preload code                                   |
| `pnpm format:check`  | Check Prettier formatting                                                     |

Recommended milestone verification:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:db
pnpm smoke:pty
pnpm smoke:manager
```

## Windows packaging

```powershell
pnpm package
```

The current command creates an unpacked application at:

```text
release/win-unpacked/CMD Workspace.exe
```

An installer and code signing are not configured yet. Windows SmartScreen warnings are expected for local unsigned builds.

## Project structure

```text
src/
|-- main/       Electron main process, IPC, PTY management, and run tracking
|-- preload/    Narrow typed contextBridge API
|-- renderer/   React workspace, layouts, and xterm.js views
|-- database/   Drizzle schema, migrations entry point, and repository
+-- shared/     Contracts and validation shared across processes
drizzle/        Auditable PostgreSQL migrations
tests/          Unit tests and PostgreSQL/ConPTY smoke tests
```

## Troubleshooting

### `MSB8040: Spectre-mitigated libraries are required`

Open Visual Studio Installer and add the Spectre-mitigated libraries for the active MSVC toolset and x64 architecture, then run `pnpm install` again.

### `PostgreSQL persistence is unavailable`

Confirm that PostgreSQL is listening on the configured port:

```powershell
Test-NetConnection 127.0.0.1 -Port 5433
docker compose ps
```

Also confirm that the database is named `cmd_workspace` and that `.env` contains the correct connection string.

### `Recreating node_modules` takes a long time

The first installation and native `node-pty` setup can take a while. Confirm that no other `pnpm dev` or Electron process is locking `node_modules`, then retry the installation.

### Do terminals stop when switching projects?

No. Project selection is renderer state only. Switching projects does not invoke stop, kill, restart, or close operations and does not replace live PTY processes.

## Roadmap

- [x] M0: Electron, React, and TypeScript foundation
- [x] M1: Interactive Windows ConPTY terminal
- [x] M2: Project navigation and multiple terminal management
- [x] M3: PostgreSQL persistence and run summaries
- [x] UI phase 1: Compact project sidebar, terminal tabs, and main layout
- [x] UI phase 2: Split terminal workspace, Shell selection, tools, and shortcuts
- [ ] M4: Task orchestration, dependencies, readiness checks, and retry policies
- [ ] M5: Installer, logging, and production recovery workflows

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for detailed milestones and acceptance checks.

## Contributing

Read [`AGENTS.md`](AGENTS.md) before making changes. In particular:

1. Do not spawn processes or connect to the database from the renderer.
2. Do not persist high-frequency PTY output in PostgreSQL.
3. Give every IPC addition an explicit type and runtime validation.
4. Keep migrations incremental and protect existing user data.
5. Run checks and smoke tests appropriate to the changed area before committing.

## License

This repository does not currently include an open-source license. Standard copyright restrictions apply until a suitable `LICENSE` file is added.
