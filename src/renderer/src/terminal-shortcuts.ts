export interface TerminalKeyModifiers {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export type TerminalShortcutAction =
  | 'copy'
  | 'paste'
  | 'find'
  | 'clear'
  | 'new-terminal'
  | 'split-horizontal'
  | 'split-vertical'
  | 'previous-tab'
  | 'next-tab'
  | 'rename'
  | 'close'

export function isTerminalCopyShortcut(event: TerminalKeyModifiers): boolean {
  const key = event.key.toLowerCase()
  return (
    (((event.ctrlKey && event.shiftKey) || event.metaKey) && key === 'c') ||
    (event.ctrlKey && key === 'insert')
  )
}

export function shouldCopyTerminalSelection(
  event: TerminalKeyModifiers,
  hasSelection: boolean,
): boolean {
  if (isTerminalCopyShortcut(event)) return true
  return (
    hasSelection &&
    event.ctrlKey &&
    !event.shiftKey &&
    !event.metaKey &&
    event.key.toLowerCase() === 'c'
  )
}

export function terminalShortcutAction(
  event: TerminalKeyModifiers,
  hasSelection: boolean,
): TerminalShortcutAction | null {
  if (shouldCopyTerminalSelection(event, hasSelection)) return 'copy'
  const key = event.key.toLowerCase()
  if (event.ctrlKey && !event.metaKey && key === 'v') return 'paste'
  if (!event.ctrlKey && event.shiftKey && !event.metaKey && key === 'insert')
    return 'paste'
  if (event.ctrlKey && !event.shiftKey && !event.metaKey && key === 'f')
    return 'find'
  if (event.ctrlKey && event.shiftKey && !event.metaKey && key === 'k')
    return 'clear'
  if (event.ctrlKey && event.shiftKey && !event.metaKey && key === 'n')
    return 'new-terminal'
  if (event.ctrlKey && event.shiftKey && !event.metaKey && key === 'h')
    return 'split-horizontal'
  if (event.ctrlKey && event.shiftKey && !event.metaKey && key === 'j')
    return 'split-vertical'
  if (event.ctrlKey && !event.shiftKey && !event.metaKey && key === 'pageup')
    return 'previous-tab'
  if (event.ctrlKey && !event.shiftKey && !event.metaKey && key === 'pagedown')
    return 'next-tab'
  if (!event.ctrlKey && !event.shiftKey && !event.metaKey && key === 'f2')
    return 'rename'
  if (event.ctrlKey && event.shiftKey && !event.metaKey && key === 'w')
    return 'close'
  return null
}
