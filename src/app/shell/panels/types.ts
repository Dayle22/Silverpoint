/** Shared panel model. Persisted panel layouts are versioned independently of Vue. */

export const PANEL_IDS = [
  'pages',
  'history',
  'assets',
  'layers',
  'swatches',
  'export',
  'variables',
  'ai',
  'code',
  'appearance',
  'transform',
  'text',
  'page',
  'guides',
  'mask',
  'component'
] as const

export type PanelId = (typeof PANEL_IDS)[number]
export type LegacyPanelId = PanelId | 'properties'
export type DockSide = 'left' | 'right'

export const PANEL_LAYOUT_VERSION = 5 as const
export const PANEL_LAYOUT_KEY = 'silverpoint:panel-layout'
export const PANEL_MIN_WIDTH = 240
export const PANEL_MAX_WIDTH = 720
export const PANEL_MEMBER_MIN_HEIGHT = 96
export const PANEL_MEMBER_MAX_HEIGHT = 640
export const PANEL_COLLAPSED_HEIGHT = 33
export const PANEL_FLOAT_TITLE_HEIGHT = 24
export const PANEL_MIN_VISIBLE = 64
export const PANEL_DOCK_MIN_WIDTH = 220
export const PANEL_CANVAS_MIN_WIDTH = 360
/** Band at a group's top and bottom edge that resolves to a new-group seam rather than a tab. */
export const PANEL_SEAM_ZONE = 28

export type PanelSizing = 'fill' | 'content'

export interface PanelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PanelGroup {
  /** Ordered tab members. Never empty - normalisation removes an empty group. */
  members: PanelId[]
  /** The visible tab. Always a member; normalisation repairs it to members[0]. */
  active: PanelId
  /** Pinned pixel height for a `fill`-sized active tab, clamped to [PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]. Forced to null while collapsed or while the active tab is `content`-sized. */
  height: number | null
  collapsed: boolean
}

/**
 * A container (T-031c) holds an ordered stack of panel groups rendered
 * as tab strips + bodies with vertical sizing. There are exactly
 * three kinds: the `left`/`right` docks (fixed to an edge, width in pixels)
 * and `float:<n>` floating windows (a free rect with a z-order).
 *
 * Float IDs are NOT stable identifiers: `normalisePanelLayout()` recomputes
 * them every pass as a deterministic function of z-order
 * (`float:0..float:n-1`, ascending z). This keeps them stable frame-to-frame
 * during a drag (z is untouched by a plain rect update) while still
 * renumbering cleanly whenever a container is created, destroyed or raised.
 * Never persist a float ID across a reload as a durable reference beyond a
 * single synchronous read-then-write - see `RegisteredPanelState.container`.
 */
export type FloatId = `float:${number}`
export type ContainerId = DockSide | FloatId

export function isFloatId(value: ContainerId): value is FloatId {
  return value !== 'left' && value !== 'right'
}

export interface FloatContainer {
  id: FloatId
  x: number
  y: number
  width: number
  height: number
  z: number
  /**
   * Authoritative ordered list of panel groups hosted in this floating window.
   * Never empty - an empty float container is deleted by normalisation.
   */
  groups?: PanelGroup[]
  /**
   * DERIVED CACHE, never authoritative. Kept only so v4-era code outside this
   * packet's scope (`drag.ts`'s `float.members.includes(id)` lookup) keeps
   * compiling and behaving correctly against the v5 model. T-070c2/d may delete
   * this once every direct reader is updated.
   */
  members: PanelId[]
}

