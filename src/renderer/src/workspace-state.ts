import type {
  PersistedTerminalProfile,
  WorkspaceBootstrap,
  WorkspaceSelection,
} from '../../shared/persistence'
import type {
  ProjectInfo,
  TerminalShell,
  TerminalSnapshot,
} from '../../shared/terminal'

export interface TerminalTab {
  profileId: string
  title: string
  cwd: string
  shell: TerminalShell
  runtime: TerminalSnapshot | null
}

export interface WorkspaceProject extends ProjectInfo {
  remarkName: string | null
  purpose: string | null
  terminals: TerminalTab[]
  activeProfileId: string | null
}

export interface WorkspaceState {
  projects: WorkspaceProject[]
  activeProjectId: string | null
}

export const emptyWorkspace: WorkspaceState = {
  projects: [],
  activeProjectId: null,
}

export function workspaceFromBootstrap(
  bootstrap: WorkspaceBootstrap,
): WorkspaceState {
  return {
    projects: bootstrap.projects.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      remarkName: project.remarkName,
      purpose: project.purpose,
      path: project.path,
      terminals: project.profiles.map(profileToTab),
      activeProfileId:
        bootstrap.selection.activeProfileIds[project.projectId] ??
        project.profiles[0]?.profileId ??
        null,
    })),
    activeProjectId:
      bootstrap.selection.activeProjectId ??
      bootstrap.projects[0]?.projectId ??
      null,
  }
}

export function selectionFromWorkspace(
  state: WorkspaceState,
): WorkspaceSelection {
  return {
    activeProjectId: state.activeProjectId,
    activeProfileIds: Object.fromEntries(
      state.projects.map((project) => [
        project.projectId,
        project.activeProfileId,
      ]),
    ),
  }
}

export function addProject(
  state: WorkspaceState,
  project: ProjectInfo,
): WorkspaceState {
  const existing = state.projects.find(
    (candidate) => candidate.projectId === project.projectId,
  )
  if (existing) return { ...state, activeProjectId: existing.projectId }
  return {
    projects: [
      ...state.projects,
      {
        ...project,
        remarkName: null,
        purpose: null,
        terminals: [],
        activeProfileId: null,
      },
    ],
    activeProjectId: project.projectId,
  }
}

export function updateProjectAnnotations(
  state: WorkspaceState,
  projectId: string,
  annotations: { remarkName: string | null; purpose: string | null },
): WorkspaceState {
  return mapProject(state, projectId, (project) => ({
    ...project,
    ...annotations,
  }))
}

export function addProfile(
  state: WorkspaceState,
  profile: PersistedTerminalProfile,
  runtime: TerminalSnapshot | null = null,
  select = true,
): WorkspaceState {
  return mapProject(state, profile.projectId, (project) => ({
    ...project,
    terminals: [...project.terminals, { ...profileToTab(profile), runtime }],
    activeProfileId:
      select || !project.activeProfileId
        ? profile.profileId
        : project.activeProfileId,
  }))
}

export function attachRuntime(
  state: WorkspaceState,
  profileId: string,
  runtime: TerminalSnapshot | null,
): WorkspaceState {
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      terminals: project.terminals.map((tab) =>
        tab.profileId === profileId ? { ...tab, runtime } : tab,
      ),
    })),
  }
}

export function selectProject(
  state: WorkspaceState,
  projectId: string,
): WorkspaceState {
  return state.projects.some((project) => project.projectId === projectId)
    ? { ...state, activeProjectId: projectId }
    : state
}

export function selectTerminal(
  state: WorkspaceState,
  projectId: string,
  profileId: string,
): WorkspaceState {
  return mapProject(state, projectId, (project) =>
    project.terminals.some((tab) => tab.profileId === profileId)
      ? { ...project, activeProfileId: profileId }
      : project,
  )
}

export function renameTerminal(
  state: WorkspaceState,
  projectId: string,
  profileId: string,
  title: string,
): WorkspaceState {
  const trimmed = title.trim()
  if (!trimmed) return state
  return mapProject(state, projectId, (project) => ({
    ...project,
    terminals: project.terminals.map((tab) =>
      tab.profileId === profileId ? { ...tab, title: trimmed } : tab,
    ),
  }))
}

export function moveTerminal(
  state: WorkspaceState,
  projectId: string,
  profileId: string,
  offset: -1 | 1,
): WorkspaceState {
  return mapProject(state, projectId, (project) => {
    const index = project.terminals.findIndex(
      (tab) => tab.profileId === profileId,
    )
    const destination = index + offset
    if (index < 0 || destination < 0 || destination >= project.terminals.length)
      return project
    const terminals = [...project.terminals]
    ;[terminals[index], terminals[destination]] = [
      terminals[destination],
      terminals[index],
    ]
    return { ...project, terminals }
  })
}

export function updateTerminal(
  state: WorkspaceState,
  terminalId: string,
  update: Partial<TerminalSnapshot>,
): WorkspaceState {
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      terminals: project.terminals.map((tab) =>
        tab.runtime?.terminalId === terminalId
          ? { ...tab, runtime: { ...tab.runtime, ...update } }
          : tab,
      ),
    })),
  }
}

export function removeTerminal(
  state: WorkspaceState,
  projectId: string,
  profileId: string,
): WorkspaceState {
  return mapProject(state, projectId, (project) => {
    const removedIndex = project.terminals.findIndex(
      (tab) => tab.profileId === profileId,
    )
    const terminals = project.terminals.filter(
      (tab) => tab.profileId !== profileId,
    )
    const activeProfileId =
      project.activeProfileId === profileId
        ? (terminals[Math.min(Math.max(removedIndex, 0), terminals.length - 1)]
            ?.profileId ?? null)
        : project.activeProfileId
    return { ...project, terminals, activeProfileId }
  })
}

function profileToTab(profile: PersistedTerminalProfile): TerminalTab {
  return {
    profileId: profile.profileId,
    title: profile.displayName,
    cwd: profile.workingDirectory,
    shell: profile.executable.toLowerCase().endsWith('cmd.exe')
      ? 'cmd'
      : 'powershell',
    runtime: null,
  }
}

function mapProject(
  state: WorkspaceState,
  projectId: string,
  update: (project: WorkspaceProject) => WorkspaceProject,
): WorkspaceState {
  return {
    ...state,
    projects: state.projects.map((project) =>
      project.projectId === projectId ? update(project) : project,
    ),
  }
}
