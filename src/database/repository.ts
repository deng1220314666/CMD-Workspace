import path from 'node:path'
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import type {
  PersistedProject,
  PersistedTerminalProfile,
  WorkspaceBootstrap,
  WorkspaceSelection,
} from '../shared/persistence'
import {
  applicationState,
  projects,
  taskDependencies,
  tasks,
  terminalProfiles,
  terminalRuns,
} from './schema'
import {
  assertAcyclicDependencies,
  type TaskDependencyEdge,
} from './dependency-graph'

type Database = NodePgDatabase<{
  applicationState: typeof applicationState
  projects: typeof projects
  taskDependencies: typeof taskDependencies
  tasks: typeof tasks
  terminalProfiles: typeof terminalProfiles
  terminalRuns: typeof terminalRuns
}>

const workspaceSelectionKey = 'workspace-selection'
const emptySelection: WorkspaceSelection = {
  activeProjectId: null,
  activeProfileIds: {},
}

export class PersistenceRepository {
  private constructor(
    private readonly pool: Pool,
    private readonly db: Database,
  ) {}

  static async connect(
    databaseUrl: string,
    migrationsFolder: string,
  ): Promise<PersistenceRepository> {
    const pool = new Pool({ connectionString: databaseUrl, max: 5 })
    const db = drizzle(pool, {
      schema: {
        applicationState,
        projects,
        taskDependencies,
        tasks,
        terminalProfiles,
        terminalRuns,
      },
    })
    try {
      await migrate(db, { migrationsFolder })
      return new PersistenceRepository(pool, db)
    } catch (error) {
      await pool.end()
      throw new Error(`Database migration failed: ${messageOf(error)}`)
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  async reconcileStaleRuns(): Promise<number> {
    const result = await this.db
      .update(terminalRuns)
      .set({
        state: 'interrupted',
        finishedAt: new Date(),
        durationMs: sql<number>`greatest(0, floor(extract(epoch from (now() - ${terminalRuns.startedAt})) * 1000))::integer`,
        errorSummary: 'Application exited before the terminal run completed',
      })
      .where(inArray(terminalRuns.state, ['starting', 'running', 'stopping']))
      .returning({ id: terminalRuns.id })
    return result.length
  }

  async loadWorkspace(): Promise<WorkspaceBootstrap> {
    const projectRows = await this.db
      .select()
      .from(projects)
      .orderBy(asc(projects.orderIndex), asc(projects.createdAt))
    const profileRows = await this.db
      .select()
      .from(terminalProfiles)
      .orderBy(
        asc(terminalProfiles.projectId),
        asc(terminalProfiles.orderIndex),
      )
    const selectionRows = await this.db
      .select({ value: applicationState.value })
      .from(applicationState)
      .where(eq(applicationState.key, workspaceSelectionKey))
      .limit(1)
    const byProject = new Map<string, PersistedTerminalProfile[]>()
    for (const row of profileRows) {
      const profiles = byProject.get(row.projectId) ?? []
      profiles.push(toProfile(row))
      byProject.set(row.projectId, profiles)
    }
    const persistedProjects: PersistedProject[] = projectRows.map((row) => ({
      projectId: row.id,
      name: row.name,
      remarkName: row.remarkName,
      purpose: row.purpose,
      path: row.displayPath,
      orderIndex: row.orderIndex,
      profiles: byProject.get(row.id) ?? [],
    }))
    return {
      projects: persistedProjects,
      selection: sanitizeSelection(selectionRows[0]?.value, persistedProjects),
    }
  }

  async importProject(input: {
    name: string
    displayPath: string
    normalizedPath: string
  }): Promise<PersistedProject> {
    return this.db.transaction(async (transaction) => {
      const existing = await transaction
        .select()
        .from(projects)
        .where(eq(projects.normalizedPath, input.normalizedPath))
        .limit(1)
      if (existing[0])
        return {
          projectId: existing[0].id,
          name: existing[0].name,
          remarkName: existing[0].remarkName,
          purpose: existing[0].purpose,
          path: existing[0].displayPath,
          orderIndex: existing[0].orderIndex,
          profiles: [],
        }
      const order = await transaction
        .select({ value: max(projects.orderIndex) })
        .from(projects)
      const [created] = await transaction
        .insert(projects)
        .values({
          name: input.name,
          displayPath: input.displayPath,
          normalizedPath: input.normalizedPath,
          orderIndex: (order[0]?.value ?? -1) + 1,
        })
        .returning()
      return {
        projectId: created.id,
        name: created.name,
        remarkName: created.remarkName,
        purpose: created.purpose,
        path: created.displayPath,
        orderIndex: created.orderIndex,
        profiles: [],
      }
    })
  }

  async updateProjectAnnotations(
    projectId: string,
    input: { remarkName: string | null; purpose: string | null },
  ): Promise<void> {
    const changed = await this.db
      .update(projects)
      .set({
        remarkName: input.remarkName,
        purpose: input.purpose,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning({ id: projects.id })
    if (!changed.length) throw new Error('Project does not exist')
  }

  async createProfile(input: {
    projectId: string
    displayName: string
    workingDirectory: string
    executable: string
    arguments: string[]
  }): Promise<PersistedTerminalProfile> {
    try {
      return await this.db.transaction(async (transaction) => {
        const order = await transaction
          .select({ value: max(terminalProfiles.orderIndex) })
          .from(terminalProfiles)
          .where(eq(terminalProfiles.projectId, input.projectId))
        const [created] = await transaction
          .insert(terminalProfiles)
          .values({
            projectId: input.projectId,
            displayName: input.displayName,
            executable: input.executable ?? 'powershell.exe',
            arguments: input.arguments ?? [],
            workingDirectory: input.workingDirectory,
            orderIndex: (order[0]?.value ?? -1) + 1,
          })
          .returning()
        return toProfile(created)
      })
    } catch (error) {
      throw actionableDatabaseError(error, 'Could not create terminal profile')
    }
  }

  async renameProfile(profileId: string, displayName: string): Promise<void> {
    const changed = await this.db
      .update(terminalProfiles)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(terminalProfiles.id, profileId))
      .returning({ id: terminalProfiles.id })
    if (!changed.length) throw new Error('Terminal profile does not exist')
  }

  async reorderProfiles(
    projectId: string,
    orderedProfileIds: string[],
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const current = await transaction
        .select({ id: terminalProfiles.id })
        .from(terminalProfiles)
        .where(eq(terminalProfiles.projectId, projectId))
      const currentIds = new Set(current.map((row) => row.id))
      if (
        orderedProfileIds.length !== currentIds.size ||
        new Set(orderedProfileIds).size !== orderedProfileIds.length ||
        orderedProfileIds.some((id) => !currentIds.has(id))
      )
        throw new Error(
          'Terminal reorder must include every profile in this project exactly once',
        )
      await transaction
        .update(terminalProfiles)
        .set({
          orderIndex: sql`${terminalProfiles.orderIndex} + ${orderedProfileIds.length + 1000}`,
        })
        .where(eq(terminalProfiles.projectId, projectId))
      for (const [orderIndex, profileId] of orderedProfileIds.entries())
        await transaction
          .update(terminalProfiles)
          .set({ orderIndex, updatedAt: new Date() })
          .where(
            and(
              eq(terminalProfiles.projectId, projectId),
              eq(terminalProfiles.id, profileId),
            ),
          )
    })
  }

  async deleteProfile(profileId: string): Promise<void> {
    const removed = await this.db.transaction(async (transaction) => {
      const deleted = await transaction
        .delete(terminalProfiles)
        .where(eq(terminalProfiles.id, profileId))
        .returning({ projectId: terminalProfiles.projectId })
      if (!deleted[0]) return null
      const survivors = await transaction
        .select({ id: terminalProfiles.id })
        .from(terminalProfiles)
        .where(eq(terminalProfiles.projectId, deleted[0].projectId))
        .orderBy(asc(terminalProfiles.orderIndex))
      for (const [orderIndex, row] of survivors.entries())
        await transaction
          .update(terminalProfiles)
          .set({ orderIndex })
          .where(eq(terminalProfiles.id, row.id))
      return deleted[0]
    })
    if (!removed) throw new Error('Terminal profile does not exist')
  }

  async saveSelection(selection: WorkspaceSelection): Promise<void> {
    await this.db
      .insert(applicationState)
      .values({ key: workspaceSelectionKey, version: 1, value: selection })
      .onConflictDoUpdate({
        target: applicationState.key,
        set: { version: 1, value: selection, updatedAt: new Date() },
      })
  }

  async startRun(input: {
    profileId: string
    applicationInstanceId: string
    diagnosticPid: number | null
  }): Promise<string> {
    const [run] = await this.db
      .insert(terminalRuns)
      .values({ ...input, state: 'running' })
      .returning({ id: terminalRuns.id })
    return run.id
  }

  async markRunStopping(runId: string): Promise<void> {
    await this.db
      .update(terminalRuns)
      .set({ state: 'stopping' })
      .where(eq(terminalRuns.id, runId))
  }

  async finishRun(
    runId: string,
    input: {
      state: 'exited' | 'failed' | 'interrupted'
      exitCode?: number
      errorSummary?: string
      logPath?: string
    },
  ): Promise<void> {
    const started = await this.db
      .select({ startedAt: terminalRuns.startedAt })
      .from(terminalRuns)
      .where(eq(terminalRuns.id, runId))
      .limit(1)
    if (!started[0]) return
    const finishedAt = new Date()
    await this.db
      .update(terminalRuns)
      .set({
        ...input,
        finishedAt,
        durationMs: Math.max(
          0,
          finishedAt.getTime() - started[0].startedAt.getTime(),
        ),
      })
      .where(eq(terminalRuns.id, runId))
  }

  async replaceTaskDependencies(
    projectId: string,
    edges: TaskDependencyEdge[],
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const projectTasks = await transaction
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
      const taskIds = projectTasks.map((row) => row.id)
      assertAcyclicDependencies(taskIds, edges)
      if (taskIds.length)
        await transaction
          .delete(taskDependencies)
          .where(inArray(taskDependencies.taskId, taskIds))
      if (edges.length) await transaction.insert(taskDependencies).values(edges)
    })
  }
}

