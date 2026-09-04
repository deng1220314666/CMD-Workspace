import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { TerminalSnapshot } from '../../../shared/terminal'
import { TerminalView, type TerminalViewHandle } from '../TerminalView'
import type { TerminalShortcutAction } from '../terminal-shortcuts'
import type { WorkspaceProject } from '../workspace-state'

export interface TerminalSurfaceRegistryHandle {
  focus(profileId: string): void
  copy(profileId: string): Promise<boolean>
  paste(profileId: string): Promise<void>
  clear(profileId: string): void
  findNext(profileId: string, query: string): boolean
  findPrevious(profileId: string, query: string): boolean
  clearSearch(profileId: string): void
}

interface PersistentTerminalSurfaceProps {
  runtime: TerminalSnapshot
  profileId: string
  slot: HTMLDivElement | null
  container: HTMLDivElement | null
  active: boolean
  onActivate: (profileId: string) => void
  onError: (message: string) => void
  onHandle: (profileId: string, handle: TerminalViewHandle | null) => void
  onShortcut: (profileId: string, action: TerminalShortcutAction) => void
}

function PersistentTerminalSurface({
  runtime,
  profileId,
  slot,
  container,
  active,
  onActivate,
  onError,
  onHandle,
  onShortcut,
}: PersistentTerminalSurfaceProps) {
  const previousPid = useRef(runtime.pid)
  const [generation, setGeneration] = useState(0)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const assignHandle = useCallback(
    (handle: TerminalViewHandle | null) => onHandle(profileId, handle),
    [onHandle, profileId],
  )

  useEffect(() => {
    if (
      runtime.pid !== null &&
      previousPid.current !== null &&
      runtime.pid !== previousPid.current
    ) {
      setGeneration((current) => current + 1)
    }
    if (runtime.pid !== null) previousPid.current = runtime.pid
  }, [runtime.pid])

  useLayoutEffect(() => {
    if (!slot || !container) {
      setPosition(null)
      return
    }
    const updatePosition = () => {
      const containerRect = container.getBoundingClientRect()
      const slotRect = slot.getBoundingClientRect()
      setPosition({
        left: slotRect.left - containerRect.left,
        top: slotRect.top - containerRect.top,
        width: slotRect.width,
        height: slotRect.height,
      })
    }
    const observer = new ResizeObserver(updatePosition)
    observer.observe(slot)
    observer.observe(container)
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePosition)
    }
  }, [container, slot])

  return (
    <div
      id={`terminal-panel-${profileId}`}
      className={`terminal-surface ${active ? 'active' : ''}`}
      role="tabpanel"
      aria-labelledby={`terminal-tab-${profileId}`}
      aria-hidden={!position}
      style={position ?? undefined}
      onPointerDown={() => onActivate(profileId)}
    >
      <TerminalView
        ref={assignHandle}
        key={`${runtime.terminalId}-${generation}`}
        terminalId={runtime.terminalId}
        active={active && position !== null}
        onError={onError}
        onShortcut={(action) => onShortcut(profileId, action)}
      />
    </div>
  )
}

interface TerminalSurfaceRegistryProps {
  projects: WorkspaceProject[]
  activeProfileId: string | null
  slots: Map<string, HTMLDivElement>
  onActivate: (profileId: string) => void
  onError: (message: string) => void
  onShortcut: (profileId: string, action: TerminalShortcutAction) => void
}

export const TerminalSurfaceRegistry = forwardRef<
  TerminalSurfaceRegistryHandle,
  TerminalSurfaceRegistryProps
>(function TerminalSurfaceRegistry(
  { projects, activeProfileId, slots, onActivate, onError, onShortcut },
  ref,
) {
  const handles = useRef(new Map<string, TerminalViewHandle>())
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const onHandle = useCallback(
    (profileId: string, handle: TerminalViewHandle | null) => {
      if (handle) handles.current.set(profileId, handle)
      else handles.current.delete(profileId)
    },
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      focus: (profileId) => handles.current.get(profileId)?.focus(),
      copy: (profileId) =>
        handles.current.get(profileId)?.copy() ?? Promise.resolve(false),
      paste: (profileId) =>
        handles.current.get(profileId)?.paste() ?? Promise.resolve(),
      clear: (profileId) => handles.current.get(profileId)?.clear(),
      findNext: (profileId, query) =>
        handles.current.get(profileId)?.findNext(query) ?? false,
      findPrevious: (profileId, query) =>
        handles.current.get(profileId)?.findPrevious(query) ?? false,
      clearSearch: (profileId) => handles.current.get(profileId)?.clearSearch(),
    }),
    [],
  )

  return (
    <div className="terminal-surface-registry" ref={setContainer}>
      {projects.flatMap((project) =>
        project.terminals.flatMap((tab) =>
          tab.runtime ? (
            <PersistentTerminalSurface
              key={tab.runtime.terminalId}
              runtime={tab.runtime}
              profileId={tab.profileId}
              slot={slots.get(tab.profileId) ?? null}
              container={container}
              active={tab.profileId === activeProfileId}
              onActivate={onActivate}
              onError={onError}
              onHandle={onHandle}
              onShortcut={onShortcut}
            />
          ) : (
            []
          ),
        ),
      )}
    </div>
  )
})
