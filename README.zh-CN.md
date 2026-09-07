# CMD Workspace

[English](README.md) | [简体中文](README.zh-CN.md)

CMD Workspace 是一款 Windows 优先的桌面应用，用于集中管理本地项目及其交互式终端。每个项目可以保留多个正在运行的 PowerShell 或命令提示符会话，切换项目不会终止对应的 PTY 进程。

> 当前版本：`0.1.0`。本地终端工作区和 PostgreSQL 持久化里程碑已经完成；任务编排、代码签名和正式发布流程仍在规划中。

## 功能亮点

- 导入本地项目目录，并通过紧凑、可调整宽度的侧边栏快速切换。
- 为项目添加备注名和用途说明，同时保留真实目录名与路径。
- 为每个项目创建多个独立的 PowerShell 或命令提示符终端。
- 支持终端工作区水平或垂直分屏，并可拖动调整窗格尺寸。
- 支持重命名、排序、启动、重启、切换和关闭终端配置。
- 切换项目、标签或窗格时，保持实时 PTY 和稳定的运行时 ID 不变。
- 支持搜索终端输出、复制选区、粘贴文本和清屏。
- 明确显示 `starting`、`running`、`exited` 和 `failed` 进程状态。
- 关闭或重启仍有活动进程的终端前要求确认。
- 使用 PostgreSQL 持久化项目、终端配置、应用选择状态和运行摘要。
- 应用重启后恢复配置，但不会把历史 PID 当作仍在运行的进程。

## 技术栈

- Electron、React、TypeScript 和 Vite
- xterm.js、node-pty 和 Windows ConPTY
- PostgreSQL、Drizzle ORM 和 SQL migrations
- Vitest、ESLint 和 Prettier
- pnpm

## 架构

```text
React Renderer
  |-- 项目导航和终端布局
  |-- 稳定的 xterm.js 视图注册表
  |-- 仅存在于 Renderer 的选择和分屏状态
  |
  +-- 窄接口、强类型的 contextBridge API
        |
Electron 主进程
  |-- 经过校验的 IPC handlers
  |-- TerminalManager
  |     +-- node-pty / Windows ConPTY
  |     +-- 有界内存输出缓冲区
  |
  +-- PersistenceRepository
        +-- Drizzle ORM / PostgreSQL
```

应用保持以下安全和生命周期边界：

- Renderer 不生成进程、不直接连接 PostgreSQL，也不获取原始 Node.js 权限。
- 保持 `contextIsolation` 开启、`nodeIntegration` 关闭。
- IPC 输入在使用前必须经过运行时校验。
- Shell 选择使用受限标识符，并映射到固定的可执行文件和参数数组。
- 实时终端输出保存在主进程的有界内存中，不持续写入 PostgreSQL。
- PTY 实例归主进程所有，并由稳定的运行时 ID 标识。
- 项目和标签切换只会挂载、隐藏终端视图，不会停止 PTY。

## 系统要求

- Windows 10 或 Windows 11，x64
- Node.js 22 LTS 或更高版本
- pnpm 10；仓库声明版本为 `pnpm@10.15.0`
- Docker Desktop，或可访问的 PostgreSQL 实例

`node-pty` 通常会使用预编译原生模块。如果本机需要从源码编译，请安装以下 Visual Studio Build Tools 组件：

- Desktop development with C++
- 对应的 MSVC 工具集和 Windows SDK
- 与工具集及架构匹配的 Spectre-mitigated libraries

## 快速开始

### 1. 安装依赖

```powershell
corepack enable
pnpm install --frozen-lockfile
```

### 2. 创建本地配置

```powershell
Copy-Item .env.example .env
```

默认开发配置如下：

```dotenv
DATABASE_URL=postgresql://nexus:nexus@127.0.0.1:5433/cmd_workspace?sslmode=disable
DATABASE_TIMEZONE=UTC
REDIS_URL=redis://127.0.0.1:6380/1
```

这些凭据仅用于本地开发，不应直接用于公网或生产数据库。

### 3. 启动本地服务

```powershell
docker compose up -d postgres redis
docker compose ps
```

PostgreSQL 用于保存应用配置和终端运行摘要。Redis 为后续任务编排功能预留，不存储 PTY 输出。

