# CMD Workspace engineering instructions

## Product goal

Build a Windows-first desktop application that imports local projects and manages multiple interactive terminals per project. Switching projects must never terminate their running terminal processes.

## Required stack

- Electron, React, TypeScript, Vite
- xterm.js in the renderer
- node-pty in the Electron main process
- PostgreSQL with Drizzle ORM and SQL migrations
- Vitest for unit tests; Playwright for critical Electron flows when practical
- pnpm as the package manager

Do not replace this stack without explicit approval.

## Architectural invariants

- The renderer never spawns processes, connects directly to PostgreSQL, or receives raw Node.js access.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and expose a narrow typed preload API.
- PTY instances and live output buffers belong to the main process and are keyed by stable terminal runtime IDs.
- Project selection is renderer state only. It may attach or detach views but must not kill a PTY.
- PostgreSQL stores configuration and run summaries, not live PTY objects. High-frequency terminal output stays in bounded memory; optional full logs go to files.
- Validate every IPC payload. Resolve working directories and reject missing or invalid project paths.
- Never interpolate user input into `cmd.exe /c`, PowerShell, SQL, or a shell string. Pass executable and arguments separately wherever possible.
- Destructive process-tree termination, project deletion, and database reset require explicit confirmation in the UI.

## Working method

1. Inspect existing files, `git status`, and the current milestone before changing code.
2. For multi-file work, update `IMPLEMENTATION_PLAN.md` with the exact milestone and acceptance checks.
3. Implement one vertical slice at a time. Do not scaffold every future feature before the first terminal works.
4. Preserve user changes and avoid unrelated refactors.
5. Run the narrowest relevant tests during development, then run the milestone verification commands.
6. Review `git diff` and report changed files, tests, and unresolved risks.

## Milestone order

Follow `IMPLEMENTATION_PLAN.md`. Do not implement remote control, authentication, AI features, collaboration, or a background daemon until the local MVP acceptance criteria pass.

## Completion criteria

A task is complete only when its observable behavior works, TypeScript passes, relevant tests pass, and errors are surfaced in the UI without crashing Electron. Do not claim success from compilation alone.

## Project skills

For CMD-Workspace UI implementation, review, or optimization, use:

- `$design-cmd-workspace-ui`

UI work must preserve terminal and PTY lifecycle behavior.
