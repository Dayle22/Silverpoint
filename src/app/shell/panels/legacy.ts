/**
 * Legacy panel layout models and migrations (v1 -> v2 -> v3 -> v4).
 * Kept isolated here so the live v4 containers module remains lean.
 */

import {
  PANEL_COLLAPSED_HEIGHT,
  PANEL_DOCK_MIN_WIDTH,
  PANEL_IDS,
  PANEL_LAYOUT_VERSION,
  PANEL_LAYOUT_VERSION_V2,
  PANEL_LAYOUT_VERSION_V3,
  PANEL_MAX_WIDTH,
  PANEL_MEMBER_MIN_HEIGHT,
  PANEL_MIN_VISIBLE,
  PANEL_MIN_WIDTH,
  type DockSide,
  type FloatContainer,
  type FloatContainerV3,
  type FloatingPanelRectV2,
  type PanelId,
  type PanelLayout,
  type PanelLayoutV2,
  type PanelLayoutV3,
  type PanelRect,
  type RegisteredPanelState,
  type RegisteredPanelStateV2,
  type RegisteredPanelStateV3
} from './types'
import { PANEL_REGISTRY_BY_ID } from './registry'

const finite = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const integer = (value: unknown, fallback: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(finite(value, fallback))))
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback
const side = (value: unknown, fallback: DockSide): DockSide =>
  value === 'left' || value === 'right' ? value : fallback
const isKnownPanelId = (value: unknown): value is PanelId =>
  typeof value === 'string' && (PANEL_IDS as readonly string[]).includes(value)

export interface PanelLayoutInput {
  version?: unknown
  dockWidths?: { left?: unknown; right?: unknown }
  docks?: { left?: unknown; right?: unknown }
  floats?: unknown
  panels?: Record<string, unknown>
}

export interface GenericPanelState {
  open: boolean
  container: string
  index: number
  lastDock?: { side: DockSide; index: number }
  floatFallback?: PanelRect
}

export function clampFloatRectFields(source: Partial<Record<keyof PanelRect, unknown>>, fallback: PanelRect): PanelRect {
  return {
    x: integer(source.x, fallback.x, PANEL_MIN_VISIBLE - PANEL_MAX_WIDTH, Number.MAX_SAFE_INTEGER),
    y: integer(source.y, fallback.y, 0, Number.MAX_SAFE_INTEGER),
    width: integer(source.width, fallback.width, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH),
    height: integer(source.height, fallback.height, PANEL_MEMBER_MIN_HEIGHT, Number.MAX_SAFE_INTEGER)
  }
}

export interface ParsedFloat {
  tempId: string
  x: number
  y: number
  width: number
  height: number
  z: number
  members: PanelId[]
}

export function parseFloatsInput(value: unknown): ParsedFloat[] {
  if (!Array.isArray(value)) return []
  const result: ParsedFloat[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const source = entry as Partial<FloatContainer>
    if (typeof source.id !== 'string' || source.id.length === 0) continue
    const rect = clampFloatRectFields(source, { x: 24, y: 24, width: 280, height: 560 })
    result.push({
      tempId: source.id,
      ...rect,
      z: integer(source.z, 1, 1, Number.MAX_SAFE_INTEGER),
      members: Array.isArray(source.members) ? source.members.filter(isKnownPanelId) : []
    })
  }
  return result
}

export function buildContainers<TState extends GenericPanelState>(
  source: PanelLayoutInput,
  panels: Record<PanelId, TState>
): { docks: { left: PanelId[]; right: PanelId[] }; floats: ParsedFloat[]; seen: Set<PanelId> } {
  const seen = new Set<PanelId>()
  const docks = { left: [] as PanelId[], right: [] as PanelId[] }

  for (const dockSide of ['left', 'right'] as const) {
    const ids = Array.isArray(source.docks?.[dockSide]) ? source.docks[dockSide] : []
    for (const id of ids) {
      if (!isKnownPanelId(id) || seen.has(id) || !panels[id].open) continue
      seen.add(id)
      docks[dockSide].push(id)
    }
  }

  const floats: ParsedFloat[] = []
  for (const parsed of parseFloatsInput(source.floats)) {
    const keptMembers: PanelId[] = []
    for (const id of parsed.members) {
      if (seen.has(id) || !panels[id].open) continue
      seen.add(id)
      keptMembers.push(id)
    }
    if (keptMembers.length > 0) floats.push({ ...parsed, members: keptMembers })
  }

  return { docks, floats, seen }
}

