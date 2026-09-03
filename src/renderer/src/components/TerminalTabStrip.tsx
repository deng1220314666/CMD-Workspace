import { useRef, type KeyboardEvent } from 'react'
import type { TerminalShell } from '../../../shared/terminal'
import type { WorkspaceProject, TerminalTab } from '../workspace-state'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  TerminalIcon,
} from './icons'
import { terminalStatusLabel } from './terminal-status'

interface TerminalTabStripProps {
  project: WorkspaceProject
  busy: boolean
  editingProfileId: string | null
  draftTitle: string
  newTerminalShell: TerminalShell
  onSelect: (profileId: string) => void
  onBeginRename: (tab: TerminalTab) => void
  onDraftTitleChange: (title: string) => void
  onFinishRename: (profileId: string) => void
  onCancelRename: () => void
  onNewTerminalShellChange: (shell: TerminalShell) => void
  onMove: (tab: TerminalTab, offset: -1 | 1) => void
  onClose: (tab: TerminalTab) => void
  onCreate: (shell?: TerminalShell) => void
}

export function TerminalTabStrip({
  project,
  busy,
  editingProfileId,
  draftTitle,
  newTerminalShell,
  onSelect,
  onBeginRename,
  onDraftTitleChange,
  onFinishRename,
  onCancelRename,
  onNewTerminalShellChange,
  onMove,
  onClose,
  onCreate,
}: TerminalTabStripProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const shellMenuRef = useRef<HTMLDetailsElement>(null)

  const createWithShell = (shell: TerminalShell) => {
    onNewTerminalShellChange(shell)
    shellMenuRef.current?.removeAttribute('open')
    onCreate(shell)
  }

  const navigateTabs = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowLeft')
      nextIndex =
        (index - 1 + project.terminals.length) % project.terminals.length
    if (event.key === 'ArrowRight')
      nextIndex = (index + 1) % project.terminals.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = project.terminals.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    const nextTab = project.terminals[nextIndex]
    onSelect(nextTab.profileId)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      className="tab-strip"
      role="tablist"
      aria-label={`${project.name} terminals`}
    >
      <div className="tab-strip-scroll">
        {project.terminals.map((tab, index) => {
          const active = tab.profileId === project.activeProfileId
          const status = terminalStatusLabel(tab.runtime?.status)
          return (
            <div
              key={tab.profileId}
              className={`terminal-tab ${active ? 'active' : ''}`}
            >
              {editingProfileId === tab.profileId ? (
                <input
                  id={`terminal-tab-${tab.profileId}`}
                  className="tab-rename-input"
                  autoFocus
                  value={draftTitle}
                  aria-label="Terminal name"
                  onChange={(event) => onDraftTitleChange(event.target.value)}
                  onBlur={() => onFinishRename(tab.profileId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') onCancelRename()
                  }}
                />
              ) : (
                <button
                  ref={(element) => {
                    tabRefs.current[index] = element
                  }}
                  id={`terminal-tab-${tab.profileId}`}
                  className="tab-select"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`terminal-panel-${tab.profileId}`}
                  tabIndex={active ? 0 : -1}
                  title={`${tab.title} — ${status}`}
                  onClick={() => onSelect(tab.profileId)}
                  onKeyDown={(event) => navigateTabs(event, index)}
                  onDoubleClick={() => onBeginRename(tab)}
                >
                  <TerminalIcon size={14} className="tab-shell-icon" />
                  <span
                    className={`status-dot state-${tab.runtime?.status ?? 'idle'}`}
                    aria-hidden="true"
                  />
                  <span className="tab-title">{tab.title}</span>
                  <span className="sr-only">{status}</span>
                </button>
              )}
              <div className="tab-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Move ${tab.title} left`}
                  title="Move terminal left"
                  disabled={index === 0}
                  onClick={() => onMove(tab, -1)}
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Move ${tab.title} right`}
                  title="Move terminal right"
                  disabled={index === project.terminals.length - 1}
                  onClick={() => onMove(tab, 1)}
                >
                  <ChevronRightIcon size={14} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  title="Close terminal"
                  onClick={() => onClose(tab)}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="new-terminal-control">
        <button
          className="new-terminal-button icon-button"
          type="button"
          aria-label="New terminal"
          title={`New ${newTerminalShell === 'cmd' ? 'Command Prompt' : 'PowerShell'} terminal (Ctrl+Shift+N)`}
          onClick={() => onCreate()}
          disabled={busy}
        >
          <PlusIcon size={16} />
        </button>
        <details
          ref={shellMenuRef}
          className="terminal-shell-menu"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.removeAttribute('open')
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            shellMenuRef.current?.removeAttribute('open')
            shellMenuRef.current?.querySelector('summary')?.focus()
          }}
        >
          <summary
            aria-label="Choose shell for new terminal"
            title="Choose PowerShell or Command Prompt"
          >
            <ChevronDownIcon size={13} />
          </summary>
          <div className="terminal-shell-options" role="menu">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={newTerminalShell === 'powershell'}
              onClick={() => createWithShell('powershell')}
              disabled={busy}
            >
              <TerminalIcon size={14} />
              <span>PowerShell</span>
              <i aria-hidden="true">
                {newTerminalShell === 'powershell' ? '✓' : ''}
              </i>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={newTerminalShell === 'cmd'}
              onClick={() => createWithShell('cmd')}
              disabled={busy}
            >
              <TerminalIcon size={14} />
              <span>Command Prompt</span>
              <i aria-hidden="true">{newTerminalShell === 'cmd' ? '✓' : ''}</i>
            </button>
          </div>
        </details>
      </div>
    </div>
  )
}
