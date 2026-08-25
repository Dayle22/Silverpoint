import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

import type { DropTarget } from './drop-target'
import {
  closeGroup as closeGroupPure,
  closePanel,
  containerGroups as containerGroupsPure,
  containerOf,
  defaultPanelLayout,
  detachPanel,
  dockGroup as dockGroupPure,
  dockPanel as dockPanelPure,
  floatGroup as floatGroupPure,
  locatePanel,
  moveGroup as moveGroupPure,
  movePanel as movePanelPure,
  normalisePanelLayout,
  openPanel,
  raiseFloat as raiseFloatPure,
  resetPanelLayout as resetPure,
  setActiveTab as setActiveTabPure,
  setFloatRect as setFloatRectPure,
  setGroupCollapsed as setGroupCollapsedPure,
  setGroupHeight as setGroupHeightPure,
  setMemberHeight as setMemberHeightPure,
  setPanelCollapsed as setPanelCollapsedPure,
  togglePanelOpen as togglePanelOpenPure
} from './operations'
import { PANEL_REGISTRY_BY_ID } from './registry'
import {
  isFloatId,
  PANEL_FLOAT_TITLE_HEIGHT,
  PANEL_LAYOUT_KEY,
  type ContainerId,
  type FloatId,
  type LegacyPanelId,
  type PanelGroup,
  type PanelId,
  type PanelLayout,
  type PanelRect,
  type PanelSizing
} from './types'

const stored = useLocalStorage<PanelLayout>(PANEL_LAYOUT_KEY, defaultPanelLayout(), {
  writeDefaults: false,
  serializer: {
    read: (value) => { try { return normalisePanelLayout(JSON.parse(value)) } catch { return defaultPanelLayout() } },
    write: (value) => JSON.stringify(normalisePanelLayout(value))
  }
})

export const panelLayout = computed<PanelLayout>(() => normalisePanelLayout(stored.value))

function write(next: PanelLayout): void { stored.value = normalisePanelLayout(next) }

export function writePanelLayout(next: PanelLayout): void { write(next) }

function resolveId(id: LegacyPanelId): PanelId { return id === 'properties' ? 'appearance' : id }

/** Which container currently hosts this panel; `null` while closed. */
export function panelContainerId(id: LegacyPanelId): ContainerId | null {
  return containerOf(panelLayout.value, resolveId(id))
}
export function panelCollapsed(id: LegacyPanelId): boolean {
  return panelLayout.value.panels[resolveId(id)].collapsed
}
export function panelSizing(id: LegacyPanelId): PanelSizing {
  return PANEL_REGISTRY_BY_ID[resolveId(id)].sizing
}
export function isPanelFloating(id: LegacyPanelId): boolean {
  const container = panelContainerId(id)
  return container !== null && isFloatId(container)
}

export const dockedPanelIds = computed<PanelId[]>(() => [
  ...panelLayout.value.docks.left.flatMap((g) => g.members),
  ...panelLayout.value.docks.right.flatMap((g) => g.members)
])
/** Every live floating window, in ascending z order - the render order for `PanelOverlay`. */
export const floatContainerIds = computed<FloatId[]>(() => [...panelLayout.value.floats].sort((a, b) => a.z - b.z).map((entry) => entry.id))

export function floatContainer(id: FloatId) { return panelLayout.value.floats.find((entry) => entry.id === id) }

export function setFloatRect(id: FloatId, rect: Partial<PanelRect>): void { write(setFloatRectPure(panelLayout.value, id, rect)) }
export function raiseFloat(id: FloatId): void { write(raiseFloatPure(panelLayout.value, id)) }
/** Raises this panel's container to the top, a no-op while docked. Used by title-bar/frame pointerdown to bring the clicked window forward. */
export function raisePanelContainer(id: LegacyPanelId): void {
  const container = panelContainerId(id)
  if (container && isFloatId(container)) raiseFloat(container)
}

export function movePanel(id: PanelId, target: DropTarget): void { write(movePanelPure(panelLayout.value, id, target)) }

export function setMemberHeight(container: ContainerId, id: PanelId, height: number | null): void {
  write(setMemberHeightPure(panelLayout.value, container, id, height))
}

