/**
 * Pure v5 panel-layout operations (T-031c / T-070a / T-070c1). Every function here is
 * pure, total and returns a fully normalised `PanelLayout` - never throws,
 * never mutates its input, and is correct for no-op, invalid-index,
 * empty-container and corrupt-input cases. `layout.ts` is the only caller that
 * writes results to persisted storage.
 */

import {
  containerGroups,
  defaultPanelLayout,
  locatePanel,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  normalisePanelLayoutV2,
  normaliseV3Legacy,
  normaliseV4Legacy,
  normaliseV5
} from './containers'
import type { DropTarget } from './drop-target'
import {
  PANEL_DOCK_MIN_WIDTH,
  PANEL_LAYOUT_VERSION,
  PANEL_LAYOUT_VERSION_V2,
  PANEL_LAYOUT_VERSION_V3,
  PANEL_LAYOUT_VERSION_V4,
  PANEL_MAX_WIDTH,
  type ContainerId,
  type DockSide,
  type FloatId,
  type PanelGroup,
  type PanelId,
  type PanelLayout,
  type PanelRect
} from './types'

export { containerGroups, containerMembers, containerOf, locatePanel, allContainerIds, floatContainerById } from './containers'
export { defaultPanelLayout } from './containers'

const integer = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value)
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(parsed) ? parsed : fallback)))
}

/**
 * The single version-dispatching entry point. A v1, v2, v3 or v4 input is chained
 * through the legacy migration in containers.ts; a v5 input (or an
 * internally-constructed intermediate object tagged version 5) runs the full
 * normalisation core; anything else - including no version at all, or a
 * version newer than this build understands - returns the exact v5 default.
 */
export function normalisePanelLayout(value: unknown): PanelLayout {
  if (!value || typeof value !== 'object') return defaultPanelLayout()
  const source = value as { version?: unknown }
  if (source.version === 1) return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(value))))
  if (source.version === PANEL_LAYOUT_VERSION_V2) return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(normalisePanelLayoutV2(value))))
  if (source.version === PANEL_LAYOUT_VERSION_V3) return migrateV4ToV5(migrateV3ToV4(normaliseV3Legacy(value)))
  if (source.version === PANEL_LAYOUT_VERSION_V4) return migrateV4ToV5(normaliseV4Legacy(value))
  if (source.version !== PANEL_LAYOUT_VERSION) return defaultPanelLayout()
  return normaliseV5(value)
}

function cloneLayout(layout: PanelLayout): PanelLayout {
  return structuredClone(normaliseV5(layout))
}

function removeFromAllContainers(layout: PanelLayout, id: PanelId): void {
  for (const dockSide of ['left', 'right'] as const) {
    layout.docks[dockSide] = layout.docks[dockSide]
      .map((group) => ({ ...group, members: group.members.filter((candidate) => candidate !== id) }))
      .filter((group) => group.members.length > 0)
  }
  layout.floats = layout.floats
    .map((float) => ({
      ...float,
      groups: (float.groups ?? [])
        .map((group) => ({ ...group, members: group.members.filter((candidate) => candidate !== id) }))
        .filter((group) => group.members.length > 0)
    }))
    .filter((float) => float.groups.length > 0)
}

function nextZ(layout: PanelLayout): number {
  return Math.max(0, ...layout.floats.map((float) => float.z)) + 1
}

function insertIntoDock(layout: PanelLayout, id: PanelId, dockSide: DockSide, index: number): void {
  const target = layout.docks[dockSide]
  const group: PanelGroup = {
    members: [id],
    active: id,
    height: null,
    collapsed: false
  }
  target.splice(Math.min(Math.max(0, index), target.length), 0, group)
}

/** Inserts into an existing float container at a clamped post-removal index, or synthesises a fresh one at this panel's `floatFallback` if the target id no longer exists (defensive only - live drag data always names a container that still exists at read time). */
function insertIntoFloat(layout: PanelLayout, id: PanelId, floatId: FloatId, index: number): void {
  const group: PanelGroup = {
    members: [id],
    active: id,
    height: null,
    collapsed: false
  }
  const existing = layout.floats.find((float) => float.id === floatId)
  if (existing) {
    existing.groups = existing.groups ?? []
    existing.groups.splice(Math.min(Math.max(0, index), existing.groups.length), 0, group)
    return
  }
  const fallback = layout.panels[id].floatFallback
  layout.floats.push({
    id: floatId,
    x: fallback.x,
    y: fallback.y,
    width: fallback.width,
    height: fallback.height,
    z: nextZ(layout),
    groups: [group],
    members: [id]
  })
}

