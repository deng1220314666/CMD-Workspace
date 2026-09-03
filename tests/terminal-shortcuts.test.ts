import { describe, expect, it } from 'vitest'
import {
  isTerminalCopyShortcut,
  shouldCopyTerminalSelection,
  terminalShortcutAction,
} from '../src/renderer/src/terminal-shortcuts'

const keyEvent = (
  key: string,
  modifiers: Partial<{
    ctrlKey: boolean
    shiftKey: boolean
    metaKey: boolean
  }> = {},
) => ({
  key,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  ...modifiers,
})

describe('terminal tool shortcuts', () => {
  it('recognizes paste, find, and clear without claiming plain Ctrl+C', () => {
    const event = {
      key: 'v',
      ctrlKey: true,
      shiftKey: true,
      metaKey: false,
    }
    expect(terminalShortcutAction(event, false)).toBe('paste')
    expect(
      terminalShortcutAction({ ...event, key: 'f', shiftKey: false }, false),
    ).toBe('find')
    expect(terminalShortcutAction({ ...event, key: 'k' }, false)).toBe('clear')
    expect(
      terminalShortcutAction({ ...event, key: 'c', shiftKey: false }, false),
    ).toBeNull()
  })

  it('recognizes workspace shortcuts while a terminal owns focus', () => {
    const event = {
      key: 'h',
      ctrlKey: true,
      shiftKey: true,
      metaKey: false,
    }
    expect(terminalShortcutAction(event, false)).toBe('split-horizontal')
    expect(terminalShortcutAction({ ...event, key: 'j' }, false)).toBe(
      'split-vertical',
    )
    expect(
      terminalShortcutAction(
        { ...event, key: 'PageDown', shiftKey: false },
        false,
      ),
    ).toBe('next-tab')
    expect(
      terminalShortcutAction(
        { ...event, key: 'F2', ctrlKey: false, shiftKey: false },
        false,
      ),
    ).toBe('rename')
  })
})

describe('terminal copy shortcuts', () => {
  it('recognizes explicit copy combinations', () => {
    expect(
      isTerminalCopyShortcut(keyEvent('c', { ctrlKey: true, shiftKey: true })),
    ).toBe(true)
    expect(isTerminalCopyShortcut(keyEvent('Insert', { ctrlKey: true }))).toBe(
      true,
    )
    expect(isTerminalCopyShortcut(keyEvent('c', { metaKey: true }))).toBe(true)
  })

  it('leaves plain Ctrl+C available to the PTY', () => {
    expect(isTerminalCopyShortcut(keyEvent('c', { ctrlKey: true }))).toBe(false)
  })

  it('uses Ctrl+C for copy only while terminal text is selected', () => {
    const ctrlC = keyEvent('c', { ctrlKey: true })
    expect(shouldCopyTerminalSelection(ctrlC, true)).toBe(true)
    expect(shouldCopyTerminalSelection(ctrlC, false)).toBe(false)
  })
})
