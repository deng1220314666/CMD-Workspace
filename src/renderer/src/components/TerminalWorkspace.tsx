import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { TerminalShell } from '../../../shared/terminal'
import type { TerminalShortcutAction } from '../terminal-shortcuts'
import {
  paneForProfile,
  profileForPane,
  reconcileTerminalLayout,
  selectProfileInLayout,
  setActivePane,
  splitTerminalLayout,
  updateSplitSizes,
  type ProjectTerminalLayout,
  type SplitDirection,
  type TerminalLayoutNode,
} from '../terminal-layout'
import type { TerminalTab, WorkspaceProject } from '../workspace-state'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClearIcon,
  ClipboardIcon,
  CloseIcon,
  CopyIcon,
  EditIcon,
  SearchIcon,
  SplitHorizontalIcon,
  SplitVerticalIcon,
} from './icons'
import { TerminalSplitLayout } from './TerminalSplitLayout'
import {
  TerminalSurfaceRegistry,
  type TerminalSurfaceRegistryHandle,
} from './TerminalSurfaceRegistry'
import { TerminalTabStrip } from './TerminalTabStrip'

const LAYOUT_STORAGE_KEY = 'cmd-workspace.terminal-layouts.v1'

interface TerminalWorkspaceProps {
  projects: WorkspaceProject[]
  project: WorkspaceProject
  busy: boolean
  editingProfileId: string | null
  draftTitle: string
  onSelect: (profileId: string) => void
  onBeginRename: (tab: TerminalTab) => void
  onDraftTitleChange: (title: string) => void
  onFinishRename: (profileId: string) => void
  onCancelRename: () => void
  onMove: (tab: TerminalTab, offset: -1 | 1) => void
  onClose: (tab: TerminalTab) => void
  onCreate: (shell: TerminalShell, select: boolean) => Promise<string | null>
  onStart: (tab: TerminalTab) => void
  onRestart: (tab: TerminalTab) => void
  onError: (message: string) => void
}

