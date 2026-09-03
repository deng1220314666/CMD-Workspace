# Product contract

- The left sidebar lists imported projects; selecting one displays only that project's terminal tabs.
- Each project remembers its selected terminal.
- Project switching never stops, restarts, or recreates a live terminal.
- Terminal tabs expose starting, running, stopping, exited, and failed states.
- Closing a live terminal asks whether to stop gracefully or force-kill its process tree.
- Windows is first; use platform adapters so other platforms remain possible.
- Local folders only until remote support is explicitly requested.
- A scheduled task combines a terminal profile, readiness condition, dependencies, retry policy, and stop policy.
- Validate dependency cycles before starting. Downstream tasks wait for readiness, not only PID creation.
- Every wait has a timeout and cancellation path.

