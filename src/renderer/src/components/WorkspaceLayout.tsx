import { useState, type CSSProperties, type ReactNode } from 'react'

const SIDEBAR_STORAGE_KEY = 'cmd-workspace.sidebar-width'
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 320
const DEFAULT_SIDEBAR_WIDTH = 240

const clampSidebarWidth = (value: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value))

function restoredSidebarWidth() {
  const stored = Number.parseInt(
    window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? '',
    10,
  )
  return Number.isFinite(stored)
    ? clampSidebarWidth(stored)
    : DEFAULT_SIDEBAR_WIDTH
}

interface WorkspaceLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

export function WorkspaceLayout({ sidebar, children }: WorkspaceLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(restoredSidebarWidth)

  const resize = (nextWidth: number) => {
    const width = clampSidebarWidth(nextWidth)
    setSidebarWidth(width)
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(width))
  }

  return (
    <main
      className="workspace-shell"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      {sidebar}
      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-label="Resize project sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onDoubleClick={() => resize(DEFAULT_SIDEBAR_WIDTH)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            resize(sidebarWidth - 8)
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            resize(sidebarWidth + 8)
          }
          if (event.key === 'Home') {
            event.preventDefault()
            resize(MIN_SIDEBAR_WIDTH)
          }
          if (event.key === 'End') {
            event.preventDefault()
            resize(MAX_SIDEBAR_WIDTH)
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          resize(event.clientX)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
      />
      {children}
    </main>
  )
}
