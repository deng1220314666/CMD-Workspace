import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppInfo,
  TerminalCloseMode,
  TerminalShell,
  TerminalStatusEvent,
} from '../../shared/terminal'
import { ProjectSidebar } from './components/ProjectSidebar'
import { TerminalWorkspace } from './components/TerminalWorkspace'
import { isLiveStatus } from './components/terminal-status'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import {
  addProfile,
  addProject,
  attachRuntime,
  emptyWorkspace,
  moveTerminal,
  removeTerminal,
  renameTerminal,
  selectionFromWorkspace,
  selectProject,
  selectTerminal,
  updateTerminal,
  updateProjectAnnotations,
  workspaceFromBootstrap,
  type TerminalTab,
  type WorkspaceProject,
} from './workspace-state'

interface PendingAction {
  kind: 'close' | 'restart'
  projectId: string
  tab: TerminalTab
}

interface ProjectEditor {
  projectId: string
  remarkName: string
  purpose: string
}

export function App() {
  const [workspace, setWorkspace] = useState(emptyWorkspace)
  const [hydrated, setHydrated] = useState(false)
  const [persistenceReady, setPersistenceReady] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [projectEditor, setProjectEditor] = useState<ProjectEditor | null>(null)
  const reportError = useCallback((message: string) => setError(message), [])

  const activeProject = useMemo(
    () =>
      workspace.projects.find(
        (project) => project.projectId === workspace.activeProjectId,
      ) ?? null,
    [workspace],
  )
  const activeTab =
    activeProject?.terminals.find(
      (tab) => tab.profileId === activeProject.activeProfileId,
    ) ?? null
  const selectionSignature = JSON.stringify(selectionFromWorkspace(workspace))

  useEffect(() => {
    let active = true
    const unsubscribe = window.cmdWorkspace.terminal.onStatus(
      (event: TerminalStatusEvent) => {
        if (!active) return
        setWorkspace((current) =>
          updateTerminal(current, event.terminalId, event),
        )
        if (event.message) setError(event.message)
      },
    )
    void window.cmdWorkspace
      .getAppInfo()
      .then(async (info) => {
        if (!active) return
        setAppInfo(info)
        if (info.databaseError || info.environmentError) {
          setHydrated(true)
          return
        }
        const bootstrap = await window.cmdWorkspace.persistence.loadWorkspace()
        if (!active) return
        setWorkspace(workspaceFromBootstrap(bootstrap))
        setPersistenceReady(true)
        setHydrated(true)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setHydrated(true)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !persistenceReady) return
    const timer = window.setTimeout(() => {
      void window.cmdWorkspace.persistence
        .saveSelection(JSON.parse(selectionSignature))
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : String(reason)),
        )
    }, 150)
    return () => window.clearTimeout(timer)
  }, [hydrated, persistenceReady, selectionSignature])

  const startTerminal = async (tab: TerminalTab) => {
    const runtime = await window.cmdWorkspace.terminal.create({
      profileId: tab.profileId,
      cwd: tab.cwd,
      cols: 100,
      rows: 30,
      shell: tab.shell,
    })
    setWorkspace((current) => attachRuntime(current, tab.profileId, runtime))
  }

  const createTerminal = async (
    project: WorkspaceProject,
    shell: TerminalShell = 'powershell',
    select = true,
  ): Promise<string | null> => {
    setBusy(true)
    setError(null)
    try {
      const profile = await window.cmdWorkspace.persistence.createProfile({
        projectId: project.projectId,
        displayName: `${shell === 'cmd' ? 'Command Prompt' : 'PowerShell'} ${project.terminals.length + 1}`,
        workingDirectory: project.path,
        shell,
      })
      setWorkspace((current) => addProfile(current, profile, null, select))
      await startTerminal({
        profileId: profile.profileId,
        title: profile.displayName,
        cwd: profile.workingDirectory,
        shell,
        runtime: null,
      })
      return profile.profileId
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return null
    } finally {
      setBusy(false)
    }
  }

  const importProject = async () => {
    setBusy(true)
    setError(null)
    try {
      const imported = await window.cmdWorkspace.project.import()
      if (!imported) return
      const existing = workspace.projects.find(
        (project) => project.projectId === imported.projectId,
      )
      setWorkspace((current) => addProject(current, imported))
      if (!existing)
        await createTerminal(
          {
            ...imported,
            remarkName: null,
            purpose: null,
            terminals: [],
            activeProfileId: null,
          },
          'powershell',
        )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const performClose = async (
    projectId: string,
    tab: TerminalTab,
    mode: TerminalCloseMode,
  ) => {
    setBusy(true)
    setError(null)
    try {
      if (tab.runtime)
        await window.cmdWorkspace.terminal.close({
          terminalId: tab.runtime.terminalId,
          mode,
          expectedPid: tab.runtime.pid,
        })
      await window.cmdWorkspace.persistence.deleteProfile({
        profileId: tab.profileId,
      })
      setWorkspace((current) =>
        removeTerminal(current, projectId, tab.profileId),
      )
      setPendingAction(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const requestClose = (projectId: string, tab: TerminalTab) => {
    if (isLiveStatus(tab.runtime?.status))
      setPendingAction({ kind: 'close', projectId, tab })
    else void performClose(projectId, tab, 'graceful')
  }

  const performRestart = async (tab: TerminalTab) => {
    setBusy(true)
    setError(null)
    try {
      if (!tab.runtime) {
        await startTerminal(tab)
      } else {
        const runtime = await window.cmdWorkspace.terminal.restart({
          terminalId: tab.runtime.terminalId,
          expectedPid: tab.runtime.pid,
        })
        setWorkspace((current) =>
          attachRuntime(current, tab.profileId, runtime),
        )
      }
      setPendingAction(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const requestRestart = (projectId: string, tab: TerminalTab) => {
    if (isLiveStatus(tab.runtime?.status))
      setPendingAction({ kind: 'restart', projectId, tab })
    else void performRestart(tab)
  }

  const finishRename = async (projectId: string, profileId: string) => {
    const title = draftTitle.trim()
    setEditingProfileId(null)
    if (!title) return
    const previous = workspace
    setWorkspace((current) =>
      renameTerminal(current, projectId, profileId, title),
    )
    try {
      await window.cmdWorkspace.persistence.renameProfile({
        profileId,
        displayName: title,
      })
    } catch (reason) {
      setWorkspace(previous)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const persistMove = async (
    project: WorkspaceProject,
    tab: TerminalTab,
    offset: -1 | 1,
  ) => {
    const next = moveTerminal(
      workspace,
      project.projectId,
      tab.profileId,
      offset,
    )
    setWorkspace(next)
    const reordered = next.projects.find(
      (candidate) => candidate.projectId === project.projectId,
    )
    if (!reordered) return
    try {
      await window.cmdWorkspace.persistence.reorderProfiles({
        projectId: project.projectId,
        orderedProfileIds: reordered.terminals.map((item) => item.profileId),
      })
    } catch (reason) {
      setWorkspace(workspace)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const saveProjectAnnotations = async () => {
    if (!projectEditor) return
    setBusy(true)
    setError(null)
    const remarkName = projectEditor.remarkName.trim() || null
    const purpose = projectEditor.purpose.trim() || null
    try {
      await window.cmdWorkspace.persistence.updateProjectAnnotations({
        projectId: projectEditor.projectId,
        remarkName,
        purpose,
      })
      setWorkspace((current) =>
        updateProjectAnnotations(current, projectEditor.projectId, {
          remarkName,
          purpose,
        }),
      )
      setProjectEditor(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <WorkspaceLayout
      sidebar={
        <ProjectSidebar
          projects={workspace.projects}
          activeProjectId={workspace.activeProjectId}
          hydrated={hydrated}
          busy={busy}
          platform={appInfo?.platform}
          onSelectProject={(projectId) =>
            setWorkspace((current) => selectProject(current, projectId))
          }
          onEditProject={(project) =>
            setProjectEditor({
              projectId: project.projectId,
              remarkName: project.remarkName ?? '',
              purpose: project.purpose ?? '',
            })
          }
          onImportProject={() => void importProject()}
        />
      }
    >
      <section className="workbench">
        {(appInfo?.databaseError ?? appInfo?.environmentError) && (
          <div className="environment-note">
            {appInfo?.databaseError ?? appInfo?.environmentError}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {!hydrated ? (
          <div className="empty-workspace">
            <p className="eyebrow">LOADING WORKSPACE</p>
            <h1>Reading PostgreSQL configuration…</h1>
          </div>
        ) : !activeProject ? (
          <div className="empty-workspace">
            <p className="eyebrow">NO PROJECT ATTACHED</p>
            <h1>Bring a local project into focus.</h1>
            <p>
              Projects and terminal profiles persist across app restarts. Live
              processes do not.
            </p>
            <button
              className="primary-button"
              onClick={() => void importProject()}
              disabled={busy}
            >
              Import project
            </button>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div className="project-heading">
                <p className="eyebrow">
                  {activeProject.remarkName
                    ? activeProject.name
                    : 'LOCAL PROJECT'}
                </p>
                <h1>{activeProject.remarkName ?? activeProject.name}</h1>
                {activeProject.purpose && (
                  <p className="project-purpose">{activeProject.purpose}</p>
                )}
                <p>{activeProject.path}</p>
              </div>
              <div className="session-readout">
                <div>
                  <span>Process</span>
                  <strong>PID {activeTab?.runtime?.pid ?? '—'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong
                    className={`state-${activeTab?.runtime?.status ?? 'idle'}`}
                  >
                    <i aria-hidden="true" />
                    {activeTab?.runtime?.status ?? 'idle'}
                  </strong>
                </div>
              </div>
            </header>

            <TerminalWorkspace
              projects={workspace.projects}
              project={activeProject}
              busy={busy}
              editingProfileId={editingProfileId}
              draftTitle={draftTitle}
              onSelect={(profileId) =>
                setWorkspace((current) =>
                  selectTerminal(current, activeProject.projectId, profileId),
                )
              }
              onBeginRename={(tab) => {
                setDraftTitle(tab.title)
                setEditingProfileId(tab.profileId)
              }}
              onDraftTitleChange={setDraftTitle}
              onFinishRename={(profileId) =>
                void finishRename(activeProject.projectId, profileId)
              }
              onCancelRename={() => setEditingProfileId(null)}
              onMove={(tab, offset) =>
                void persistMove(activeProject, tab, offset)
              }
              onClose={(tab) => requestClose(activeProject.projectId, tab)}
              onCreate={(shell, select) =>
                createTerminal(activeProject, shell, select)
              }
              onStart={(tab) => void performRestart(tab)}
              onRestart={(tab) => requestRestart(activeProject.projectId, tab)}
              onError={reportError}
            />
          </>
        )}
      </section>

      {pendingAction && pendingAction.tab.runtime && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <p className="eyebrow">PROCESS CONFIRMATION</p>
            <h2 id="confirm-title">
              {pendingAction.kind === 'close'
                ? `Close ${pendingAction.tab.title}?`
                : `Restart ${pendingAction.tab.title}?`}
            </h2>
            <p>
              PID {pendingAction.tab.runtime.pid ?? '—'} is still running.{' '}
              {pendingAction.kind === 'close'
                ? 'Closing also removes its saved profile.'
                : 'Restarting creates a new run record and PID.'}
            </p>
            <div className="dialog-actions">
              <button onClick={() => setPendingAction(null)} disabled={busy}>
                Cancel
              </button>
              {pendingAction.kind === 'close' ? (
                <>
                  <button
                    onClick={() =>
                      void performClose(
                        pendingAction.projectId,
                        pendingAction.tab,
                        'graceful',
                      )
                    }
                    disabled={busy}
                  >
                    Stop gracefully
                  </button>
                  <button
                    className="danger-button"
                    onClick={() =>
                      void performClose(
                        pendingAction.projectId,
                        pendingAction.tab,
                        'force',
                      )
                    }
                    disabled={busy}
                  >
                    Force close
                  </button>
                </>
              ) : (
                <button
                  className="danger-button"
                  onClick={() => void performRestart(pendingAction.tab)}
                  disabled={busy}
                >
                  Restart terminal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {projectEditor && (
        <div className="modal-backdrop" role="presentation">
          <form
            className="confirm-dialog project-editor"
            onSubmit={(event) => {
              event.preventDefault()
              void saveProjectAnnotations()
            }}
          >
            <p className="eyebrow">PROJECT NOTES</p>
            <h2>Describe this project</h2>
            <label>
              <span>Remark name</span>
              <input
                autoFocus
                maxLength={120}
                value={projectEditor.remarkName}
                placeholder="e.g. Payment API"
                onChange={(event) =>
                  setProjectEditor({
                    ...projectEditor,
                    remarkName: event.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>What is this project for?</span>
              <textarea
                maxLength={500}
                rows={4}
                value={projectEditor.purpose}
                placeholder="A short description shown in the project list"
                onChange={(event) =>
                  setProjectEditor({
                    ...projectEditor,
                    purpose: event.target.value,
                  })
                }
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setProjectEditor(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy}>
                Save notes
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceLayout>
  )
}