export function reinsertMissingOpenPanels<TState extends GenericPanelState>(
  docks: { left: PanelId[]; right: PanelId[] },
  floats: ParsedFloat[],
  panels: Record<PanelId, TState>,
  seen: Set<PanelId>
): void {
  for (const id of PANEL_IDS) {
    const state = panels[id]
    if (!state.open || seen.has(id)) continue
    const cached = state.container
    if (cached === 'left' || cached === 'right') {
      docks[cached].splice(Math.min(Math.max(0, state.index), docks[cached].length), 0, id)
    } else {
      const float = floats.find((entry) => entry.tempId === cached)
      if (float) {
        float.members.splice(Math.min(Math.max(0, state.index), float.members.length), 0, id)
      } else {
        const entry = PANEL_REGISTRY_BY_ID[id]
        docks[entry.defaultDock].splice(Math.min(entry.defaultDockIndex, docks[entry.defaultDock].length), 0, id)
      }
    }
    seen.add(id)
  }
}

export function finaliseFloats(floats: ParsedFloat[]): FloatContainer[] {
  return [...floats]
    .sort((a, b) => a.z - b.z)
    .map((float, index) => ({
      id: `float:${index}`,
      x: float.x,
      y: float.y,
      width: float.width,
      height: float.height,
      z: index + 1,
      members: [...float.members]
    }))
}

export function recomputeContainerCache<TState extends GenericPanelState>(
  docks: { left: PanelId[]; right: PanelId[] },
  floats: FloatContainer[],
  panels: Record<PanelId, TState>
): void {
  for (const dockSide of ['left', 'right'] as const) {
    docks[dockSide].forEach((id, index) => {
      const state = panels[id]
      state.container = dockSide
      state.index = index
      if (state.lastDock) state.lastDock = { side: dockSide, index }
    })
  }
  for (const float of floats) {
    float.members.forEach((id, index) => {
      const state = panels[id]
      state.container = float.id
      state.index = index
      if (state.floatFallback) state.floatFallback = { x: float.x, y: float.y, width: float.width, height: float.height }
    })
  }
}

// --- Legacy v3 shape & migration to v4 ---

const PANEL_BASIS_TOTAL_V3 = 10_000
const PANEL_BASIS_MIN_V3 = 500
const PANEL_MIN_HEIGHT_V3 = 96

const DEFAULT_OPEN = new Set<PanelId>(['pages', 'layers', 'transform', 'appearance', 'page'])
const DEFAULT_BASIS_V3: Partial<Record<PanelId, number>> = {
  pages: 3000,
  layers: 7000,
  transform: 3500,
  appearance: 4000,
  page: 2500
}

function defaultStateV3(id: PanelId): RegisteredPanelStateV3 {
  const entry = PANEL_REGISTRY_BY_ID[id]
  return {
    open: DEFAULT_OPEN.has(id),
    container: entry.defaultDock,
    index: entry.defaultDockIndex,
    lastDock: { side: entry.defaultDock, index: entry.defaultDockIndex },
    basis: DEFAULT_BASIS_V3[id] ?? 1000,
    collapsed: false,
    floatFallback: { ...entry.defaultFloating }
  }
}

export function defaultPanelLayoutV3(): PanelLayoutV3 {
  const panels = Object.fromEntries(PANEL_IDS.map((id) => [id, defaultStateV3(id)])) as Record<PanelId, RegisteredPanelStateV3>
  return {
    version: PANEL_LAYOUT_VERSION_V3,
    dockWidths: { left: 240, right: 280 },
    docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
    floats: [],
    panels
  }
}

