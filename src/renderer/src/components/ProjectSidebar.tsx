import type { AppInfo } from '../../../shared/terminal'
import type { WorkspaceProject } from '../workspace-state'
import { FolderIcon, MoreIcon, PlusIcon } from './icons'
import { isLiveStatus } from './terminal-status'

interface ProjectSidebarProps {
  projects: WorkspaceProject[]
  activeProjectId: string | null
  hydrated: boolean
  busy: boolean
  platform: AppInfo['platform'] | undefined
  onSelectProject: (projectId: string) => void
  onEditProject: (project: WorkspaceProject) => void
  onImportProject: () => void
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  hydrated,
  busy,
  platform,
  onSelectProject,
  onEditProject,
  onImportProject,
}: ProjectSidebarProps) {
  return (
    <aside className="project-sidebar">
      <header className="sidebar-header">
        <div className="brand-mark" aria-hidden="true">
          <img src="./logo/logo-2.png" alt="" />
        </div>
        <div>
          <strong>CMD Workspace</strong>
          <span>Local terminals</span>
        </div>
      </header>

      <div className="sidebar-section-label">
        <span>Projects</span>
        <span>{projects.length.toString().padStart(2, '0')}</span>
      </div>

      <div className="project-list" aria-label="Imported projects">
        {hydrated && projects.length === 0 && (
          <div className="project-list-empty">
            <FolderIcon size={22} />
            <p>No local projects yet</p>
          </div>
        )}
        {projects.map((project) => {
          const running = project.terminals.filter((tab) =>
            isLiveStatus(tab.runtime?.status),
          ).length
          const displayName = project.remarkName ?? project.name
          const active = project.projectId === activeProjectId
          return (
            <div
              key={project.projectId}
              className={`project-row-shell ${active ? 'active' : ''}`}
            >
              <button
                className="project-row"
                title={`${project.name}\n${project.path}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectProject(project.projectId)}
              >
                <span className="project-glyph" aria-hidden="true">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="project-copy">
                  <strong>{displayName}</strong>
                  <small>{project.purpose ?? project.name}</small>
                </span>
                <span
                  className={`running-count ${running === 0 ? 'idle' : ''}`}
                  title={`${running} live terminals`}
                  aria-label={`${running} live terminals`}
                >
                  {running}
                </span>
              </button>
              <button
                className="project-edit-button icon-button"
                aria-label={`Edit notes for ${displayName}`}
                title="Edit project notes"
                onClick={() => onEditProject(project)}
              >
                <MoreIcon size={16} />
              </button>
            </div>
          )
        })}
      </div>

      <button
        className="import-button"
        onClick={onImportProject}
        disabled={busy}
      >
        <PlusIcon size={14} />
        <span>Import project</span>
      </button>
      <footer className="sidebar-footer">
        {platform === 'win32' ? 'Windows / ConPTY / PostgreSQL' : platform}
      </footer>
    </aside>
  )
}
