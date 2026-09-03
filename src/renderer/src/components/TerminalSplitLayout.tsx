import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'
import { useCallback } from 'react'
import type { TerminalTab, WorkspaceProject } from '../workspace-state'
import type {
  ProjectTerminalLayout,
  TerminalLayoutNode,
} from '../terminal-layout'
import { CloseIcon, TerminalIcon } from './icons'
import { terminalStatusLabel } from './terminal-status'

interface TerminalSplitLayoutProps {
  project: WorkspaceProject
  layout: ProjectTerminalLayout
  onActivate: (paneId: string, profileId: string) => void
  onSlot: (profileId: string, element: HTMLDivElement | null) => void
  onResize: (splitId: string, sizes: [number, number]) => void
  onStart: (tab: TerminalTab) => void
  onClose: (tab: TerminalTab) => void
}

export function TerminalSplitLayout(props: TerminalSplitLayoutProps) {
  if (!props.layout.root) return null
  return <LayoutNode node={props.layout.root} {...props} />
}

function LayoutNode({
  node,
  project,
  layout,
  onActivate,
  onSlot,
  onResize,
  onStart,
  onClose,
}: TerminalSplitLayoutProps & { node: TerminalLayoutNode }) {
  if (node.type === 'leaf') {
    return (
      <TerminalPane
        node={node}
        project={project}
        active={layout.activePaneId === node.id}
        onActivate={onActivate}
        onSlot={onSlot}
        onStart={onStart}
        onClose={onClose}
      />
    )
  }

  const firstId = node.children[0].id
  const secondId = node.children[1].id
  const defaultLayout: Layout = {
    [firstId]: node.sizes[0],
    [secondId]: node.sizes[1],
  }
  return (
    <Group
      id={node.id}
      className="terminal-split-group"
      orientation={node.direction}
      defaultLayout={defaultLayout}
      onLayoutChanged={(nextLayout, metadata) => {
        if (!metadata.isUserInteraction) return
        onResize(node.id, [
          nextLayout[firstId] ?? node.sizes[0],
          nextLayout[secondId] ?? node.sizes[1],
        ])
      }}
    >
      <Panel id={firstId} minSize="18%">
        <LayoutNode
          node={node.children[0]}
          project={project}
          layout={layout}
          onActivate={onActivate}
          onSlot={onSlot}
          onResize={onResize}
          onStart={onStart}
          onClose={onClose}
        />
      </Panel>
      <Separator className="terminal-split-handle" />
      <Panel id={secondId} minSize="18%">
        <LayoutNode
          node={node.children[1]}
          project={project}
          layout={layout}
          onActivate={onActivate}
          onSlot={onSlot}
          onResize={onResize}
          onStart={onStart}
          onClose={onClose}
        />
      </Panel>
    </Group>
  )
}

function TerminalPane({
  node,
  project,
  active,
  onActivate,
  onSlot,
  onStart,
  onClose,
}: Pick<
  TerminalSplitLayoutProps,
  'project' | 'onActivate' | 'onSlot' | 'onStart' | 'onClose'
> & {
  node: Extract<TerminalLayoutNode, { type: 'leaf' }>
  active: boolean
}) {
  const tab = project.terminals.find(
    (candidate) => candidate.profileId === node.profileId,
  )
  const assignSlot = useCallback(
    (element: HTMLDivElement | null) => onSlot(node.profileId, element),
    [node.profileId, onSlot],
  )
  if (!tab) return null
  const status = terminalStatusLabel(tab.runtime?.status)
  return (
    <section
      className={`terminal-pane ${active ? 'active' : ''}`}
      aria-label={`${tab.title} terminal pane`}
      onPointerDown={() => onActivate(node.id, tab.profileId)}
    >
      <header className="terminal-pane-header">
        <TerminalIcon size={13} />
        <strong>{tab.title}</strong>
        <span className="terminal-pane-shell">
          {tab.shell === 'cmd' ? 'Command Prompt' : 'PowerShell'}
        </span>
        <span
          className={`terminal-pane-status state-${tab.runtime?.status ?? 'idle'}`}
        >
          <i aria-hidden="true" />
          {status}
          {tab.runtime?.exitCode !== undefined
            ? ` (${tab.runtime.exitCode})`
            : ''}
        </span>
        <button
          className="terminal-pane-close icon-button"
          type="button"
          aria-label={`Close ${tab.title}`}
          title="Close terminal"
          onClick={(event) => {
            event.stopPropagation()
            onClose(tab)
          }}
        >
          <CloseIcon size={13} />
        </button>
      </header>
      <div className="terminal-pane-content" ref={assignSlot}>
        {!tab.runtime && (
          <div className="terminal-pane-empty">
            <span>Process not running</span>
            <button type="button" onClick={() => onStart(tab)}>
              Start
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