function normaliseStateV3(value: unknown, fallback: RegisteredPanelStateV3): RegisteredPanelStateV3 {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<RegisteredPanelStateV3>
  const dock = (source.lastDock && typeof source.lastDock === 'object' ? source.lastDock : {}) as Partial<RegisteredPanelStateV3['lastDock']>
  const rawContainer = source.container
  const container = rawContainer === 'left' || rawContainer === 'right' || (typeof rawContainer === 'string' && /^float:\d+$/.test(rawContainer))
    ? rawContainer
    : fallback.container
  return {
    open: bool(source.open, fallback.open),
    container,
    index: integer(source.index, fallback.index, 0, PANEL_IDS.length),
    lastDock: { side: side(dock.side, fallback.lastDock.side), index: integer(dock.index, fallback.lastDock.index, 0, PANEL_IDS.length) },
    basis: integer(source.basis, fallback.basis, 0, PANEL_BASIS_TOTAL_V3),
    collapsed: bool(source.collapsed, fallback.collapsed),
    floatFallback: clampFloatRectFields((source.floatFallback ?? {}) as Partial<PanelRect>, fallback.floatFallback)
  }
}

function normaliseBasisAndHeightV3(
  docks: { left: PanelId[]; right: PanelId[] },
  floats: FloatContainerV3[],
  panels: Record<PanelId, RegisteredPanelStateV3>
): void {
  const normaliseMemberBasis = (members: PanelId[]): void => {
    const active = members.filter((id) => !panels[id].collapsed)
    if (active.length === 0) return
    const raw = active.map((id) => Math.max(PANEL_BASIS_MIN_V3, panels[id].basis))
    const total = raw.reduce((sum, value) => sum + value, 0)
    const scaled = raw.map((value) => (value * PANEL_BASIS_TOTAL_V3) / total)
    const floors = scaled.map(Math.floor)
    let remainder = PANEL_BASIS_TOTAL_V3 - floors.reduce((sum, value) => sum + value, 0)
    const order = scaled
      .map((value, index) => ({ index, fraction: value - floors[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    for (const item of order) if (remainder-- > 0) floors[item.index]++
    active.forEach((id, index) => { panels[id].basis = floors[index] })
  }

  normaliseMemberBasis(docks.left)
  normaliseMemberBasis(docks.right)
  for (const float of floats) {
    normaliseMemberBasis(float.members)
    const expandedCount = float.members.filter((id) => !panels[id].collapsed).length
    const collapsedCount = float.members.length - expandedCount
    const required = expandedCount * PANEL_MIN_HEIGHT_V3 + collapsedCount * PANEL_COLLAPSED_HEIGHT
    if (float.height < required) float.height = required
  }
}

export function normaliseV3Legacy(value: unknown): PanelLayoutV3 {
  if (!value || typeof value !== 'object') return defaultPanelLayoutV3()
  const source = value as PanelLayoutInput
  const fallback = defaultPanelLayoutV3()

  const dockWidths = {
    left: integer(source.dockWidths?.left, fallback.dockWidths.left, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH),
    right: integer(source.dockWidths?.right, fallback.dockWidths.right, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
  }

  const panelsSource = source.panels ?? {}
  const panels = Object.fromEntries(
    PANEL_IDS.map((id) => [id, normaliseStateV3(panelsSource[id], fallback.panels[id])])
  ) as Record<PanelId, RegisteredPanelStateV3>

  const built = buildContainers(source, panels)
  reinsertMissingOpenPanels(built.docks, built.floats, panels, built.seen)
  const floats = finaliseFloats(built.floats.filter((entry) => entry.members.length > 0))
  recomputeContainerCache(built.docks, floats, panels)
  normaliseBasisAndHeightV3(built.docks, floats, panels)

  return { version: PANEL_LAYOUT_VERSION_V3, dockWidths, docks: built.docks, floats, panels }
}

export function migrateV3ToV4(v3: PanelLayoutV3, normaliser: (value: unknown) => PanelLayout): PanelLayout {
  const docks: { left: PanelId[]; right: PanelId[] } = { left: [...v3.docks.left], right: [...v3.docks.right] }
  const floats: FloatContainer[] = v3.floats.map((float) => ({ ...float, members: [...float.members] }))
  const panels = {} as Record<PanelId, RegisteredPanelState>
  for (const id of PANEL_IDS) {
    const state = v3.panels[id]
    panels[id] = {
      open: state.open,
      container: state.container,
      index: state.index,
      lastDock: { ...state.lastDock },
      height: null,
      collapsed: state.collapsed,
      floatFallback: { ...state.floatFallback }
    }
  }
  return normaliser({
    version: PANEL_LAYOUT_VERSION,
    dockWidths: { ...v3.dockWidths },
    docks,
    floats,
    panels
  })
}

// --- Legacy v1 -> v2 migration ---

const DEFAULT_DOCK_WIDTHS_V2 = { left: 240, right: 280 }
const DEFAULT_DOCKS_V2 = { left: ['pages', 'layers'] as PanelId[], right: ['transform', 'appearance', 'page'] as PanelId[] }
const DEFAULT_DOCK_BASIS_V2: Partial<Record<PanelId, number>> = {
  pages: 3000,
  layers: 7000,
  transform: 3500,
  appearance: 4000,
  page: 2500
}

interface LegacyPanelEntryV1 {
  mode?: unknown
  collapsed?: unknown
  x?: unknown
  y?: unknown
  width?: unknown
  height?: unknown
  expandedHeight?: unknown
  z?: unknown
}

function defaultStateV2(id: PanelId): RegisteredPanelStateV2 {
  const entry = PANEL_REGISTRY_BY_ID[id]
  return {
    open: DEFAULT_OPEN.has(id),
    placement: 'docked',
    lastDock: { side: entry.defaultDock, index: entry.defaultDockIndex },
    dockBasis: DEFAULT_DOCK_BASIS_V2[id] ?? 1000,
    collapsed: false,
    floating: { ...entry.defaultFloating, expandedHeight: entry.defaultFloating.height, z: 1 }
  }
}

export function defaultPanelLayoutV2(): PanelLayoutV2 {
  const panels = Object.fromEntries(PANEL_IDS.map((id) => [id, defaultStateV2(id)])) as Record<PanelId, RegisteredPanelStateV2>
  return {
    version: PANEL_LAYOUT_VERSION_V2,
    dockWidths: { ...DEFAULT_DOCK_WIDTHS_V2 },
    docks: { left: [...DEFAULT_DOCKS_V2.left], right: [...DEFAULT_DOCKS_V2.right] },
    panels
  }
}

function normaliseRectV2(value: unknown, fallback: FloatingPanelRectV2): FloatingPanelRectV2 {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<FloatingPanelRectV2>
  return {
    x: integer(source.x, fallback.x, PANEL_MIN_VISIBLE - PANEL_MAX_WIDTH, Number.MAX_SAFE_INTEGER),
    y: integer(source.y, fallback.y, 0, Number.MAX_SAFE_INTEGER),
    width: integer(source.width, fallback.width, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH),
    height: integer(source.height, fallback.height, PANEL_MEMBER_MIN_HEIGHT, Number.MAX_SAFE_INTEGER),
    expandedHeight: integer(source.expandedHeight, fallback.expandedHeight, PANEL_MEMBER_MIN_HEIGHT, Number.MAX_SAFE_INTEGER),
    z: integer(source.z, fallback.z, 1, Number.MAX_SAFE_INTEGER)
  }
}

function normaliseStateV2(value: unknown, fallback: RegisteredPanelStateV2): RegisteredPanelStateV2 {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<RegisteredPanelStateV2>
  const dock = (source.lastDock && typeof source.lastDock === 'object' ? source.lastDock : {}) as Partial<RegisteredPanelStateV2['lastDock']>
  return {
    open: bool(source.open, fallback.open),
    placement: source.placement === 'floating' ? 'floating' : 'docked',
    lastDock: { side: side(dock.side, fallback.lastDock.side), index: integer(dock.index, fallback.lastDock.index, 0, PANEL_IDS.length) },
    dockBasis: integer(source.dockBasis, fallback.dockBasis, 0, PANEL_BASIS_TOTAL_V3),
    collapsed: bool(source.collapsed, fallback.collapsed),
    floating: normaliseRectV2(source.floating, fallback.floating)
  }
}

function normaliseBasisV2(layout: PanelLayoutV2): void {
  for (const dockSide of ['left', 'right'] as const) {
    const active = layout.docks[dockSide].filter((id) => layout.panels[id].open && !layout.panels[id].collapsed)
    if (active.length === 0) continue
    const raw = active.map((id) => Math.max(PANEL_BASIS_MIN_V3, layout.panels[id].dockBasis))
    const total = raw.reduce((sum, value) => sum + value, 0)
    const scaled = raw.map((value) => (value * PANEL_BASIS_TOTAL_V3) / total)
    const floors = scaled.map(Math.floor)
    let remainder = PANEL_BASIS_TOTAL_V3 - floors.reduce((sum, value) => sum + value, 0)
    const order = scaled.map((value, index) => ({ index, fraction: value - floors[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    for (const item of order) if (remainder-- > 0) floors[item.index]++
    active.forEach((id, index) => { layout.panels[id].dockBasis = floors[index] })
  }
}

export function migrateV1ToV2(value: unknown, editorLayout?: unknown): PanelLayoutV2 {
  const result = defaultPanelLayoutV2()
  if (!value || typeof value !== 'object') return result
  const source = value as { version?: unknown; panels?: Record<string, unknown>; dockWidths?: Partial<typeof DEFAULT_DOCK_WIDTHS_V2> }
  if (source.version !== 1) return result
  const legacy = source.panels ?? {}
  const widths = editorLayout && typeof editorLayout === 'object' ? editorLayout as Partial<typeof DEFAULT_DOCK_WIDTHS_V2> : source.dockWidths
  if (widths) {
    result.dockWidths.left = integer(widths.left, result.dockWidths.left, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
    result.dockWidths.right = integer(widths.right, result.dockWidths.right, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
  }
  for (const [legacyId, ids, dockSide, bases] of [
    ['layers', ['pages', 'layers'], 'left', [3000, 7000]],
    ['properties', ['transform', 'appearance'], 'right', [4500, 5500]]
  ] as const) {
    const old = legacy[legacyId] as LegacyPanelEntryV1 | undefined
    if (!old) continue
    const oldMode = old.mode === 'floating' ? 'floating' : 'docked'
    const oldCollapsed = bool(old.collapsed, false)
    const rect = normaliseRectV2(old, result.panels[ids[0]].floating)
    ids.forEach((id, index) => {
      const state = result.panels[id]
      state.open = true
      state.placement = oldMode
      state.collapsed = oldCollapsed
      state.lastDock = { side: dockSide, index }
      state.dockBasis = bases[index]
      state.floating = { ...rect, height: Math.max(PANEL_MEMBER_MIN_HEIGHT, Math.round((rect.height - 8) * bases[index] / 10_000)), expandedHeight: Math.max(PANEL_MEMBER_MIN_HEIGHT, Math.round((rect.expandedHeight - 8) * bases[index] / 10_000)), y: rect.y + index * (Math.round((rect.height - 8) * bases[0] / 10_000) + 8), z: rect.z + index }
    })
    if (oldMode === 'floating') result.docks[dockSide] = result.docks[dockSide].filter((id) => !(ids as readonly PanelId[]).includes(id))
  }
  return normalisePanelLayoutV2(result)
}

function syncDocksV2(source: PanelLayoutInput, result: PanelLayoutV2): void {
  for (const dockSide of ['left', 'right'] as const) {
    const sourceIds = Array.isArray(source.docks?.[dockSide]) ? source.docks[dockSide] : []
    for (const id of sourceIds) {
      if (!isKnownPanelId(id) || result.docks.left.includes(id) || result.docks.right.includes(id)) continue
      const state = result.panels[id]
      if (!state.open || state.placement !== 'docked') continue
      result.docks[dockSide].push(id)
      state.lastDock = { side: dockSide, index: result.docks[dockSide].length - 1 }
    }
  }
  for (const id of PANEL_IDS) {
    const state = result.panels[id]
    if (!state.open || state.placement !== 'docked') continue
    if (result.docks[state.lastDock.side].includes(id)) continue
    const target = result.docks[state.lastDock.side]
    target.splice(Math.min(state.lastDock.index, target.length), 0, id)
  }
  for (const dockSide of ['left', 'right'] as const) {
    result.docks[dockSide].forEach((id, index) => {
      result.panels[id].lastDock = { side: dockSide, index }
    })
  }
}

export function normalisePanelLayoutV2(value: unknown): PanelLayoutV2 {
  if (!value || typeof value !== 'object') return defaultPanelLayoutV2()
  const source = value as PanelLayoutInput
  if (source.version === 1) return migrateV1ToV2(value)
  if (source.version !== PANEL_LAYOUT_VERSION_V2) return defaultPanelLayoutV2()
  const fallback = defaultPanelLayoutV2()
  const panels = source.panels ?? {}
  const result: PanelLayoutV2 = {
    version: PANEL_LAYOUT_VERSION_V2,
    dockWidths: {
      left: integer(source.dockWidths?.left, fallback.dockWidths.left, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH),
      right: integer(source.dockWidths?.right, fallback.dockWidths.right, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
    },
    docks: { left: [], right: [] },
    panels: Object.fromEntries(PANEL_IDS.map((id) => [id, normaliseStateV2(panels[id], fallback.panels[id])])) as Record<PanelId, RegisteredPanelStateV2>
  }
  syncDocksV2(source, result)
  const floating = PANEL_IDS
    .filter((id) => result.panels[id].open && result.panels[id].placement === 'floating')
    .sort((a, b) => result.panels[a].floating.z - result.panels[b].floating.z || PANEL_IDS.indexOf(a) - PANEL_IDS.indexOf(b))
  floating.forEach((id, index) => { result.panels[id].floating.z = index + 1 })
  normaliseBasisV2(result)
  return result
}

export function migrateV2ToV3(v2: PanelLayoutV2): PanelLayoutV3 {
  const docks: { left: PanelId[]; right: PanelId[] } = { left: [...v2.docks.left], right: [...v2.docks.right] }
  const floats: FloatContainerV3[] = []
  const panels = {} as Record<PanelId, RegisteredPanelStateV3>

  const floatingIds = PANEL_IDS
    .filter((id) => v2.panels[id].open && v2.panels[id].placement === 'floating')
    .sort((a, b) => v2.panels[a].floating.z - v2.panels[b].floating.z)

  floatingIds.forEach((id, index) => {
    const rect = v2.panels[id].floating
    floats.push({
      id: `float:${index}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      z: index + 1,
      members: [id]
    })
  })

  for (const id of PANEL_IDS) {
    const state = v2.panels[id]
    const fallbackRect: PanelRect = { x: state.floating.x, y: state.floating.y, width: state.floating.width, height: state.floating.height }
    const floatIndex = floatingIds.indexOf(id)

    panels[id] = {
      open: state.open,
      container: state.placement === 'docked' ? state.lastDock.side : `float:${Math.max(0, floatIndex)}`,
      index: state.placement === 'docked' ? state.lastDock.index : 0,
      lastDock: { ...state.lastDock },
      basis: state.dockBasis,
      collapsed: state.collapsed,
      floatFallback: fallbackRect
    }
  }

  return normaliseV3Legacy({
    version: PANEL_LAYOUT_VERSION_V3,
    dockWidths: { ...v2.dockWidths },
    docks,
    floats,
    panels
  })
}
