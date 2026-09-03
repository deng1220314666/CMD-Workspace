import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, Menu } from 'electron'
import { registerIpc } from './ipc'
import {
  loadEnvironment,
  type EnvironmentResult,
} from '../database/environment'
import { PersistenceRepository } from '../database/repository'

if (process.env.CMD_WORKSPACE_SMOKE === '1') app.disableHardwareAcceleration()
let environment: EnvironmentResult = { error: 'Configuration is not loaded' }
let cleanupIpc: (() => void) | undefined
let repository: PersistenceRepository | null = null
let databaseError: string | null = null

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '..', 'renderer', 'logo', 'logo-2.png'),
    backgroundColor: '#111923',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  if (developmentUrl) void window.loadURL(developmentUrl)
  else
    void window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  if (process.env.CMD_WORKSPACE_SMOKE === '1') {
    window.webContents.once('did-finish-load', () => {
      void window.webContents
        .executeJavaScript(
          `new Promise((resolve, reject) => {
          const started = Date.now();
          const poll = () => {
            const terminal = document.querySelector('.terminal-host');
            const emptyWorkspace = document.querySelector('.empty-workspace');
            const state = document.querySelector('[class^="state-"]')?.textContent;
            if (emptyWorkspace || (terminal && state === 'running')) {
              resolve({ terminal: Boolean(terminal), emptyWorkspace: Boolean(emptyWorkspace), state, nodeGlobal: typeof process });
            } else if (Date.now() - started > 10000) {
              reject(new Error('Renderer terminal did not reach running state'));
            } else setTimeout(poll, 50);
          };
          poll();
        })`,
        )
        .then((result) => {
          console.log(`ELECTRON_SMOKE_OK ${JSON.stringify(result)}`)
          app.quit()
        })
        .catch((error: unknown) => {
          console.error('ELECTRON_SMOKE_FAILED', error)
          process.exitCode = 1
          app.quit()
        })
    })
  }
  return window
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  const configPaths = app.isPackaged
    ? [
        path.join(path.dirname(process.execPath), '.env'),
        path.join(app.getPath('userData'), '.env'),
      ]
    : [path.resolve(process.cwd(), '.env')]
  environment = loadEnvironment(process.env, configPaths)
  if (environment.databaseUrl) {
    try {
      repository = await PersistenceRepository.connect(
        environment.databaseUrl,
        path.resolve(__dirname, '..', '..', 'drizzle'),
      )
      await repository.reconcileStaleRuns()
    } catch (error) {
      databaseError = error instanceof Error ? error.message : String(error)
    }
  } else {
    databaseError = null
  }
  cleanupIpc = registerIpc(
    () => ({
      platform: process.platform,
      homeDirectory: app.getPath('home'),
      environmentError: environment.error,
      databaseError,
    }),
    repository,
    randomUUID(),
  )
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  cleanupIpc?.()
  if (repository) void repository.close()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
