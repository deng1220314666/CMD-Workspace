export interface PersistedTerminalProfile {
  profileId: string
  projectId: string
  displayName: string
  executable: string
  arguments: string[]
  workingDirectory: string
  startupCommand: string | null
  autoStart: boolean
  restartPolicy: 'never' | 'on-failure' | 'always'
  orderIndex: number
}

export interface PersistedProject {
  projectId: string
  name: string
  remarkName: string | null
  purpose: string | null
  path: string
  orderIndex: number
  profiles: PersistedTerminalProfile[]
}

export interface WorkspaceSelection {
  activeProjectId: string | null
  activeProfileIds: Record<string, string | null>
}

export interface WorkspaceBootstrap {
  projects: PersistedProject[]
  selection: WorkspaceSelection
}

export interface ProfileCreateRequest {
  projectId: string
  displayName: string
  workingDirectory: string
}

export interface ProfileRenameRequest {
  profileId: string
  displayName: string
}

export interface ProfileReorderRequest {
  projectId: string
  orderedProfileIds: string[]
}

export interface ProfileDeleteRequest {
  profileId: string
}

export interface ProjectAnnotationUpdateRequest {
  projectId: string
  remarkName: string | null
  purpose: string | null
}

export type SelectionSaveRequest = WorkspaceSelection

export interface PersistenceApi {
  loadWorkspace(): Promise<WorkspaceBootstrap>
  updateProjectAnnotations(
    request: ProjectAnnotationUpdateRequest,
  ): Promise<void>
  createProfile(
    request: ProfileCreateRequest,
  ): Promise<PersistedTerminalProfile>
  renameProfile(request: ProfileRenameRequest): Promise<void>
  reorderProfiles(request: ProfileReorderRequest): Promise<void>
  deleteProfile(request: ProfileDeleteRequest): Promise<void>
  saveSelection(request: SelectionSaveRequest): Promise<void>
}
