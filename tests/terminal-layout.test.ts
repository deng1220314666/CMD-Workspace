import { describe, expect, it } from 'vitest'
import {
  createTerminalLayout,
  profileForPane,
  reconcileTerminalLayout,
  removeProfileFromLayout,
  selectProfileInLayout,
  splitTerminalLayout,
  updateSplitSizes,
} from '../src/renderer/src/terminal-layout'

describe('terminal split layout', () => {
  it('splits the active pane without changing the existing profile', () => {
    const initial = createTerminalLayout('profile-a')
    const split = splitTerminalLayout(
      initial,
      'profile-b',
      'horizontal',
      'split-1',
      'pane-b',
    )
    expect(split.root).toMatchObject({
      type: 'split',
      direction: 'horizontal',
      children: [{ profileId: 'profile-a' }, { profileId: 'profile-b' }],
    })
    expect(profileForPane(split, split.activePaneId)).toBe('profile-b')
  })

  it('selects an existing pane or replaces only the active leaf', () => {
    const split = splitTerminalLayout(
      createTerminalLayout('profile-a'),
      'profile-b',
      'vertical',
      'split-1',
      'pane-b',
    )
    expect(
      profileForPane(
        selectProfileInLayout(split, 'profile-a'),
        'pane-profile-a',
      ),
    ).toBe('profile-a')
    const replaced = selectProfileInLayout(split, 'profile-c')
    expect(profileForPane(replaced, 'pane-b')).toBe('profile-c')
  })

  it('prunes closed profiles and preserves split sizes', () => {
    const split = splitTerminalLayout(
      createTerminalLayout('profile-a'),
      'profile-b',
      'horizontal',
      'split-1',
      'pane-b',
    )
    const resized = updateSplitSizes(split, 'split-1', [35, 65])
    expect(resized.root).toMatchObject({ sizes: [35, 65] })
    expect(removeProfileFromLayout(resized, 'profile-b').root).toMatchObject({
      profileId: 'profile-a',
    })
  })

  it('reconciles stale and duplicate persisted leaves', () => {
    const split = splitTerminalLayout(
      createTerminalLayout('profile-a'),
      'profile-b',
      'horizontal',
      'split-1',
      'pane-b',
    )
    const reconciled = reconcileTerminalLayout(
      split,
      ['profile-a'],
      'profile-a',
    )
    expect(reconciled.root).toMatchObject({ profileId: 'profile-a' })
  })
})
