---
name: build-command-orchestration
description: Implement or review CMD-Workspace command presets, task orchestration, process groups, startup profiles, retries, logs, environment variables, and project script detection.
---

# Command Orchestration

Implement reliable command scheduling for CMD-Workspace.

## Invariants

- Commands must execute through the existing PTY/process service.
- Renderer processes must never spawn operating-system commands directly.
- Command arguments must remain structured instead of being concatenated into unsafe shell strings.
- Every process must belong to a project, terminal and task execution.
- Parallel tasks must be independently stoppable.
- Stopping a task group must terminate its complete process tree.
- Never expose secrets in logs.
- Never execute imported project commands automatically without user confirmation.

## Workflow

1. Inspect existing PTY, IPC, process registry and persistence code.
2. Define task states and transitions before implementation.
3. Separate task definitions from task executions.
4. Keep process lifecycle in the Electron main process.
5. Persist configuration but not sensitive environment-variable values.
6. Add validation for working directories and executable paths.
7. Test success, failure, cancellation, retry and application restart.

## Task states

- pending
- starting
- running
- succeeded
- failed
- stopping
- stopped

## Verification

- Run tasks sequentially and concurrently.
- Stop individual tasks and complete groups.
- Verify process-tree cleanup.
- Verify malformed commands are rejected.
- Verify secrets are masked.
- Run lint, type checking and tests.

## Project detection

Never assume that an imported project is a Node.js project.

Detect project types using marker files and registered project adapters.

Supported initial adapters:

- Node.js package managers
- Java Maven and Maven Wrapper
- Java Gradle and Gradle Wrapper
- Python
- Go
- .NET
- Docker Compose

A workspace may contain multiple independently runnable subprojects.

## Java rules

For Maven projects:

- Prefer `mvnw.cmd` on Windows when available.
- Use system Maven only when the wrapper is unavailable.
- Do not recommend `spring-boot:run` unless Spring Boot is detected.
- Detect Maven modules and identify executable modules.
- Detect the required JDK version before execution.

For Gradle projects:

- Prefer `gradlew.bat` on Windows.
- Inspect available Gradle tasks.
- Use `bootRun` only when the task exists.
- Detect multi-project builds and runnable subprojects.

## Execution safety

- Detection may inspect files but must not execute detected commands.
- First execution of a detected command requires user confirmation.
- Store executable and arguments separately.
- Treat repository build scripts as untrusted code.
- Never interpolate untrusted input into a shell command string.
- Do not expose secrets in command previews or logs.