如果 PostgreSQL 已经运行，但尚未创建 `cmd_workspace` 数据库，可以执行：

```powershell
pnpm db:create
```

该命令只允许创建固定名称的 `cmd_workspace` 数据库，不会重置已有数据。

### 4. 启动桌面应用

```powershell
pnpm dev
```

应用启动时会自动执行尚未应用的 Drizzle migrations。

## 使用工作区

1. 点击 **Import project**，选择一个本地项目目录。
2. 使用项目操作按钮添加备注名或用途说明。
3. 点击 **+**，使用当前默认 Shell 创建终端。
4. 点击 **+** 旁边的箭头，明确选择 PowerShell 或命令提示符。
5. 使用分屏按钮或快捷键创建水平、垂直终端窗格。
6. 双击终端标签，或按 `F2`，可以重命名终端。
7. 可以自由切换项目和标签；后台 PTY 会继续运行，缓冲输出仍然保留。
8. 应用重启后，恢复的终端配置处于空闲状态；点击 **Start** 才会创建新的 PTY 和 PID。

## 键盘快捷键

| 快捷键                                     | 功能                           |
| ------------------------------------------ | ------------------------------ |
| `Ctrl+Shift+N`                             | 创建终端                       |
| `Ctrl+Shift+H`                             | 水平分屏                       |
| `Ctrl+Shift+J`                             | 垂直分屏                       |
| `Ctrl+PageUp` / `Ctrl+PageDown`            | 选择上一个或下一个终端标签     |
| `F2`                                       | 重命名当前终端                 |
| `Ctrl+Shift+W`                             | 关闭当前终端                   |
| `Ctrl+F`                                   | 搜索终端输出                   |
| `Ctrl+Shift+C` 或 `Ctrl+Insert`            | 复制选中的终端文本             |
| `Ctrl+V`、`Ctrl+Shift+V` 或 `Shift+Insert` | 将外部剪贴板文本粘贴到当前终端 |
| `Ctrl+Shift+K`                             | 清空终端视口                   |

终端存在文本选区时，`Ctrl+C` 会复制选区；没有选区时，普通 `Ctrl+C` 会发送给正在运行的 PTY，使交互式命令仍能收到中断信号。
右键单击会复制当前选区；没有选区时，则会粘贴外部剪贴板文本。

## 配置优先级

开发模式读取仓库根目录的 `.env`。打包应用先使用内置本地默认值，再按以下来源覆盖；越靠后的来源优先级越高：

1. `CMD Workspace.exe` 同目录下的 `.env`
2. `%APPDATA%\cmd-workspace\.env`
3. 当前进程继承的 Windows 环境变量

因此，解压版应用可以在不重新构建的情况下连接其他 PostgreSQL 实例。

## 数据持久化

Drizzle schema 位于 [`src/database/schema.ts`](src/database/schema.ts)，迁移文件位于 [`drizzle/`](drizzle/)。

| 数据表              | 用途                                       |
| ------------------- | ------------------------------------------ |
| `projects`          | 项目名称、备注、规范化路径和排序           |
| `terminal_profiles` | 终端标题、工作目录、Shell 配置和排序       |
| `terminal_runs`     | 运行状态、诊断 PID、时间、退出码和错误摘要 |
| `tasks`             | 为后续编排功能预留的任务和 readiness 配置  |
| `task_dependencies` | 任务依赖关系和所有权约束                   |
| `application_state` | 小型、带版本的应用选择状态                 |

PostgreSQL 不存储实时 PTY 对象、高频终端输出、键盘输入流或可用于重新连接进程的运行时句柄。

终端窗格布局属于 Renderer 状态，保存在本地，不需要数据库迁移，也不会影响 PTY 所有权。

## 常用命令

