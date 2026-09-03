export type SplitDirection = 'horizontal' | 'vertical'

export interface TerminalLayoutLeaf {
  type: 'leaf'
  id: string
  profileId: string
}

export interface TerminalLayoutSplit {
  type: 'split'
  id: string
  direction: SplitDirection
  children: [TerminalLayoutNode, TerminalLayoutNode]
  sizes: [number, number]
}

export type TerminalLayoutNode = TerminalLayoutLeaf | TerminalLayoutSplit

export interface ProjectTerminalLayout {
  root: TerminalLayoutNode | null
  activePaneId: string | null
}

export const emptyTerminalLayout: ProjectTerminalLayout = {
  root: null,
  activePaneId: null,
}

export function createTerminalLayout(profileId: string): ProjectTerminalLayout {
  const leaf = createLeaf(profileId)
  return { root: leaf, activePaneId: leaf.id }
}

export function selectProfileInLayout(
  layout: ProjectTerminalLayout,
  profileId: string,
): ProjectTerminalLayout {
  const existing = findLeafByProfile(layout.root, profileId)
  if (existing) return { ...layout, activePaneId: existing.id }
  if (!layout.root) return createTerminalLayout(profileId)
  const activePaneId =
    layout.activePaneId && findLeafById(layout.root, layout.activePaneId)
      ? layout.activePaneId
      : firstLeaf(layout.root).id
  return {
    root: replaceLeaf(layout.root, activePaneId, (leaf) => ({
      ...leaf,
      profileId,
    })),
    activePaneId,
  }
}

export function splitTerminalLayout(
  layout: ProjectTerminalLayout,
  profileId: string,
  direction: SplitDirection,
  splitId: string,
  paneId: string,
): ProjectTerminalLayout {
  if (!layout.root) {
    const leaf = { type: 'leaf', id: paneId, profileId } as const
    return { root: leaf, activePaneId: leaf.id }
  }
  const activePaneId =
    layout.activePaneId && findLeafById(layout.root, layout.activePaneId)
      ? layout.activePaneId
      : firstLeaf(layout.root).id
  const nextLeaf: TerminalLayoutLeaf = { type: 'leaf', id: paneId, profileId }
  return {
    root: replaceLeaf(layout.root, activePaneId, (leaf) => ({
      type: 'split',
      id: splitId,
      direction,
      children: [leaf, nextLeaf],
      sizes: [50, 50],
    })),
    activePaneId: nextLeaf.id,
  }
}

export function removeProfileFromLayout(
  layout: ProjectTerminalLayout,
  profileId: string,
): ProjectTerminalLayout {
  const root = pruneProfile(layout.root, profileId)
  if (!root) return emptyTerminalLayout
  const activePaneId =
    layout.activePaneId && findLeafById(root, layout.activePaneId)
      ? layout.activePaneId
      : firstLeaf(root).id
  return { root, activePaneId }
}

export function reconcileTerminalLayout(
  layout: ProjectTerminalLayout | undefined,
  profileIds: string[],
  selectedProfileId: string | null,
): ProjectTerminalLayout {
  if (!profileIds.length) return emptyTerminalLayout
  const allowed = new Set(profileIds)
  const root = pruneInvalid(layout?.root ?? null, allowed, new Set())
  const reconciled = root
    ? {
        root,
        activePaneId:
          layout?.activePaneId && findLeafById(root, layout.activePaneId)
            ? layout.activePaneId
            : firstLeaf(root).id,
      }
    : createTerminalLayout(selectedProfileId ?? profileIds[0])
  return selectedProfileId
    ? selectProfileInLayout(reconciled, selectedProfileId)
    : reconciled
}

export function updateSplitSizes(
  layout: ProjectTerminalLayout,
  splitId: string,
  sizes: [number, number],
): ProjectTerminalLayout {
  const update = (node: TerminalLayoutNode): TerminalLayoutNode => {
    if (node.type === 'leaf') return node
    if (node.id === splitId) return { ...node, sizes }
    return {
      ...node,
      children: [update(node.children[0]), update(node.children[1])],
    }
  }
  return layout.root ? { ...layout, root: update(layout.root) } : layout
}

export function setActivePane(
  layout: ProjectTerminalLayout,
  paneId: string,
): ProjectTerminalLayout {
  return findLeafById(layout.root, paneId)
    ? { ...layout, activePaneId: paneId }
    : layout
}

export function profileForPane(
  layout: ProjectTerminalLayout,
  paneId: string | null,
): string | null {
  return paneId ? (findLeafById(layout.root, paneId)?.profileId ?? null) : null
}

export function paneForProfile(
  layout: ProjectTerminalLayout,
  profileId: string,
): string | null {
  return findLeafByProfile(layout.root, profileId)?.id ?? null
}

export function profileIdsInLayout(node: TerminalLayoutNode | null): string[] {
  if (!node) return []
  return node.type === 'leaf'
    ? [node.profileId]
    : [
        ...profileIdsInLayout(node.children[0]),
        ...profileIdsInLayout(node.children[1]),
      ]
}

function createLeaf(profileId: string): TerminalLayoutLeaf {
  return { type: 'leaf', id: `pane-${profileId}`, profileId }
}

function firstLeaf(node: TerminalLayoutNode): TerminalLayoutLeaf {
  return node.type === 'leaf' ? node : firstLeaf(node.children[0])
}

function findLeafById(
  node: TerminalLayoutNode | null,
  paneId: string,
): TerminalLayoutLeaf | null {
  if (!node) return null
  if (node.type === 'leaf') return node.id === paneId ? node : null
  return (
    findLeafById(node.children[0], paneId) ??
    findLeafById(node.children[1], paneId)
  )
}

function findLeafByProfile(
  node: TerminalLayoutNode | null,
  profileId: string,
): TerminalLayoutLeaf | null {
  if (!node) return null
  if (node.type === 'leaf') return node.profileId === profileId ? node : null
  return (
    findLeafByProfile(node.children[0], profileId) ??
    findLeafByProfile(node.children[1], profileId)
  )
}

function replaceLeaf(
  node: TerminalLayoutNode,
  paneId: string,
  replacement: (leaf: TerminalLayoutLeaf) => TerminalLayoutNode,
): TerminalLayoutNode {
  if (node.type === 'leaf') return node.id === paneId ? replacement(node) : node
  return {
    ...node,
    children: [
      replaceLeaf(node.children[0], paneId, replacement),
      replaceLeaf(node.children[1], paneId, replacement),
    ],
  }
}

function pruneProfile(
  node: TerminalLayoutNode | null,
  profileId: string,
): TerminalLayoutNode | null {
  if (!node) return null
  if (node.type === 'leaf') return node.profileId === profileId ? null : node
  const first = pruneProfile(node.children[0], profileId)
  const second = pruneProfile(node.children[1], profileId)
  if (!first) return second
  if (!second) return first
  return { ...node, children: [first, second] }
}

function pruneInvalid(
  node: TerminalLayoutNode | null,
  allowed: Set<string>,
  seen: Set<string>,
): TerminalLayoutNode | null {
  if (!node) return null
  if (node.type === 'leaf') {
    if (!allowed.has(node.profileId) || seen.has(node.profileId)) return null
    seen.add(node.profileId)
    return node
  }
  const first = pruneInvalid(node.children[0], allowed, seen)
  const second = pruneInvalid(node.children[1], allowed, seen)
  if (!first) return second
  if (!second) return first
  return { ...node, children: [first, second] }
}