function insertTabIntoContainer(
  layout: PanelLayout,
  id: PanelId,
  container: ContainerId,
  groupIndex: number,
  tabIndex: number
): boolean {
  let groups: PanelGroup[] | undefined
  if (container === 'left' || container === 'right') {
    groups = layout.docks[container]
  } else {
    const float = layout.floats.find((f) => f.id === container)
    if (float) groups = float.groups
  }
  if (!groups || groupIndex < 0 || groupIndex >= groups.length) {
    return false
  }
  const group = groups[groupIndex]
  const clampedTabIndex = Math.min(Math.max(0, tabIndex), group.members.length)
  group.members.splice(clampedTabIndex, 0, id)
  group.active = id
  return true
}

/**
 * The single atomic move: remove `id` from wherever it currently sits, then
 * insert it at the given `DropTarget` using POST-REMOVAL indices (the contract
 * `resolveDropTarget()` in drop-target.ts returns).
 *
 * For `kind: 'group'`, creates a fresh single-member group at `groupIndex`.
 * For `kind: 'tab'`, inserts `id` at `tabIndex` within the post-removal group
 * at `groupIndex`, activating `id` and preserving group state; invalid or
 * stale tab targets return the untouched normalised layout by value.
 *
 * Handles same-container reorder, cross-dock movement, dock-to-float,
 * float-to-dock and float-to-float identically across docks and float stacks.
 */
export function movePanel(layout: PanelLayout, id: PanelId, target: DropTarget): PanelLayout {
  const base = normaliseV5(layout)
  if (!base.panels[id]) return base
  if (target.kind === 'tab') {
    const result = structuredClone(base)
    removeFromAllContainers(result, id)
    const ok = insertTabIntoContainer(result, id, target.container, target.groupIndex, target.tabIndex)
    if (!ok) return base
    result.panels[id].open = true
    return normaliseV5(result)
  }
  const result = structuredClone(base)
  removeFromAllContainers(result, id)
  result.panels[id].open = true
  if (target.container === 'left' || target.container === 'right') {
    insertIntoDock(result, id, target.container, target.groupIndex)
  } else {
    insertIntoFloat(result, id, target.container, target.groupIndex)
  }
  return normaliseV5(result)
}

/** Detaches `id` into a brand new single-member float container, at `rect` (falling back to its own `floatFallback`). This is what a title-bar drag does on its first move past the drag threshold. */
export function detachPanel(layout: PanelLayout, id: PanelId, rect?: Partial<PanelRect>): PanelLayout {
  const result = cloneLayout(layout)
  removeFromAllContainers(result, id)
  const state = result.panels[id]
  state.open = true
  const base = { ...state.floatFallback, ...rect }
  const group: PanelGroup = {
    members: [id],
    active: id,
    height: null,
    collapsed: false
  }
  result.floats.push({
    id: `float:${result.floats.length}`, // placeholder - normaliseV5 renumbers by z immediately below
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    z: nextZ(result),
    groups: [group],
    members: [id]
  })
  return normaliseV5(result)
}

/** Restores a closed panel to `panels[id].container`/`groupIndex` - its dock position, or (best-effort) the float container it last belonged to, or a fresh float at `floatFallback` if that container no longer exists. */
export function openPanel(layout: PanelLayout, id: PanelId): PanelLayout {
  const result = cloneLayout(layout)
  const state = result.panels[id]
  if (state.open) return result
  state.open = true
  if (state.container === 'left' || state.container === 'right') {
    insertIntoDock(result, id, state.container, state.groupIndex ?? 0)
  } else {
    insertIntoFloat(result, id, state.container, state.groupIndex ?? 0)
  }
  return normaliseV5(result)
}

/** Removes `id` from its container, preserving `container`/`groupIndex`/`tabIndex` for `openPanel()` to restore. Closing never unmounts content. */
export function closePanel(layout: PanelLayout, id: PanelId): PanelLayout {
  const result = cloneLayout(layout)
  const state = result.panels[id]
  const loc = locatePanel(result, id)
  if (loc) {
    state.container = loc.container
    state.groupIndex = loc.groupIndex
    state.tabIndex = loc.tabIndex
  }
  removeFromAllContainers(result, id)
  state.open = false
  return normaliseV5(result)
}

