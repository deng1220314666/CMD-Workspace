import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type {
  CmdWorkspaceApi,
  TerminalDataEvent,
  TerminalStatusEvent,
} from '../shared/terminal'
import {
  TERMINAL_DATA_CHANNEL,
  TERMINAL_STATUS_CHANNEL,
} from '../shared/terminal'

const api: CmdWorkspaceApi = {
  ai: {
    listProviders: () => ipcRenderer.invoke('ai:list-providers'),
    saveProvider: (request) => ipcRenderer.invoke('ai:save-provider', request),
    deleteProvider: (request) =>
      ipcRenderer.invoke('ai:delete-provider', request),
    deleteCredential: (request) =>
      ipcRenderer.invoke('ai:delete-credential', request),
    testConnection: (request) =>
      ipcRenderer.invoke('ai:test-connection', request),
  },
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  project: {
    import: () => ipcRenderer.invoke('project:import'),
  },
  clipboard: {
    readText: async () => {
      const text = clipboard.readText()
      if (text.length > 5_000_000)
        throw new Error('Clipboard text must be under 5 MB')
      return text
    },
    writeText: async (text) => {
      if (typeof text !== 'string' || text.length > 5_000_000)
        throw new Error('Clipboard text must be a string under 5 MB')
      clipboard.writeText(text)
    },
  },
  persistence: {
    loadWorkspace: () => ipcRenderer.invoke('persistence:load-workspace'),
    updateProjectAnnotations: (request) =>
      ipcRenderer.invoke('persistence:update-project-annotations', request),
    deleteProject: (request) =>
      ipcRenderer.invoke('persistence:delete-project', request),
    createProfile: (request) =>
      ipcRenderer.invoke('persistence:create-profile', request),
    renameProfile: (request) =>
      ipcRenderer.invoke('persistence:rename-profile', request),
    reorderProfiles: (request) =>
      ipcRenderer.invoke('persistence:reorder-profiles', request),
    deleteProfile: (request) =>
      ipcRenderer.invoke('persistence:delete-profile', request),
    saveSelection: (request) =>
      ipcRenderer.invoke('persistence:save-selection', request),
  },
  terminal: {
    create: (request) => ipcRenderer.invoke('terminal:create', request),
    list: () => ipcRenderer.invoke('terminal:list'),
    snapshot: (request) => ipcRenderer.invoke('terminal:snapshot', request),
    write: (request) => ipcRenderer.invoke('terminal:write', request),
    resize: (request) => ipcRenderer.invoke('terminal:resize', request),
    stop: (request) => ipcRenderer.invoke('terminal:stop', request),
    kill: (request) => ipcRenderer.invoke('terminal:kill', request),
    restart: (request) => ipcRenderer.invoke('terminal:restart', request),
    close: (request) => ipcRenderer.invoke('terminal:close', request),
    onData: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: TerminalDataEvent,
      ) => listener(payload)
      ipcRenderer.on(TERMINAL_DATA_CHANNEL, handler)
      return () => ipcRenderer.removeListener(TERMINAL_DATA_CHANNEL, handler)
    },
    onStatus: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: TerminalStatusEvent,
      ) => listener(payload)
      ipcRenderer.on(TERMINAL_STATUS_CHANNEL, handler)
      return () => ipcRenderer.removeListener(TERMINAL_STATUS_CHANNEL, handler)
    },
  },
}

contextBridge.exposeInMainWorld('cmdWorkspace', api)
