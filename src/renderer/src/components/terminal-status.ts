import type { TerminalStatus } from '../../../shared/terminal'

export const isLiveStatus = (status: TerminalStatus | undefined) =>
  status === 'starting' || status === 'running' || status === 'stopping'

export const terminalStatusLabel = (status: TerminalStatus | undefined) => {
  switch (status) {
    case 'starting':
      return 'Starting'
    case 'running':
      return 'Running'
    case 'stopping':
      return 'Stopping'
    case 'exited':
      return 'Exited'
    case 'failed':
      return 'Failed'
    default:
      return 'Idle'
  }
}
