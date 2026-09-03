# CMD Workspace

面向 Windows 的本地项目终端工作台。把常用项目集中到一个桌面应用中，为每个项目维护多个真实的交互式 PowerShell 终端；切换项目时，后台终端和 PID 保持不变。

> 当前版本：`0.1.0`，完成 M0–M3。项目调度器、任务依赖启动和产品化安装器仍在开发中。

## 为什么做这个项目

同时开发多个本地项目时，终端窗口很快会散落在桌面各处。CMD Workspace 将“项目”和“终端会话”组织在同一个工作台中：项目负责上下文，终端继续作为完整的交互式 shell 工作。

它不是命令执行器，也不会在切换项目时重新创建进程。PTY 生命周期属于 Electron 主进程，项目切换只会分离和重新挂载界面。

## 功能

- 导入本地项目目录，并在左侧项目栏快速切换。
- 为项目添加备注名和用途说明，同时保留真实目录名及路径。
- 每个项目创建多个独立 PowerShell 终端。
- 重命名、排序、启动、重启和关闭终端标签。
- 切换项目时保持现有 PTY 和 PID，不中断后台输出。
- 使用 xterm.js 支持 ANSI、Unicode、输入、窗口 resize 和 `Ctrl+C`。
- 关闭或重启运行中的进程前显示明确确认。
- 使用 PostgreSQL 持久化项目、终端配置、应用选择状态和运行摘要。
- 应用异常退出后，将遗留的运行记录标记为 `interrupted`。
- 应用重启后恢复项目和终端配置，但不会把历史 PID 当作仍在运行的进程。

## 技术栈

- Electron、React、TypeScript、Vite
- xterm.js、node-pty、Windows ConPTY
- PostgreSQL、Drizzle ORM、SQL migrations
- Vitest、ESLint、Prettier
- pnpm

## 架构

```text
┌──────────────────────── Renderer ────────────────────────┐
│ React workspace / xterm.js / transient selection state │
└──────────────────────────┬───────────────────────────────┘
                           │ narrow typed IPC
                    context-isolated preload
                           │
┌──────────────── Electron main process ──────────────────┐
│ validated IPC                                            │
│ TerminalManager ── node-pty / ConPTY                    │
│ bounded output buffers                                   │
│ PersistenceRepository ── Drizzle ORM                    │
└─────────────────────┬───────────────────┬────────────────┘
                      │                   │
               live PTY processes   PostgreSQL config
                                    and run summaries
```

安全边界：

- Renderer 不生成进程、不直接连接 PostgreSQL，也没有原始 Node.js 权限。
- `contextIsolation` 保持开启，`nodeIntegration` 保持关闭。
- 所有 IPC 输入均经过 Zod 校验。
- 实时终端输出只保存在主进程的有界内存中，不持续写入 PostgreSQL。
- 数据库中的 PID 仅用于诊断，应用启动时不会尝试重新连接旧 PID。

## 系统要求

- Windows 10/11 x64
- Node.js 22 LTS 或更高版本
- pnpm 10（仓库声明版本为 `10.15.0`）
- Docker Desktop，或一个可访问的 PostgreSQL 实例

`node-pty` 通常可以使用预编译模块。如果本机需要源码编译，还需要 Visual Studio Build Tools 的以下组件：

- Desktop development with C++
- MSVC 工具集和 Windows SDK
- 对应工具集及架构的 Spectre-mitigated libraries

## 快速开始

### 1. 安装依赖

```powershell
corepack enable
pnpm install --frozen-lockfile
```

### 2. 准备配置

```powershell
Copy-Item .env.example .env
```

默认开发配置：

```dotenv
DATABASE_URL=postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable
DATABASE_TIMEZONE=UTC
REDIS_URL=redis://127.0.0.1:6380/1
```

这些是仅用于本地开发的 Compose 凭据，不应直接用于生产环境或公网数据库。

### 3. 启动本地服务

```powershell
docker compose up -d postgres redis
docker compose ps
```

Compose 会创建独立的 `cmd_workspace` 数据库。Redis 当前仅作为开发环境中的预留服务，不承载 PTY 输出或 M3 持久化数据。

如果你连接的是已经运行、但尚未创建 `cmd_workspace` 的 PostgreSQL，可以执行：

```powershell
pnpm db:create
```

该命令只允许创建固定名称的 `cmd_workspace` 数据库，不会重置已有数据库。

### 4. 启动应用

```powershell
pnpm dev
```

应用启动时会自动执行尚未应用的 Drizzle migration。

## 使用方式

1. 点击左下角 **Import project**，选择一个本地目录。
2. 使用项目右侧的 **✎** 设置备注名和项目用途。
3. 点击终端栏中的 **+** 为当前项目创建更多终端。
4. 双击终端标签可修改标签名。
5. 在左侧切换项目。后台 PTY 会继续运行，重新进入项目后会恢复缓冲输出。
6. 应用重启后，项目和终端配置会恢复为 `idle`；点击 **Start** 才会创建新的 PTY 和 PID。

## 配置优先级

开发模式读取仓库根目录的 `.env`。打包版本使用本地默认值，并按以下顺序覆盖：