export function TerminalWorkspace({
  projects,
  project,
  busy,
  editingProfileId,
  draftTitle,
  onSelect,
  onBeginRename,
  onDraftTitleChange,
  onFinishRename,
  onCancelRename,
  onMove,
  onClose,
  onCreate,
  onStart,
  onRestart,
  onError,
}: TerminalWorkspaceProps) {
  const [layouts, setLayouts] = useState(loadStoredLayouts)
  const [slots, setSlots] = useState(new Map<string, HTMLDivElement>())
  const [newTerminalShell, setNewTerminalShell] =
    useState<TerminalShell>('powershell')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatched, setSearchMatched] = useState<boolean | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const registryRef = useRef<TerminalSurfaceRegistryHandle>(null)
  const previousSearchProfileRef = useRef<string | null>(null)

  const layout = useMemo(
    () =>
      reconcileTerminalLayout(
        layouts[project.projectId],
        project.terminals.map((tab) => tab.profileId),
        project.activeProfileId,
      ),
    [layouts, project],
  )
  const activeProfileId =
    profileForPane(layout, layout.activePaneId) ?? project.activeProfileId
  const activeTab =
    project.terminals.find((tab) => tab.profileId === activeProfileId) ?? null
  useEffect(() => {
    setLayouts((current) => {
      let changed = false
      const next = { ...current }
      for (const candidate of projects) {
        const reconciled = reconcileTerminalLayout(
          current[candidate.projectId],
          candidate.terminals.map((tab) => tab.profileId),
          candidate.activeProfileId,
        )
        if (
          JSON.stringify(reconciled) !==
          JSON.stringify(current[candidate.projectId])
        ) {
          next[candidate.projectId] = reconciled
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [projects])

  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts))
  }, [layouts])

  const updateLayout = useCallback(
    (
      update: (current: ProjectTerminalLayout) => ProjectTerminalLayout,
      projectId = project.projectId,
    ) => {
      setLayouts((current) => {
        const targetProject = projects.find(
          (candidate) => candidate.projectId === projectId,
        )
        if (!targetProject) return current
        const base = reconcileTerminalLayout(
          current[projectId],
          targetProject.terminals.map((tab) => tab.profileId),
          targetProject.activeProfileId,
        )
        return { ...current, [projectId]: update(base) }
      })
    },
    [project.projectId, projects],
  )

  const handleSlot = useCallback(
    (profileId: string, element: HTMLDivElement | null) => {
      setSlots((current) => {
        if (element && current.get(profileId) === element) return current
        if (!element && !current.has(profileId)) return current
        const next = new Map(current)
        if (element) next.set(profileId, element)
        else next.delete(profileId)
        return next
      })
    },
    [],
  )

  const selectTab = useCallback(
    (profileId: string) => {
      updateLayout((current) => selectProfileInLayout(current, profileId))
      onSelect(profileId)
      window.requestAnimationFrame(() => registryRef.current?.focus(profileId))
    },
    [onSelect, updateLayout],
  )

  const activatePane = useCallback(
    (paneId: string, profileId: string) => {
      updateLayout((current) => setActivePane(current, paneId))
      onSelect(profileId)
    },
    [onSelect, updateLayout],
  )

  const activateProfile = useCallback(
    (profileId: string) => {
      const paneId = paneForProfile(layout, profileId)
      if (paneId) activatePane(paneId, profileId)
    },
    [activatePane, layout],
  )

  const createTerminal = useCallback(
    async (shell = newTerminalShell) => {
      if (busy) return
      await onCreate(shell, true)
    },
    [busy, newTerminalShell, onCreate],
  )

  const splitTerminal = useCallback(
    async (direction: SplitDirection) => {
      if (busy) return
      const profileId = await onCreate(newTerminalShell, false)
      if (!profileId) return
      updateLayout((current) =>
        splitTerminalLayout(
          current,
          profileId,
          direction,
          `split-${crypto.randomUUID()}`,
          `pane-${crypto.randomUUID()}`,
        ),
      )
      onSelect(profileId)
    },
    [busy, newTerminalShell, onCreate, onSelect, updateLayout],
  )

  const navigateTab = useCallback(
    (offset: -1 | 1) => {
      if (!project.terminals.length) return
      const index = project.terminals.findIndex(
        (tab) => tab.profileId === activeProfileId,
      )
      const nextIndex =
        (Math.max(index, 0) + offset + project.terminals.length) %
        project.terminals.length
      selectTab(project.terminals[nextIndex].profileId)
    },
    [activeProfileId, project.terminals, selectTab],
  )

  const openSearch = useCallback(
    (profileId = activeProfileId) => {
      if (!profileId) return
      if (
        previousSearchProfileRef.current &&
        previousSearchProfileRef.current !== profileId
      )
        registryRef.current?.clearSearch(previousSearchProfileRef.current)
      previousSearchProfileRef.current = profileId
      activateProfile(profileId)
      setSearchOpen(true)
      window.requestAnimationFrame(() => searchInputRef.current?.focus())
    },
    [activateProfile, activeProfileId],
  )

  const closeSearch = useCallback(() => {
    if (previousSearchProfileRef.current)
      registryRef.current?.clearSearch(previousSearchProfileRef.current)
    previousSearchProfileRef.current = null
    setSearchOpen(false)
    setSearchMatched(null)
    if (activeProfileId) registryRef.current?.focus(activeProfileId)
  }, [activeProfileId])

  const runSearch = useCallback(
    (direction: 'next' | 'previous') => {
      if (!activeProfileId || !searchQuery) return
      const matched =
        direction === 'next'
          ? registryRef.current?.findNext(activeProfileId, searchQuery)
          : registryRef.current?.findPrevious(activeProfileId, searchQuery)
      setSearchMatched(Boolean(matched))
    },
    [activeProfileId, searchQuery],
  )

  const handleShortcut = useCallback(
    (profileId: string, action: TerminalShortcutAction) => {
      activateProfile(profileId)
      const tab = project.terminals.find(
        (candidate) => candidate.profileId === profileId,
      )
      if (action === 'find') openSearch(profileId)
      if (action === 'new-terminal') void createTerminal()
      if (action === 'split-horizontal') void splitTerminal('horizontal')
      if (action === 'split-vertical') void splitTerminal('vertical')
      if (action === 'previous-tab') navigateTab(-1)
      if (action === 'next-tab') navigateTab(1)
      if (action === 'rename' && tab) onBeginRename(tab)
      if (action === 'close' && tab && !busy) onClose(tab)
    },
    [
      activateProfile,
      busy,
      createTerminal,
      navigateTab,
      onBeginRename,
      onClose,
      openSearch,
      project.terminals,
      splitTerminal,
    ],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return
      const key = event.key.toLowerCase()
      let action: TerminalShortcutAction | null = null
      if (event.ctrlKey && event.shiftKey && key === 'n')
        action = 'new-terminal'
      if (event.ctrlKey && event.shiftKey && key === 'h')
        action = 'split-horizontal'
      if (event.ctrlKey && event.shiftKey && key === 'j')
        action = 'split-vertical'
      if (event.ctrlKey && !event.shiftKey && key === 'pageup')
        action = 'previous-tab'
      if (event.ctrlKey && !event.shiftKey && key === 'pagedown')
        action = 'next-tab'
      if (!event.ctrlKey && !event.shiftKey && key === 'f2') action = 'rename'
      if (event.ctrlKey && event.shiftKey && key === 'w') action = 'close'
      if (event.ctrlKey && !event.shiftKey && key === 'f') action = 'find'
      if (!action) return
      if (action === 'new-terminal' && !activeProfileId) {
        event.preventDefault()
        void createTerminal()
        return
      }
      if (!activeProfileId) return
      event.preventDefault()
      handleShortcut(activeProfileId, action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeProfileId, createTerminal, handleShortcut])

  useEffect(() => {
    if (!searchOpen || !searchQuery || !activeProfileId) {
      setSearchMatched(null)
      return
    }
    setSearchMatched(
      registryRef.current?.findNext(activeProfileId, searchQuery) ?? false,
    )
  }, [activeProfileId, searchOpen, searchQuery])

  return (
    <div className="terminal-deck">
      <TerminalTabStrip
        project={project}
        busy={busy}
        editingProfileId={editingProfileId}
        draftTitle={draftTitle}
        newTerminalShell={newTerminalShell}
        onSelect={selectTab}
        onBeginRename={onBeginRename}
        onDraftTitleChange={onDraftTitleChange}
        onFinishRename={onFinishRename}
        onCancelRename={onCancelRename}
        onNewTerminalShellChange={setNewTerminalShell}
        onMove={onMove}
        onClose={onClose}
        onCreate={(shell) => void createTerminal(shell)}
      />

      <div
        className={`power-rail state-${activeTab?.runtime?.status ?? 'idle'}`}
      >
        <span />
      </div>
      <div className="terminal-toolbar">
        <div className="terminal-path">
          <span className="prompt-mark" aria-hidden="true">
            &gt;
          </span>
          <span>{activeTab?.cwd ?? 'No terminal selected'}</span>
        </div>
        {searchOpen && (
          <div className="terminal-search" role="search">
            <SearchIcon size={13} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              aria-label="Find in terminal"
              placeholder="Find"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter')
                  runSearch(event.shiftKey ? 'previous' : 'next')
                if (event.key === 'Escape') closeSearch()
              }}
            />
            {searchMatched === false && searchQuery && (
              <span className="search-no-results">No results</span>
            )}
            <button
              className="icon-button"
              type="button"
              aria-label="Previous match"
              title="Previous match"
              onClick={() => runSearch('previous')}
            >
              <ChevronLeftIcon size={13} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Next match"
              title="Next match"
              onClick={() => runSearch('next')}
            >
              <ChevronRightIcon size={13} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Close terminal search"
              title="Close search"
              onClick={closeSearch}
            >
              <CloseIcon size={13} />
            </button>
          </div>
        )}
        {activeTab && (
          <div className="terminal-tools">
            <button
              className="icon-button"
              type="button"
              aria-label="Find in terminal"
              title="Find (Ctrl+F)"
              onClick={() => openSearch()}
            >
              <SearchIcon size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Copy terminal selection"
              title="Copy selection (Ctrl+Shift+C)"
              onClick={() =>
                void registryRef.current?.copy(activeTab.profileId)
              }
              disabled={!activeTab.runtime}
            >
              <CopyIcon size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Paste into terminal"
              title="Paste (Ctrl+Shift+V)"
              onClick={() =>
                void registryRef.current?.paste(activeTab.profileId)
              }
              disabled={!activeTab.runtime}
            >
              <ClipboardIcon size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Clear terminal"
              title="Clear terminal (Ctrl+Shift+K)"
              onClick={() => registryRef.current?.clear(activeTab.profileId)}
              disabled={!activeTab.runtime}
            >
              <ClearIcon size={14} />
            </button>
            <span className="terminal-tool-separator" />
            <button
              className="icon-button"
              type="button"
              aria-label="Rename terminal"
              title="Rename terminal (F2)"
              onClick={() => onBeginRename(activeTab)}
            >
              <EditIcon size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Split terminal horizontally"
              title="Split horizontally (Ctrl+Shift+H)"
              onClick={() => void splitTerminal('horizontal')}
              disabled={busy}
            >
              <SplitHorizontalIcon size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Split terminal vertically"
              title="Split vertically (Ctrl+Shift+J)"
              onClick={() => void splitTerminal('vertical')}
              disabled={busy}
            >
              <SplitVerticalIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => onRestart(activeTab)}
              disabled={busy}
            >
              {activeTab.runtime ? 'Restart' : 'Start'}
            </button>
          </div>
        )}
      </div>

      <div className="terminal-stage">
        <div className="terminal-layout-shell">
          {layout.root ? (
            <div className="terminal-layout-tree">
              <TerminalSplitLayout
                project={project}
                layout={layout}
                onActivate={activatePane}
                onSlot={handleSlot}
                onResize={(splitId, sizes) =>
                  updateLayout((current) =>
                    updateSplitSizes(current, splitId, sizes),
                  )
                }
                onStart={onStart}
                onClose={onClose}
              />
            </div>
          ) : (
            <div className="empty-terminal">
              <strong>No terminal in this project</strong>
              <span>Create a terminal profile in {project.path}.</span>
              <button type="button" onClick={() => void createTerminal()}>
                New terminal
              </button>
            </div>
          )}
          <TerminalSurfaceRegistry
            ref={registryRef}
            projects={projects}
            activeProfileId={activeProfileId}
            slots={slots}
            onActivate={(profileId) => activateProfile(profileId)}
            onError={onError}
            onShortcut={handleShortcut}
          />
        </div>
      </div>
      <footer className="statusbar">
        <span>CTRL+F FIND · CTRL+SHIFT+C/V COPY/PASTE</span>
        <span>CTRL+SHIFT+H/J SPLIT · CTRL+PGUP/PGDN SWITCH</span>
        <span>UTF-8 · XTERM-256COLOR</span>
      </footer>
    </div>
  )
}