export function togglePanelOpen(layout: PanelLayout, id: PanelId): PanelLayout {
  return layout.panels[id].open ? closePanel(layout, id) : openPanel(layout, id)
}

export function setFloatRect(layout: PanelLayout, floatId: FloatId, rect: Partial<PanelRect>): PanelLayout {
  const result = cloneLayout(layout)
  const container = result.floats.find((float) => float.id === floatId)
  if (!container) return result
  Object.assign(container, rect)
  return normaliseV5(result)
}

export function raiseFloat(layout: PanelLayout, floatId: FloatId): PanelLayout {
  const result = cloneLayout(layout)
  const container = result.floats.find((float) => float.id === floatId)
  if (!container) return result
  container.z = nextZ(result)
  return normaliseV5(result)
}

export function setDockWidth(layout: PanelLayout, dockSide: DockSide, width: number): PanelLayout {
  const result = cloneLayout(layout)
  result.dockWidths[dockSide] = integer(width, result.dockWidths[dockSide], PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
  return normaliseV5(result)
}

export function resetPanelLayout(): PanelLayout {
  return normaliseV5(defaultPanelLayout())
}

/**
 * `dockPanel` keeps its T-031/T-031a exported name because
 * `PanelTitleBar.vue`'s pin action calls it with just an id - dock to
 * wherever this panel was last actually docked (`lastDock`). Optional
 * side/index let same-module callers (and tests) route through the exact
 * same atomic `movePanel` path with an explicit target instead. The
 * float-pinning counterpart has no equivalent wrapper here: `detachPanel`
 * above already does exactly what it would do, so `layout.ts`'s `floatPanel`
 * calls it directly.
 */
export function dockPanel(
  layout: PanelLayout,
  id: PanelId,
  dockSide: DockSide = layout.panels[id].lastDock.side,
  insertionIndex: number = layout.panels[id].lastDock.groupIndex ?? 0
): PanelLayout {
  return movePanel(layout, id, { kind: 'group', container: dockSide, groupIndex: insertionIndex })
}

// --- Pure group operations (T-070c1 / Fixed Decision 9) ---

export function setActiveTab(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number,
  id: PanelId
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  if (!group.members.includes(id)) return result
  group.active = id
  return normaliseV5(result)
}

export function setGroupCollapsed(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number,
  collapsed: boolean
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  group.collapsed = collapsed
  return normaliseV5(result)
}

export function toggleGroupCollapsed(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number
): PanelLayout {
  const groups = containerGroups(layout, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return layout
  return setGroupCollapsed(layout, container, groupIndex, !groups[groupIndex].collapsed)
}

export function setGroupHeight(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number,
  height: number | null
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  group.height = height
  return normaliseV5(result)
}

export function closeGroup(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  for (let tabIndex = 0; tabIndex < group.members.length; tabIndex++) {
    const id = group.members[tabIndex]
    const state = result.panels[id]
    state.open = false
    state.container = container
    state.groupIndex = groupIndex
    state.tabIndex = tabIndex
  }
  groups.splice(groupIndex, 1)
  if (container !== 'left' && container !== 'right') {
    const float = result.floats.find((f) => f.id === container)
    if (float && (float.groups ?? []).length === 0) {
      result.floats = result.floats.filter((f) => f.id !== container)
    }
  }
  return normaliseV5(result)
}

export function floatGroup(
  layout: PanelLayout,
  container: ContainerId,
  groupIndex: number,
  rect?: Partial<PanelRect>
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  const clonedGroup: PanelGroup = {
    members: [...group.members],
    active: group.active,
    height: group.height,
    collapsed: group.collapsed
  }
  groups.splice(groupIndex, 1)
  if (container !== 'left' && container !== 'right') {
    const float = result.floats.find((f) => f.id === container)
    if (float && (float.groups ?? []).length === 0) {
      result.floats = result.floats.filter((f) => f.id !== container)
    }
  }
  const firstMember = clonedGroup.members[0]
  const fallback = result.panels[firstMember]?.floatFallback ?? { x: 24, y: 24, width: 280, height: 560 }
  const base = { ...fallback, ...rect }
  result.floats.push({
    id: `float:${result.floats.length}`,
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    z: nextZ(result),
    groups: [clonedGroup],
    members: [...clonedGroup.members]
  })
  return normaliseV5(result)
}

export function dockGroup(
  layout: PanelLayout,
  floatId: FloatId,
  groupIndex: number
): PanelLayout {
  const result = cloneLayout(layout)
  const float = result.floats.find((f) => f.id === floatId)
  if (!float) return result
  const groups = float.groups ?? []
  if (groupIndex < 0 || groupIndex >= groups.length) return result
  const group = groups[groupIndex]
  const firstMember = group.members[0]
  const lastDock = result.panels[firstMember]?.lastDock ?? { side: 'left', groupIndex: 0, tabIndex: 0 }
  const targetSide = lastDock.side
  const targetIndex = lastDock.groupIndex ?? 0
  const clonedGroup: PanelGroup = {
    members: [...group.members],
    active: group.active,
    height: group.height,
    collapsed: group.collapsed
  }
  float.groups = float.groups ?? []
  float.groups.splice(groupIndex, 1)
  if (float.groups.length === 0) {
    result.floats = result.floats.filter((f) => f.id !== floatId)
  }
  const targetDock = result.docks[targetSide]
  targetDock.splice(Math.min(Math.max(0, targetIndex), targetDock.length), 0, clonedGroup)
  return normaliseV5(result)
}

/**
 * Moves an entire group intact from `sourceContainer`/`sourceGroupIndex` to
 * `target`, using the exact same clone/splice/insert shape as `floatGroup`
 * and `insertIntoDock`/`insertIntoFloat`, but for a whole `PanelGroup`
 * rather than a single panel. `target.groupIndex` is already a
 * post-removal index (the contract `resolveDropTarget()` returns) -
 * inserted directly, never decremented again, even for a same-container
 * move. A missing source, an out-of-range source index, a missing target
 * float, or an identical source/target position are immutable no-ops
 * that return the input by value after normalisation.
 */
export function moveGroup(
  layout: PanelLayout,
  sourceContainer: ContainerId,
  sourceGroupIndex: number,
  target: Extract<DropTarget, { kind: 'group' }>
): PanelLayout {
  const base = normaliseV5(layout)
  const sourceGroups = containerGroups(base, sourceContainer)
  if (sourceGroupIndex < 0 || sourceGroupIndex >= sourceGroups.length) return base
  if (sourceContainer === target.container && sourceGroupIndex === target.groupIndex) return base

  if (target.container !== 'left' && target.container !== 'right') {
    const targetFloatExists = base.floats.some((float) => float.id === target.container)
    if (!targetFloatExists) return base
  }

  const result = structuredClone(base)
  const groups = containerGroups(result, sourceContainer)
  const [removed] = groups.splice(sourceGroupIndex, 1)
  const clonedGroup: PanelGroup = {
    members: [...removed.members],
    active: removed.active,
    height: removed.height,
    collapsed: removed.collapsed
  }
  if (sourceContainer !== 'left' && sourceContainer !== 'right') {
    const sourceFloat = result.floats.find((float) => float.id === sourceContainer)
    if (sourceFloat && (sourceFloat.groups ?? []).length === 0) {
      result.floats = result.floats.filter((float) => float.id !== sourceContainer)
    }
  }
  if (target.container === 'left' || target.container === 'right') {
    const dock = result.docks[target.container]
    dock.splice(Math.min(Math.max(0, target.groupIndex), dock.length), 0, clonedGroup)
  } else {
    const targetFloat = result.floats.find((float) => float.id === target.container)
    if (!targetFloat) return base
    targetFloat.groups = targetFloat.groups ?? []
    targetFloat.groups.splice(Math.min(Math.max(0, target.groupIndex), targetFloat.groups.length), 0, clonedGroup)
  }
  return normaliseV5(result)
}

// --- Compatibility wrappers (Fixed Decision 8) ---

export function setPanelCollapsed(layout: PanelLayout, id: PanelId, collapsed: boolean): PanelLayout {
  const result = cloneLayout(layout)
  const loc = locatePanel(result, id)
  if (!loc) return normaliseV5(result)
  return setGroupCollapsed(result, loc.container, loc.groupIndex, collapsed)
}

/** Pins one member's height in pixels, or clears it to `null` so the member takes its registry default (or absorbs the leftover, if it is the last such member). A no-op for a member that is not in `container`. */
export function setMemberHeight(
  layout: PanelLayout,
  container: ContainerId,
  id: PanelId,
  height: number | null
): PanelLayout {
  const result = cloneLayout(layout)
  const groups = containerGroups(result, container)
  const groupIndex = groups.findIndex((g) => g.members.includes(id))
  if (groupIndex === -1) return result
  return setGroupHeight(result, container, groupIndex, height)
}

