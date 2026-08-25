import type { DockSide, PanelId, PanelRect, PanelSizing } from './types'

export interface PanelRegistryEntry {
  id: PanelId
  labelKey: PanelId
  menuId: `window-panel-${PanelId}`
  defaultDock: DockSide
  defaultGroupIndex: number
  defaultDockIndex: number
  defaultTabIndex: number
  /** Rect used the first time this panel becomes its own float container (registry seed for `floatFallback`). */
  defaultFloating: PanelRect
  sizing: PanelSizing
  defaultHeight: number
}

const floating = (x: number, y: number): PanelRect => ({
  x,
  y,
  width: 280,
  height: 560
})

export const PANEL_REGISTRY: readonly PanelRegistryEntry[] = [
  ['pages', 'left', 0, 0, floating(24, 24), 'fill', 200],
  ['history', 'left', 1, 0, floating(54, 54), 'fill', 320],
  ['assets', 'left', 1, 0, floating(44, 44), 'fill', 320],
  ['layers', 'left', 1, 0, floating(64, 64), 'fill', 320],
  ['swatches', 'left', 2, 0, floating(304, 160), 'fill', 280],
  ['export', 'right', 0, 0, floating(84, 84), 'content', 0],
  ['variables', 'right', 1, 0, floating(104, 104), 'content', 0],
  ['ai', 'right', 2, 0, floating(124, 124), 'fill', 420],
  ['code', 'right', 3, 0, floating(144, 144), 'fill', 380],
  ['appearance', 'right', 1, 0, floating(164, 164), 'content', 0],
  ['transform', 'right', 0, 0, floating(184, 184), 'content', 0],
  ['text', 'right', 1, 1, floating(204, 204), 'content', 0],
  ['page', 'right', 2, 0, floating(224, 224), 'content', 0],
  ['guides', 'right', 2, 1, floating(244, 244), 'content', 0],
  ['mask', 'right', 5, 0, floating(264, 264), 'content', 0],
  ['component', 'right', 6, 0, floating(284, 284), 'content', 0]
].map(([id, defaultDock, defaultGroupIndex, defaultTabIndex, defaultFloating, sizing, defaultHeight]) => ({
  id: id as PanelId,
  labelKey: id as PanelId,
  menuId: `window-panel-${id as PanelId}`,
  defaultDock: defaultDock as DockSide,
  defaultGroupIndex: defaultGroupIndex as number,
  defaultDockIndex: defaultGroupIndex as number,
  defaultTabIndex: defaultTabIndex as number,
  defaultFloating: defaultFloating as PanelRect,
  sizing: sizing as PanelSizing,
  defaultHeight: defaultHeight as number
}))

export const PANEL_REGISTRY_BY_ID: Readonly<Record<PanelId, PanelRegistryEntry>> = Object.fromEntries(
  PANEL_REGISTRY.map((entry) => [entry.id, entry])
) as Record<PanelId, PanelRegistryEntry>
