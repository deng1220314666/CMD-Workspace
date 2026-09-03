import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { AppInfo, ProjectInfo } from '../shared/terminal'
import {
  TERMINAL_DATA_CHANNEL,
  TERMINAL_STATUS_CHANNEL,
} from '../shared/terminal'
import {
  createTerminalSchema,
  closeTerminalSchema,
  createProfileSchema,
  deleteProfileSchema,
  renameProfileSchema,
  reorderProfilesSchema,
  resizeTerminalSchema,
  restartTerminalSchema,
  saveSelectionSchema,
  terminalIdSchema,
  updateProjectAnnotationsSchema,
  validationMessage,
  writeTerminalSchema,
} from '../shared/validation'
import {
  normalizeProjectPath,
  type PersistenceRepository,
} from '../database/repository'
import { TerminalManager } from './terminal-manager'
import { TerminalRunTracker } from './run-tracker'

function parse<T>(
  schema: {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: import('zod').ZodError }
  },
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new Error(`Invalid IPC payload: ${validationMessage(result.error)}`)
  return result.data
}

export function registerIpc(
  getAppInfo: () => AppInfo,
  repository: PersistenceRepository | null,
  applicationInstanceId: string,
): () => void {
  const publish = (channel: string, payload: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }
  const runTracker = repository
    ? new TerminalRunTracker(repository, applicationInstanceId)
    : null
  const manager = new TerminalManager({
    onData: (event) => publish(TERMINAL_DATA_CHANNEL, event),
    onStatus: (event) => {
      publish(TERMINAL_STATUS_CHANNEL, event)
      void runTracker?.recordStatus(event).catch((error: unknown) =>
        publish(TERMINAL_STATUS_CHANNEL, {
          ...event,
          message: `Could not persist terminal run state: ${error instanceof Error ? error.message : String(error)}`,
        }),
      )
    },
  })
  const requireRepository = () => {
    if (!repository)
      throw new Error(
        'PostgreSQL persistence is unavailable; check the database connection and restart the app',
      )
    return repository
  }

  ipcMain.handle('app:info', () => getAppInfo())
  ipcMain.handle('project:import', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Import local project',
      buttonLabel: 'Import project',
      properties: ['openDirectory'],
    })
    if (selection.canceled || selection.filePaths.length === 0) return null
    const selectedPath = path.resolve(selection.filePaths[0])
    const info = await stat(selectedPath).catch(() => null)
    if (!info?.isDirectory())
      throw new Error(`Project directory does not exist: ${selectedPath}`)
    const resolvedPath = await realpath(selectedPath)
    const project: Omit<ProjectInfo, 'projectId'> = {
      name: path.basename(resolvedPath) || resolvedPath,
      path: resolvedPath,
    }
    const persisted = await requireRepository().importProject({
      name: project.name,
      displayPath: project.path,
      normalizedPath: normalizeProjectPath(project.path),
    })
    return {
      projectId: persisted.projectId,
      name: persisted.name,
      path: persisted.path,
    }
  })
  ipcMain.handle('persistence:load-workspace', () =>
    requireRepository().loadWorkspace(),
  )
  ipcMain.handle('persistence:update-project-annotations', (_event, value) => {
    const request = parse(updateProjectAnnotationsSchema, value)
    return requireRepository().updateProjectAnnotations(request.projectId, {
      remarkName: request.remarkName || null,
      purpose: request.purpose || null,
    })
  })
  ipcMain.handle('persistence:create-profile', (_event, value) => {
    const request = parse(createProfileSchema, value)
    return requireRepository().createProfile(request)
  })
  ipcMain.handle('persistence:rename-profile', (_event, value) => {
    const request = parse(renameProfileSchema, value)
    return requireRepository().renameProfile(
      request.profileId,
      request.displayName,
    )
  })
  ipcMain.handle('persistence:reorder-profiles', (_event, value) => {
    const request = parse(reorderProfilesSchema, value)
    return requireRepository().reorderProfiles(
      request.projectId,
      request.orderedProfileIds,
    )
  })
  ipcMain.handle('persistence:delete-profile', (_event, value) =>
    requireRepository().deleteProfile(
      parse(deleteProfileSchema, value).profileId,
    ),
  )
  ipcMain.handle('persistence:save-selection', (_event, value) =>
    requireRepository().saveSelection(parse(saveSelectionSchema, value)),
  )
  ipcMain.handle('terminal:create', async (_event, value) => {
    const request = parse(createTerminalSchema, value)
    const runtime = await manager.create(request)
    try {
      requireRepository()
      await runTracker?.recordStart(request.profileId, runtime)
      return runtime
    } catch (error) {
      await manager.close(runtime.terminalId, 'force', runtime.pid)
      throw error
    }
  })
  ipcMain.handle('terminal:list', () => manager.list())
  ipcMain.handle('terminal:snapshot', (_event, value) =>
    manager.snapshot(parse(terminalIdSchema, value).terminalId),
  )
  ipcMain.handle('terminal:write', (_event, value) => {
    const request = parse(writeTerminalSchema, value)
    manager.write(request.terminalId, request.data)
  })
  ipcMain.handle('terminal:resize', (_event, value) => {
    const request = parse(resizeTerminalSchema, value)
    manager.resize(request.terminalId, request.cols, request.rows)
  })
  ipcMain.handle('terminal:stop', (_event, value) =>
    manager.stop(parse(terminalIdSchema, value).terminalId),
  )
  ipcMain.handle('terminal:kill', (_event, value) =>
    manager.kill(parse(terminalIdSchema, value).terminalId),
  )
  ipcMain.handle('terminal:restart', async (_event, value) => {
    const request = parse(restartTerminalSchema, value)
    requireRepository()
    const profileId = runTracker?.profileIdFor(request.terminalId)
    if (!profileId)
      throw new Error('Terminal profile association does not exist')
    const runtime = await manager.restart(
      request.terminalId,
      request.expectedPid,
    )
    await runTracker?.recordStart(profileId, runtime)
    return runtime
  })
  ipcMain.handle('terminal:close', async (_event, value) => {
    const request = parse(closeTerminalSchema, value)
    await manager.close(request.terminalId, request.mode, request.expectedPid)
    runTracker?.forget(request.terminalId)
  })

  return () => {
    manager.dispose()
    for (const channel of [
      'app:info',
      'project:import',
      'persistence:load-workspace',
      'persistence:update-project-annotations',
      'persistence:create-profile',
      'persistence:rename-profile',
      'persistence:reorder-profiles',
      'persistence:delete-profile',
      'persistence:save-selection',
      'terminal:create',
      'terminal:list',
      'terminal:snapshot',
      'terminal:write',
      'terminal:resize',
      'terminal:stop',
      'terminal:kill',
      'terminal:restart',
      'terminal:close',
    ])
      ipcMain.removeHandler(channel)
  }
}
