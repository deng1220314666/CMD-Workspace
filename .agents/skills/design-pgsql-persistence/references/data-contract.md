# Persistence contract

- `projects`: name, normalized local path, default shell, environment references, ordering, timestamps.
- `terminal_profiles`: project, display name, executable, arguments, working directory, startup command, environment references, auto-start, restart policy, ordering.
- `terminal_runs`: profile, application instance ID, diagnostic OS PID, state, timestamps, exit code, error summary, optional log path.
- `tasks`: project, profile, readiness configuration, timeout, retry policy, stop policy.
- `task_dependencies`: task and prerequisite; reject self-dependencies and cycles.
- `application_state`: small versioned UI preferences.
- Normalize paths for comparison while retaining a Windows display path.
- Use UUID keys and `timestamptz`.
- Valid run states: starting, running, stopping, exited, failed, interrupted.
- Retries create new run records.
- Do not persist plaintext secrets; use OS credential storage or secret references.

