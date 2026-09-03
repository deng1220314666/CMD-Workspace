import { describe, expect, it } from 'vitest'
import type { PersistedTerminalProfile } from '../src/shared/persistence'
import type { ProjectInfo, TerminalSnapshot } from '../src/shared/terminal'
import {
  addProfile,
  addProject,
  emptyWorkspace,
  moveTerminal,
  removeTerminal,
  renameTerminal,
  selectProject,
  updateProjectAnnotations,
  workspaceFromBootstrap,
} from '../src/renderer/src/workspace-state'

const project = (projectId: string): ProjectInfo => ({
  projectId,
  name: projectId,
  path: `C:\\work\\${projectId}`,
})
const profile = (
  projectId: string,
  profileId: string,
): PersistedTerminalProfile => ({
  profileId,
  projectId,
  displayName: profileId,
  executable: 'powershell.exe',
  arguments: [],
  workingDirectory: `C:\\work\\${projectId}`,
  startupCommand: null,
  autoStart: false,
  restartPolicy: 'never',
  orderIndex: 0,
})
const terminal = (terminalId: string, pid: number): TerminalSnapshot => ({
  terminalId,
  status: 'running',
  pid,
  cwd: 'C:\\work',
  shell: 'powershell',
  output: '',
  lastSequence: 0,
})

describe('workspace state', () => {
  it('switches projects without changing terminal identity or PID', () => {
    let state = addProject(emptyWorkspace, project('project-a'))
    state = addProfile(
      state,
      profile('project-a', 'profile-a'),
      terminal('terminal-a', 101),
    )
    state = addProfile(
      state,
      profile('project-a', 'profile-a2'),
      terminal('terminal-a2', 102),
    )
    state = addProject(state, project('project-b'))
    state = addProfile(
      state,
      profile('project-b', 'profile-b'),
      terminal('terminal-b', 202),
    )
    state = addProfile(
      state,
      profile('project-b', 'profile-b2'),
      terminal('terminal-b2', 203),
    )
    state = selectProject(state, 'project-a')
    state = selectProject(state, 'project-b')
    state = selectProject(state, 'project-a')

    expect(state.projects[0].terminals[0].runtime?.pid).toBe(101)
    expect(state.projects[1].terminals[0].runtime?.pid).toBe(202)
    expect(state.projects[0].activeProfileId).toBe('profile-a2')
    expect(state.projects[1].activeProfileId).toBe('profile-b2')
  })

  it('restores profiles as idle and never restores a stored runtime PID', () => {
    const state = workspaceFromBootstrap({
      projects: [
        {
          ...project('project-a'),
          remarkName: 'API',
          purpose: 'Serves the desktop client',
          orderIndex: 0,
          profiles: [profile('project-a', 'profile-a')],
        },
      ],
      selection: {
        activeProjectId: 'project-a',
        activeProfileIds: { 'project-a': 'profile-a' },
      },
    })
    expect(state.projects[0].terminals[0].runtime).toBeNull()
    expect(state.projects[0].activeProfileId).toBe('profile-a')
    expect(state.projects[0].remarkName).toBe('API')
  })

  it('updates project annotations without changing project identity', () => {
    const state = updateProjectAnnotations(
      addProject(emptyWorkspace, project('project-a')),
      'project-a',
      { remarkName: 'Checkout', purpose: 'Processes customer payments' },
    )
    expect(state.projects[0]).toMatchObject({
      projectId: 'project-a',
      name: 'project-a',
      remarkName: 'Checkout',
      purpose: 'Processes customer payments',
    })
  })

  it('reorders and closes profiles while selecting a surviving neighbor', () => {
    let state = addProject(emptyWorkspace, project('project-a'))
    state = addProfile(state, profile('project-a', 'profile-a'))
    state = addProfile(state, profile('project-a', 'profile-b'))
    state = renameTerminal(state, 'project-a', 'profile-b', 'API server')
    expect(state.projects[0].terminals[1].title).toBe('API server')
    state = moveTerminal(state, 'project-a', 'profile-b', -1)
    expect(state.projects[0].terminals[0].profileId).toBe('profile-b')
    state = removeTerminal(state, 'project-a', 'profile-b')
    expect(state.projects[0].activeProfileId).toBe('profile-a')
  })
})
