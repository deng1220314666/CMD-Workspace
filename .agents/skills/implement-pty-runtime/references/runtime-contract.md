# Terminal runtime contract

- `TerminalManager` owns PTY objects and bounded output buffers.
- `TerminalProfile` is durable configuration; `TerminalRuntime` is process-local state.
- Renderer views attach by runtime ID and may detach without changing runtime state.
- Commands: create, write, resize, stop, kill, restart, snapshot, list.
- Events: data, status, exit, error. Every event includes `terminalId` and ordered data includes a sequence number.
- A newly attached view receives an atomic snapshot/subscription handshake so output cannot be lost between history replay and live events.
- Normal close requests graceful stop. Force termination happens only after confirmation and must target the confirmed runtime PID and its child tree.