/** Detaches this panel into a brand new single-member float, at `rect` (falling back to its own `floatFallback`). PanelTitleBar.vue's pin/unpin action calls this directly by name, so the name is kept stable. */
export function floatPanel(id: PanelId, rect?: Partial<PanelRect>): void { write(detachPanel(panelLayout.value, id, rect)) }
export function dockPanel(id: PanelId): void { write(dockPanelPure(panelLayout.value, id)) }
export function togglePanelCollapsed(id: LegacyPanelId): void { const registeredId = resolveId(id); write(setPanelCollapsedPure(panelLayout.value, registeredId, !panelLayout.value.panels[registeredId].collapsed)) }
export function setPanelCollapsed(id: LegacyPanelId, collapsed: boolean): void { write(setPanelCollapsedPure(panelLayout.value, resolveId(id), collapsed)) }
export function resetPanelLayout(): void { write(resetPure()) }
export function closeRegisteredPanel(id: PanelId): void { write(closePanel(panelLayout.value, id)) }
export function openRegisteredPanel(id: PanelId): void { write(openPanel(panelLayout.value, id)) }
export function togglePanelOpen(id: PanelId): void { write(togglePanelOpenPure(panelLayout.value, id)) }

// --- Group reactive wrappers (T-070c1) ---

export function containerGroups(containerId: ContainerId): PanelGroup[] {
  return containerGroupsPure(panelLayout.value, containerId)
}

export function groupOf(panelId: LegacyPanelId): PanelGroup | null {
  const id = resolveId(panelId)
  const loc = locatePanel(panelLayout.value, id)
  if (!loc) return null
  const groups = containerGroupsPure(panelLayout.value, loc.container)
  return groups[loc.groupIndex] ?? null
}

export function setActiveTab(container: ContainerId, groupIndex: number, id: PanelId): void {
  write(setActiveTabPure(panelLayout.value, container, groupIndex, id))
}

export function setGroupCollapsed(container: ContainerId, groupIndex: number, collapsed: boolean): void {
  write(setGroupCollapsedPure(panelLayout.value, container, groupIndex, collapsed))
}

export function toggleGroupCollapsed(container: ContainerId, groupIndex: number): void {
  const groups = containerGroupsPure(panelLayout.value, container)
  if (groupIndex >= 0 && groupIndex < groups.length) {
    write(setGroupCollapsedPure(panelLayout.value, container, groupIndex, !groups[groupIndex].collapsed))
  }
}

export function setGroupHeight(container: ContainerId, groupIndex: number, height: number | null): void {
  write(setGroupHeightPure(panelLayout.value, container, groupIndex, height))
}

export function closeGroup(container: ContainerId, groupIndex: number): void {
  write(closeGroupPure(panelLayout.value, container, groupIndex))
}

export function floatGroup(container: ContainerId, groupIndex: number, rect?: Partial<PanelRect>): void {
  write(floatGroupPure(panelLayout.value, container, groupIndex, rect))
}

export function dockGroup(floatId: FloatId, groupIndex: number): void {
  write(dockGroupPure(panelLayout.value, floatId, groupIndex))
}

export function moveGroup(sourceContainer: ContainerId, sourceGroupIndex: number, target: Extract<DropTarget, { kind: 'group' }>): void {
  write(moveGroupPure(panelLayout.value, sourceContainer, sourceGroupIndex, target))
}

export function clampRectToOverlay(rect: PanelRect, overlay: { width: number; height: number }): PanelRect {
  const width = Math.min(Math.max(rect.width, 240), Math.max(240, Math.min(720, overlay.width)))
  const height = Math.max(96, Math.min(rect.height, Math.max(96, overlay.height)))
  const maxX = Math.max(0, overlay.width - 64)
  const maxY = Math.max(0, overlay.height - PANEL_FLOAT_TITLE_HEIGHT)
  return { width, height, x: Math.min(Math.max(rect.x, 64 - width), maxX), y: Math.min(Math.max(rect.y, 0), maxY) }
}

export function clampPanelsToOverlay(overlay: { width: number; height: number }): void {
  if (overlay.width <= 0 || overlay.height <= 0) return
  let next = panelLayout.value
  for (const float of next.floats) {
    const rect = clampRectToOverlay(float, overlay)
    next = setFloatRectPure(next, float.id, rect)
  }
  write(next)
}

export { defaultPanelLayout, normalisePanelLayout } from './operations'