function loadStoredLayouts(): Record<string, ProjectTerminalLayout> {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}',
    )
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).flatMap(([projectId, candidate]) => {
        const layout = parseLayout(candidate)
        return layout ? [[projectId, layout]] : []
      }),
    )
  } catch {
    return {}
  }
}

function parseLayout(value: unknown): ProjectTerminalLayout | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const root = parseNode(record.root)
  if (record.root !== null && !root) return null
  return {
    root,
    activePaneId:
      typeof record.activePaneId === 'string' ? record.activePaneId : null,
  }
}

function parseNode(value: unknown): TerminalLayoutNode | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    record.type === 'leaf' &&
    typeof record.id === 'string' &&
    typeof record.profileId === 'string'
  )
    return { type: 'leaf', id: record.id, profileId: record.profileId }
  if (
    record.type !== 'split' ||
    typeof record.id !== 'string' ||
    (record.direction !== 'horizontal' && record.direction !== 'vertical') ||
    !Array.isArray(record.children) ||
    record.children.length !== 2 ||
    !Array.isArray(record.sizes) ||
    record.sizes.length !== 2
  )
    return null
  const first = parseNode(record.children[0])
  const second = parseNode(record.children[1])
  const firstSize = Number(record.sizes[0])
  const secondSize = Number(record.sizes[1])
  if (
    !first ||
    !second ||
    !Number.isFinite(firstSize) ||
    !Number.isFinite(secondSize)
  )
    return null
  return {
    type: 'split',
    id: record.id,
    direction: record.direction,
    children: [first, second],
    sizes: [firstSize, secondSize],
  }
}
