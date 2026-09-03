import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppInfo,
  TerminalCloseMode,
  TerminalStatus,
  TerminalStatusEvent,
} from '../../shared/terminal'
import { TerminalView } from './TerminalView'
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

const isLive = (status: TerminalStatus | undefined) =>
  status === 'starting' || status === 'running' || status === 'stopping'

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
    })
    setWorkspace((current) => attachRuntime(current, tab.profileId, runtime))
  }

  const createTerminal = async (project: WorkspaceProject) => {
    setBusy(true)
    setError(null)
    try {
      const profile = await window.cmdWorkspace.persistence.createProfile({
        projectId: project.projectId,
        displayName: `PowerShell ${project.terminals.length + 1}`,
        workingDirectory: project.path,
      })
      setWorkspace((current) => addProfile(current, profile))
      await startTerminal({
        profileId: profile.profileId,
        title: profile.displayName,
        cwd: profile.workingDirectory,
        runtime: null,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
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
        await createTerminal({
          ...imported,
          remarkName: null,
          purpose: null,
          terminals: [],
          activeProfileId: null,
        })
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
    if (isLive(tab.runtime?.status))
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
    if (isLive(tab.runtime?.status))
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
    <main className="workspace-shell">
      <aside className="project-sidebar">
        <header className="sidebar-header">
          <div className="brand-mark" aria-hidden="true">
            CW
          </div>
          <div>
            <strong>CMD Workspace</strong>
            <span>Persistent local projects</span>
          </div>
        </header>
        <div className="project-list" aria-label="Imported projects">
          {workspace.projects.map((project) => {
            const running = project.terminals.filter((tab) =>
              isLive(tab.runtime?.status),
            ).length
            return (
              <div
                key={project.projectId}
                className={`project-row-shell ${project.projectId === workspace.activeProjectId ? 'active' : ''}`}
              >
                <button
                  className="project-row"
                  title={`${project.name}\n${project.path}`}
                  onClick={() =>
                    setWorkspace((current) =>
                      selectProject(current, project.projectId),
                    )
                  }
                >
                  <span className="project-glyph">
                    {(project.remarkName ?? project.name)
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <span className="project-copy">
                    <strong>{project.remarkName ?? project.name}</strong>
                    <small>{project.purpose ?? project.name}</small>
                  </span>
                  <span
                    className="running-count"
                    title={`${running} live terminals`}
                  >
                    {running}
                  </span>
                </button>
                <button
                  className="project-edit-button"
                  aria-label={`Edit notes for ${project.remarkName ?? project.name}`}
                  title="Edit project notes"
                  onClick={() =>
                    setProjectEditor({
                      projectId: project.projectId,
                      remarkName: project.remarkName ?? '',
                      purpose: project.purpose ?? '',
                    })
                  }
                >
                  ✎
                </button>
              </div>
            )
          })}
        </div>
        <button
          className="import-button"
          onClick={() => void importProject()}
          disabled={busy}
        >
          + Import project
        </button>
        <footer className="sidebar-footer">
          {appInfo?.platform === 'win32'
            ? 'Windows / ConPTY / PostgreSQL'
            : appInfo?.platform}
        </footer>
      </aside>

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
                <span>PID</span>
                <strong>{activeTab?.runtime?.pid ?? '—'}</strong>
                <span>STATE</span>
                <strong
                  className={`state-${activeTab?.runtime?.status ?? 'idle'}`}
                >
                  {activeTab?.runtime?.status ?? 'idle'}
                </strong>
              </div>
            </header>

            <div className="terminal-deck">
              <div
                className="tab-strip"
                role="tablist"
                aria-label={`${activeProject.name} terminals`}
              >
                {activeProject.terminals.map((tab, index) => (
                  <div
                    key={tab.profileId}
                    className={`terminal-tab ${tab.profileId === activeProject.activeProfileId ? 'active' : ''}`}
                  >
                    <button
                      className="tab-select"
                      role="tab"
                      aria-selected={
                        tab.profileId === activeProject.activeProfileId
                      }
                      onClick={() =>
                        setWorkspace((current) =>
                          selectTerminal(
                            current,
                            activeProject.projectId,
                            tab.profileId,
                          ),
                        )
                      }
                      onDoubleClick={() => {
                        setDraftTitle(tab.title)
                        setEditingProfileId(tab.profileId)
                      }}
                    >
                      <span
                        className={`status-dot state-${tab.runtime?.status ?? 'idle'}`}
                      />
                      {editingProfileId === tab.profileId ? (
                        <input
                          autoFocus
                          value={draftTitle}
                          aria-label="Terminal name"
                          onChange={(event) =>
                            setDraftTitle(event.target.value)
                          }
                          onBlur={() =>
                            void finishRename(
                              activeProject.projectId,
                              tab.profileId,
                            )
                          }
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter')
                              event.currentTarget.blur()
                            if (event.key === 'Escape')
                              setEditingProfileId(null)
                          }}
                        />
                      ) : (
                        <span>{tab.title}</span>
                      )}
                    </button>
                    <div className="tab-actions">
                      <button
                        title="Move terminal left"
                        disabled={index === 0}
                        onClick={() => void persistMove(activeProject, tab, -1)}
                      >
                        ←
                      </button>
                      <button
                        title="Move terminal right"
                        disabled={index === activeProject.terminals.length - 1}
                        onClick={() => void persistMove(activeProject, tab, 1)}
                      >
                        →
                      </button>
                      <button
                        title="Close terminal"
                        onClick={() =>
                          requestClose(activeProject.projectId, tab)
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="new-terminal-button"
                  title="New terminal"
                  onClick={() => void createTerminal(activeProject)}
                  disabled={busy}
                >
                  +
                </button>
              </div>

              <div
                className={`power-rail state-${activeTab?.runtime?.status ?? 'idle'}`}
              >
                <span />
              </div>
              <div className="terminal-toolbar">
                <span>{activeTab?.cwd ?? 'No terminal selected'}</span>
                {activeTab && (
                  <button
                    onClick={() =>
                      requestRestart(activeProject.projectId, activeTab)
                    }
                    disabled={busy}
                  >
                    {activeTab.runtime ? 'Restart' : 'Start'}
                  </button>
                )}
              </div>
              <div className="terminal-stage">
                {activeTab?.runtime ? (
                  <TerminalView
                    key={`${activeTab.runtime.terminalId}-${activeTab.runtime.pid ?? activeTab.runtime.status}`}
                    terminalId={activeTab.runtime.terminalId}
                    onError={reportError}
                  />
                ) : activeTab ? (
                  <div className="empty-terminal">
                    <strong>Profile restored — process not running</strong>
                    <span>
                      Stored PIDs are diagnostic only. Start this profile to
                      create a new PTY.
                    </span>
                    <button onClick={() => void performRestart(activeTab)}>
                      Start terminal
                    </button>
                  </div>
                ) : (
                  <div className="empty-terminal">
                    <strong>No terminal in this project</strong>
                    <span>
                      Create a persistent profile to start PowerShell in{' '}
                      {activeProject.path}.
                    </span>
                    <button onClick={() => void createTerminal(activeProject)}>
                      New terminal
                    </button>
                  </div>
                )}
              </div>
              <footer className="statusbar">
                <span>UTF-8</span>
                <span>xterm-256color</span>
                <span>Profiles persist · PTYs stay in memory</span>
              </footer>
            </div>
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
    </main>
  )
}
