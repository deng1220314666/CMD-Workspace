---
name: implement-pty-runtime
description: Implement or debug interactive terminal behavior with Electron, node-pty, Windows ConPTY, xterm.js, typed IPC, process lifecycle, resizing, and output buffering. Use for terminal runtime work, not ordinary subprocess tasks.
---

# Implement PTY Runtime

Keep all `IPty` instances in an Electron main-process service. The renderer owns presentation only; preload exposes a narrow typed API. Never create or destroy PTYs as a side effect of selecting a project or mounting a React view.

Read [references/runtime-contract.md](references/runtime-contract.md) before implementation or debugging.

Model lifecycle transitions explicitly. Make create, write, resize, graceful stop, force stop, restart, subscribe, unsubscribe, and snapshot retrieval separate operations. Validate terminal IDs and dimensions at the IPC boundary.

Use executable plus argument arrays for internal process control. Preserve raw PTY data, including ANSI sequences, between node-pty and xterm.js.

After changes, verify a short command, failing command, REPL, long-running process, Ctrl+C, resize, rapid project switching, restart, and shutdown. If ConPTY cannot be tested, state that limitation precisely.
