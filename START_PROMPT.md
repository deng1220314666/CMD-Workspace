# Codex CLI start prompt

Use `$build-cmd-workspace` to implement milestone M0 and M1 from `IMPLEMENTATION_PLAN.md`.

Before editing, inspect the repository and state any conflicts with `AGENTS.md`. Then implement only M0 and M1 as complete vertical slices. Use `$implement-pty-runtime` for the terminal boundary and `$verify-cmd-workspace` before finishing.

Requirements:

- Do not implement PostgreSQL business tables or the scheduler yet; only provide the development PostgreSQL service and environment validation required by M0.
- Do not mock terminal behavior. Use a real node-pty process and xterm.js.
- Keep the PTY alive when the visible terminal component rerenders.
- Run installation, lint, typecheck, tests, and a practical development smoke check.
- Stop and explain if Windows-specific ConPTY behavior cannot be verified in the current environment.
- Finish with changed files, commands run, test results, and remaining Windows verification steps.
