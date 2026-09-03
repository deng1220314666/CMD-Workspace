export const TERMINAL_DATA_CHANNEL = 'terminal:data'
export const TERMINAL_STATUS_CHANNEL = 'terminal:status'

export type TerminalStatus =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'exited'
  | 'failed'

export type TerminalShell = 'powershell' | 'cmd'

export interface TerminalCreateRequest {
  profileId: string
  cwd: string
  cols: number
  rows: number
  shell: TerminalShell
}

export interface TerminalWriteRequest {
  terminalId: string
  data: string
}

export interface TerminalResizeRequest {
  terminalId: string
  cols: number
  rows: number
}

export interface TerminalIdRequest {
  terminalId: string
}

export type TerminalCloseMode = 'graceful' | 'force'

export interface TerminalCloseRequest extends TerminalIdRequest {
  mode: TerminalCloseMode
  expectedPid: number | null
}

export interface TerminalRestartRequest extends TerminalIdRequest {
  expectedPid: number | null
}

export interface TerminalDataEvent {
  terminalId: string
  sequence: number
  data: string
}

export interface TerminalStatusEvent {
  terminalId: string
  status: TerminalStatus
  pid: number | null
  exitCode?: number
  message?: string
}

export interface TerminalSnapshot {
  terminalId: string
  status: TerminalStatus
  pid: number | null
  cwd: string
  shell: TerminalShell
  output: string
  lastSequence: number
  exitCode?: number
  message?: string
}

export interface TerminalApi {
  create(request: TerminalCreateRequest): Promise<TerminalSnapshot>
  list(): Promise<TerminalSnapshot[]>
  snapshot(request: TerminalIdRequest): Promise<TerminalSnapshot>
  write(request: TerminalWriteRequest): Promise<void>
  resize(request: TerminalResizeRequest): Promise<void>
  stop(request: TerminalIdRequest): Promise<void>
  kill(request: TerminalIdRequest): Promise<void>
  restart(request: TerminalRestartRequest): Promise<TerminalSnapshot>
  close(request: TerminalCloseRequest): Promise<void>
  onData(listener: (event: TerminalDataEvent) => void): () => void
  onStatus(listener: (event: TerminalStatusEvent) => void): () => void
}

export interface AppInfo {
  platform: string
  homeDirectory: string
  environmentError: string | null
  databaseError: string | null
}

export interface ProjectInfo {
  projectId: string
  name: string
  path: string
}

export interface ProjectApi {
  import(): Promise<ProjectInfo | null>
}

export interface ClipboardApi {
  readText(): Promise<string>
  writeText(text: string): Promise<void>
}

export interface CmdWorkspaceApi {
  terminal: TerminalApi
  project: ProjectApi
  clipboard: ClipboardApi
  persistence: import('./persistence').PersistenceApi
  getAppInfo(): Promise<AppInfo>
}