export function normalizeProjectPath(projectPath: string): string {
  const normalized = path.normalize(path.resolve(projectPath))
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function toProfile(
  row: typeof terminalProfiles.$inferSelect,
): PersistedTerminalProfile {
  return {
    profileId: row.id,
    projectId: row.projectId,
    displayName: row.displayName,
    executable: row.executable,
    arguments: row.arguments,
    workingDirectory: row.workingDirectory,
    startupCommand: row.startupCommand,
    autoStart: row.autoStart,
    restartPolicy: row.restartPolicy,
    orderIndex: row.orderIndex,
  }
}

function sanitizeSelection(
  value: unknown,
  persistedProjects: PersistedProject[],
): WorkspaceSelection {
  if (!value || typeof value !== 'object') return emptySelection
  const candidate = value as Partial<WorkspaceSelection>
  const projectIds = new Set(
    persistedProjects.map((project) => project.projectId),
  )
  const activeProjectId =
    typeof candidate.activeProjectId === 'string' &&
    projectIds.has(candidate.activeProjectId)
      ? candidate.activeProjectId
      : (persistedProjects[0]?.projectId ?? null)
  const activeProfileIds: Record<string, string | null> = {}
  for (const project of persistedProjects) {
    const saved = candidate.activeProfileIds?.[project.projectId]
    activeProfileIds[project.projectId] = project.profiles.some(
      (profile) => profile.profileId === saved,
    )
      ? (saved ?? null)
      : (project.profiles[0]?.profileId ?? null)
  }
  return { activeProjectId, activeProfileIds }
}

function actionableDatabaseError(error: unknown, prefix: string): Error {
  const code = databaseCode(error)
  const detail =
    code === '23503' ? 'The owning project no longer exists' : messageOf(error)
  return new Error(`${prefix}: ${detail}`)
}

function databaseCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  if ('code' in error && typeof error.code === 'string') return error.code
  return 'cause' in error ? databaseCode(error.cause) : null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