1. `CMD Workspace.exe` 同目录的 `.env`
2. `%APPDATA%\cmd-workspace\.env`
3. 当前进程的 Windows 环境变量

后面的配置优先级更高。因此，打包版可以直接双击运行，也可以在不重新打包的情况下连接其他 PostgreSQL 实例。

## 数据持久化

Drizzle schema 位于 [`src/database/schema.ts`](src/database/schema.ts)，迁移位于 [`drizzle/`](drizzle/)。当前数据包括：

| 表                  | 内容                                       |
| ------------------- | ------------------------------------------ |
| `projects`          | 项目名称、备注、用途、规范化路径及排序     |
| `terminal_profiles` | 终端显示名、工作目录、启动配置及排序       |
| `terminal_runs`     | 运行状态、诊断 PID、时间、退出码及错误摘要 |
| `tasks`             | 后续调度器使用的任务与 readiness 配置      |
| `task_dependencies` | 任务依赖关系和所有权约束                   |
| `application_state` | 版本化的小型界面状态                       |

不会写入 PostgreSQL 的内容：

- PTY 实例
- 实时终端输出
- 键盘输入流
- 可用于重新连接进程的运行时对象

## 常用命令

| 命令                 | 作用                                            |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | 启动 Vite、Electron TypeScript watch 和桌面应用 |
| `pnpm build`         | 类型编译并生成生产资源                          |
| `pnpm package`       | 生成 unpacked Windows 应用                      |
| `pnpm db:create`     | 为已有 PostgreSQL 创建 `cmd_workspace` 数据库   |
| `pnpm db:generate`   | 根据 Drizzle schema 生成增量迁移                |
| `pnpm test`          | 运行 Vitest 单元测试                            |
| `pnpm smoke:db`      | 验证迁移、恢复、约束、级联和运行 reconciliation |
| `pnpm smoke:pty`     | 验证真实 ConPTY、REPL、Unicode、resize 和中断   |
| `pnpm smoke:manager` | 验证多终端生命周期和 PID 稳定性                 |
| `pnpm lint`          | 运行 ESLint                                     |
| `pnpm typecheck`     | 检查 renderer、main 和 preload 类型             |
| `pnpm format:check`  | 检查 Prettier 格式                              |

完整验收：

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

## Windows 打包

```powershell
pnpm package
```

当前命令生成目录版应用：

```text
release/win-unpacked/CMD Workspace.exe
```

目前尚未生成安装器，也没有代码签名。Windows SmartScreen 对本地构建给出提示是预期行为。

## 项目结构

```text
src/
├─ main/       Electron 主进程、IPC、PTY 和运行记录协调
├─ preload/    类型受限的 contextBridge API
├─ renderer/   React 工作台和 xterm.js 视图
├─ database/   Drizzle schema、迁移入口和 Repository
└─ shared/     main/preload/renderer 共享的数据契约与校验
drizzle/       可审查、可重复执行的 PostgreSQL migrations
tests/         单元测试及 PostgreSQL/ConPTY smoke tests
```

## 故障排查

### `MSB8040: 此项目需要缓解了 Spectre 漏洞的库`

打开 Visual Studio Installer，在 **单个组件** 中为当前 MSVC 工具集和 x64 架构安装 Spectre-mitigated libraries，然后重新执行 `pnpm install`。

### `PostgreSQL persistence is unavailable`

确认 PostgreSQL 正在监听配置的端口：

```powershell
Test-NetConnection 127.0.0.1 -Port 5433
docker compose ps
```

同时检查数据库名是否为 `cmd_workspace`，并确认 `.env` 中的连接信息正确。

### `Recreating node_modules` 长时间没有变化

首次安装和 `node-pty` 原生模块处理可能需要一些时间。先确认没有其他 `pnpm dev` 或 Electron 进程锁定 `node_modules`，再重新运行安装命令。

### 切换项目后终端是否会停止？

不会。项目选择只是 Renderer 状态。切换项目不会调用 stop、kill、restart 或 close，也不会更换正在运行的 PTY PID。

## Roadmap

- [x] M0：Electron/React/TypeScript 工程基础
- [x] M1：真实交互式 ConPTY 终端
- [x] M2：项目导入和多终端管理
- [x] M3：PostgreSQL 持久化和运行摘要
- [ ] M4：任务调度、依赖、readiness 和重试策略
- [ ] M5：安装器、日志、快捷键和异常恢复体验

详细计划见 [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)。

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始开发前请阅读 [`AGENTS.md`](AGENTS.md) 中的架构约束，并遵循以下原则：

1. 不要在 Renderer 中生成进程或连接数据库。
2. 不要把实时 PTY 输出持续写入 PostgreSQL。
3. 所有新增 IPC 都必须有明确类型和运行时校验。
4. 保持 migration 增量、可审查，并保护已有用户数据。
5. 提交前运行与改动范围对应的测试和 smoke test。

## License

仓库目前尚未包含开源许可证。在公开发布或接受外部贡献前，请选择并添加适合项目的 `LICENSE` 文件；在此之前，默认版权法仍然适用。