export interface RegisteredPanelState {
  open: boolean
  /**
   * DERIVED CACHE. For an OPEN panel, this is recomputed by
   * `normalisePanelLayout()` on every pass from `docks`/`floats[].groups`
   * and is never authoritative - never read it to decide membership. It is
   * authoritative only while the panel is CLOSED, as the container to
   * restore on reopen (best-effort: a stale `float:<n>` reference is handled
   * by `openPanel()`, not assumed valid).
   */
  container: ContainerId
  /** DERIVED CACHE, index of the group hosting this panel within its container. */
  groupIndex?: number
  /** DERIVED CACHE, index of this panel within its hosting group's members array. */
  tabIndex?: number
  /** DERIVED CACHE legacy alias. */
  index?: number
  /**
   * The panel's most recent actual DOCK position, frozen while the panel is
   * floating or closed-from-a-float and updated only while genuinely docked.
   * Distinct from `container`/`groupIndex` (which track wherever the panel
   * currently or most-recently lived, dock OR float) because "pin this
   * floating panel back to its dock" needs to remember the dock position
   * even after time spent floating - `container` would have moved on.
   */
  lastDock: { side: DockSide; groupIndex?: number; tabIndex?: number; index?: number }
  /**
   * DERIVED CACHE mirroring this panel's own `PanelGroup`. Kept only so v4-era
   * code outside this packet's scope (`PanelStack.vue`'s `memberStyle`/`resizeMember`,
   * `FloatingPanel.vue`'s `allCollapsed`) keeps reading a correct value without being
   * rewritten here. Meaningless to compare across two panels that share a group -
   * always read the group directly once T-070c2 lands.
   */
  height: number | null
  /**
   * DERIVED CACHE mirroring this panel's own `PanelGroup`. Same rule as `height`.
   */
  collapsed: boolean
  /**
   * The panel's most recent actual float rect, frozen while docked/closed
   * and updated only while genuinely floating - the rect a fresh detach
   * reuses, so re-floating a panel returns it near where it last was rather
   * than always the registry default.
   */
  floatFallback: PanelRect
}

export interface PanelLayout {
  version: typeof PANEL_LAYOUT_VERSION
  dockWidths: { left: number; right: number }
  docks: { left: PanelGroup[]; right: PanelGroup[] }
  /** Every live floating window. Order is not meaningful - z is. */
  floats: FloatContainer[]
  panels: Record<PanelId, RegisteredPanelState>
}

export function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && (PANEL_IDS as readonly string[]).includes(value)
}

// --- Legacy v4 shape (T-070a/b1). Kept ONLY as typing for the migration chain in containers.ts; nothing else may construct or consume this. ---

export const PANEL_LAYOUT_VERSION_V4 = 4 as const

export interface FloatContainerV4 {
  id: FloatId
  x: number
  y: number
  width: number
  height: number
  z: number
  members: PanelId[]
}

export interface RegisteredPanelStateV4 {
  open: boolean
  container: ContainerId
  index: number
  lastDock: { side: DockSide; index: number }
  height: number | null
  collapsed: boolean
  floatFallback: PanelRect
}

export interface PanelLayoutV4 {
  version: typeof PANEL_LAYOUT_VERSION_V4
  dockWidths: { left: number; right: number }
  docks: { left: PanelId[]; right: PanelId[] }
  floats: FloatContainerV4[]
  panels: Record<PanelId, RegisteredPanelStateV4>
}

// --- Legacy v3 shape (T-031c). Kept ONLY as typing for the migration chain in containers.ts; nothing else may construct or consume this. ---

export const PANEL_LAYOUT_VERSION_V3 = 3 as const

export type FloatContainerV3 = FloatContainerV4

export interface RegisteredPanelStateV3 {
  open: boolean
  container: ContainerId
  index: number
  lastDock: { side: DockSide; index: number }
  basis: number
  collapsed: boolean
  floatFallback: PanelRect
}

export interface PanelLayoutV3 {
  version: typeof PANEL_LAYOUT_VERSION_V3
  dockWidths: { left: number; right: number }
  docks: { left: PanelId[]; right: PanelId[] }
  floats: FloatContainerV3[]
  panels: Record<PanelId, RegisteredPanelStateV3>
}

// --- Legacy v2 shape (T-031a). Kept ONLY as typing for the migration chain in containers.ts; nothing else may construct or consume this. ---

export const PANEL_LAYOUT_VERSION_V2 = 2 as const
export type PanelModeV2 = 'docked' | 'floating'

export interface FloatingPanelRectV2 extends PanelRect {
  expandedHeight: number
  z: number
}

export interface RegisteredPanelStateV2 {
  open: boolean
  placement: PanelModeV2
  lastDock: { side: DockSide; index: number }
  dockBasis: number
  collapsed: boolean
  floating: FloatingPanelRectV2
}

export interface PanelLayoutV2 {
  version: typeof PANEL_LAYOUT_VERSION_V2
  dockWidths: { left: number; right: number }
  docks: { left: PanelId[]; right: PanelId[] }
  panels: Record<PanelId, RegisteredPanelStateV2>
}