| 命令                     | 用途                                                      |
| ------------------------ | --------------------------------------------------------- |
| `pnpm dev`               | 启动 Vite、Electron TypeScript watch 和桌面应用           |
| `pnpm build`             | 检查 Electron 类型并生成生产 Renderer 资源                |
| `pnpm package`           | 生成 Windows 解压版应用                                   |
| `pnpm package:installer` | 生成可安装的 Windows NSIS 安装包                          |
| `pnpm db:create`         | 在现有 PostgreSQL 服务中创建固定的 `cmd_workspace` 数据库 |
| `pnpm db:generate`       | 根据 Drizzle schema 生成增量迁移                          |
| `pnpm test`              | 运行 Vitest 单元测试                                      |
| `pnpm smoke:db`          | 验证迁移、恢复、约束、排序和运行记录修正                  |
| `pnpm smoke:pty`         | 验证交互式 ConPTY、Unicode、resize 和中断行为             |
| `pnpm smoke:manager`     | 验证多终端生命周期及稳定的运行时 ID/PID                   |
| `pnpm lint`              | 运行 ESLint                                               |
| `pnpm typecheck`         | 检查 Renderer、主进程和 Preload 类型                      |
| `pnpm format:check`      | 检查 Prettier 格式                                        |

建议的里程碑验证命令：

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

生成用于本地测试的 Windows 解压版：

```powershell
pnpm package
```

解压版应用位于：

```text
release/win-unpacked/CMD Workspace.exe
```

生成可以直接发送给其他 Windows 用户的安装包：

```powershell
pnpm package:installer
```

NSIS 安装包将生成到类似以下路径：

```text
release/CMD Workspace Setup 0.1.0.exe
```

目前尚未配置代码签名，接收方运行安装包时，Windows SmartScreen 可能提示“未知发布者”。只有在确认安装包来源可信时，才应选择 **更多信息 → 仍要运行**。正式公开分发前建议购买并配置可信的代码签名证书。

## 项目结构

```text
src/
|-- main/       Electron 主进程、IPC、PTY 管理和运行记录
|-- preload/    受限且强类型的 contextBridge API
|-- renderer/   React 工作区、布局和 xterm.js 视图
|-- database/   Drizzle schema、迁移入口和 Repository
+-- shared/     跨进程共享的数据契约与校验
drizzle/        可审查的 PostgreSQL migrations
tests/          单元测试和 PostgreSQL/ConPTY smoke tests
```

## 故障排查

### `MSB8040: 需要 Spectre-mitigated libraries`

打开 Visual Studio Installer，为当前 MSVC 工具集和 x64 架构安装 Spectre-mitigated libraries，然后重新执行 `pnpm install`。

### `PostgreSQL persistence is unavailable`

确认 PostgreSQL 正在监听配置端口：

```powershell
Test-NetConnection 127.0.0.1 -Port 5433
docker compose ps
```

同时确认数据库名称是 `cmd_workspace`，并检查 `.env` 中的连接字符串。

### `Recreating node_modules` 长时间没有变化

首次安装和 `node-pty` 原生模块配置可能需要一些时间。确认没有其他 `pnpm dev` 或 Electron 进程锁定 `node_modules`，然后重试安装。

### 切换项目会停止终端吗？

不会。项目选择只是 Renderer 状态。切换项目不会调用 stop、kill、restart 或 close，也不会替换正在运行的 PTY。

## 路线图

- [x] M0：Electron、React 和 TypeScript 工程基础
- [x] M1：交互式 Windows ConPTY 终端
- [x] M2：项目导航和多终端管理
- [x] M3：PostgreSQL 持久化和运行摘要
- [x] UI 第一阶段：紧凑项目侧边栏、终端标签和主布局
- [x] UI 第二阶段：终端分屏、Shell 选择、工具和快捷键
- [ ] M4：任务编排、依赖、readiness 检查和重试策略
- [ ] M5：代码签名、日志和生产恢复流程

详细里程碑和验收检查见 [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)。

## 参与贡献

开始修改前请阅读 [`AGENTS.md`](AGENTS.md)，尤其需要遵守以下约束：

1. 不要从 Renderer 生成进程或连接数据库。
2. 不要把高频 PTY 输出持久化到 PostgreSQL。
3. 所有新增 IPC 都必须具有明确类型和运行时校验。
4. 保持迁移为增量、可审查，并保护已有用户数据。
5. 提交前运行与改动范围对应的检查和 smoke tests。

## License

仓库目前尚未包含开源许可证。在添加合适的 `LICENSE` 文件前，默认版权限制仍然适用。
