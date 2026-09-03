/// <reference types="vite/client" />

import type { CmdWorkspaceApi } from '../../shared/terminal'

declare global {
  interface Window {
    cmdWorkspace: CmdWorkspaceApi
  }
}

export {}
