/**
 * Container helpers (T-031c / T-070a / T-070c1), the current-version (v5) default/normalise
 * core, and re-exports of the legacy migration chain from legacy.ts.
 */

import {
  PANEL_COLLAPSED_HEIGHT,
  PANEL_DOCK_MIN_WIDTH,
  PANEL_FLOAT_TITLE_HEIGHT,
  PANEL_IDS,
  PANEL_LAYOUT_VERSION,
  PANEL_MAX_WIDTH,
  PANEL_MEMBER_MAX_HEIGHT,
  PANEL_MEMBER_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  type ContainerId,
  type DockSide,
  type FloatContainer,
  type FloatContainerV4,
  type FloatId,
  type PanelGroup,
  type PanelId,
  type PanelLayout,
  type PanelLayoutV3,
  type PanelLayoutV4,
  type PanelRect,
  type RegisteredPanelState,
  type RegisteredPanelStateV4
} from './types'
import { PANEL_REGISTRY_BY_ID } from './registry'
import {
  buildContainers,
  clampFloatRectFields,
  finaliseFloats,
  recomputeContainerCache,
  reinsertMissingOpenPanels,
  type PanelLayoutInput
} from './legacy'

export {
  defaultPanelLayoutV2,
  defaultPanelLayoutV3,
  migrateV1ToV2,
  migrateV2ToV3,
  normalisePanelLayoutV2,
  normaliseV3Legacy
} from './legacy'

// --- Container helpers (v5, live) ---

export function containerGroups(layout: PanelLayout, id: ContainerId): PanelGroup[] {
  if (id === 'left' || id === 'right') return layout.docks[id]
  const float = layout.floats.find((entry) => entry.id === id)
  return float ? (float.groups ?? []) : []
}

export function containerMembers(layout: PanelLayout, id: ContainerId): PanelId[] {
  return containerGroups(layout, id).flatMap((group) => group.members)
}

export function containerOf(layout: PanelLayout, id: PanelId): ContainerId | null {
  if (!layout.panels[id].open) return null
  if (layout.docks.left.some((group) => group.members.includes(id))) return 'left'
  if (layout.docks.right.some((group) => group.members.includes(id))) return 'right'
  const float = layout.floats.find((entry) => entry.members.includes(id))
  return float ? float.id : null
}

export function locatePanel(
  layout: PanelLayout,
  id: PanelId
): { container: ContainerId; groupIndex: number; tabIndex: number } | null {
  for (const side of ['left', 'right'] as const) {
    const groups = layout.docks[side]
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const tabIndex = groups[groupIndex].members.indexOf(id)
      if (tabIndex !== -1) {
        return { container: side, groupIndex, tabIndex }
      }
    }
  }
  for (const float of layout.floats) {
    const groups = float.groups ?? []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const tabIndex = groups[groupIndex].members.indexOf(id)
      if (tabIndex !== -1) {
        return { container: float.id, groupIndex, tabIndex }
      }
    }
  }
  return null
}

/** 'left', 'right', then every float container in ascending z order. */
export function allContainerIds(layout: PanelLayout): ContainerId[] {
  return ['left', 'right', ...[...layout.floats].sort((a, b) => a.z - b.z).map((entry) => entry.id)]
}

export function floatContainerById(layout: PanelLayout, id: FloatId): FloatContainer | undefined {
  return layout.floats.find((entry) => entry.id === id)
}

// --- Shared coercion primitives ---

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

// --- v5 default layout ---

interface PanelGroupSeed {
  members: PanelId[]
  height: number | null
}

const DEFAULT_DOCK_WIDTHS = { left: 240, right: 280 }
const DEFAULT_GROUPS: { left: readonly PanelGroupSeed[]; right: readonly PanelGroupSeed[] } = {
  left: [{ members: ['pages'], height: 200 }, { members: ['layers'], height: null }],
  right: [
    { members: ['transform'], height: null },
    { members: ['appearance', 'text'], height: null },
    { members: ['page', 'guides'], height: null }
  ]
}
const DEFAULT_OPEN = new Set<PanelId>([...DEFAULT_GROUPS.left.flatMap((g) => g.members), ...DEFAULT_GROUPS.right.flatMap((g) => g.members)])

function defaultState(id: PanelId): RegisteredPanelState {
  const entry = PANEL_REGISTRY_BY_ID[id]
  return {
    open: DEFAULT_OPEN.has(id),
    container: entry.defaultDock,
    groupIndex: entry.defaultGroupIndex,
    tabIndex: entry.defaultTabIndex,
    lastDock: { side: entry.defaultDock, groupIndex: entry.defaultGroupIndex, tabIndex: entry.defaultTabIndex },
    height: null,
    collapsed: false,
    floatFallback: { ...entry.defaultFloating }
  }
}

export function defaultPanelLayout(): PanelLayout {
  const panels = Object.fromEntries(PANEL_IDS.map((id) => [id, defaultState(id)])) as Record<PanelId, RegisteredPanelState>
  const makeDock = (seeds: readonly PanelGroupSeed[]): PanelGroup[] =>
    seeds.map((s) => ({ members: [...s.members], active: s.members[0], height: s.height, collapsed: false }))
  const docks = { left: makeDock(DEFAULT_GROUPS.left), right: makeDock(DEFAULT_GROUPS.right) }
  updateV5Cache(docks, [], panels)
  clampV5FloatsAndHeights(docks, [], panels)
  return { version: PANEL_LAYOUT_VERSION, dockWidths: { ...DEFAULT_DOCK_WIDTHS }, docks, floats: [], panels }
}

// --- v5 normalisation core ---

function normaliseContainerId(value: unknown, fallback: ContainerId): ContainerId {
  if (value === 'left' || value === 'right') return value
  if (typeof value === 'string' && /^float:\d+$/.test(value)) return value as FloatId
  return fallback
}

function normaliseStateV5(value: unknown, fallback: RegisteredPanelState, id: PanelId): RegisteredPanelState {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<RegisteredPanelState>
  const dock = (source.lastDock && typeof source.lastDock === 'object' ? source.lastDock : {}) as Partial<RegisteredPanelState['lastDock']>
  const isContent = PANEL_REGISTRY_BY_ID[id].sizing === 'content'
  const collapsed = bool(source.collapsed, fallback.collapsed)
  const height =
    collapsed || isContent || source.height === null || source.height === undefined
      ? null
      : integer(source.height, fallback.height ?? PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)

  return {
    open: bool(source.open, fallback.open),
    container: normaliseContainerId(source.container, fallback.container),
    groupIndex: integer(source.groupIndex, fallback.groupIndex ?? 0, 0, PANEL_IDS.length),
    tabIndex: integer(source.tabIndex, fallback.tabIndex ?? 0, 0, PANEL_IDS.length),
    lastDock: { side: side(dock.side, fallback.lastDock.side), groupIndex: integer(dock.groupIndex, fallback.lastDock.groupIndex ?? 0, 0, PANEL_IDS.length), tabIndex: integer(dock.tabIndex, fallback.lastDock.tabIndex ?? 0, 0, PANEL_IDS.length) },
    height,
    collapsed,
    floatFallback: clampFloatRectFields((source.floatFallback ?? {}) as Partial<PanelRect>, fallback.floatFallback)
  }
}

interface ParsedGroup {
  members: PanelId[]
  active: PanelId
  height: number | null
  collapsed: boolean
}

interface ParsedFloatV5 {
  tempId: string
  x: number
  y: number
  width: number
  height: number
  z: number
  groups: ParsedGroup[]
}

function parseGroupInput(raw: unknown, panels: Record<PanelId, RegisteredPanelState>): ParsedGroup | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Partial<PanelGroup>
  const members: PanelId[] = Array.isArray(source.members) ? source.members.filter(isKnownPanelId) : []
  if (members.length === 0) return null
  const active: PanelId = source.active && isKnownPanelId(source.active) && members.includes(source.active)
    ? source.active
    : members[0]
  const panelState = panels[active]
  const collapsed = source.collapsed !== undefined ? bool(source.collapsed, false) : panelState.collapsed
  const isContent = PANEL_REGISTRY_BY_ID[active].sizing === 'content'
  const chosenHeight = source.height !== undefined ? source.height : panelState.height
  const rawHeight =
    chosenHeight == null
      ? null
      : integer(chosenHeight, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)
  const height = collapsed || isContent ? null : rawHeight
  return { members, active, height, collapsed }
}

function parseDockGroupsInput(rawList: unknown, panels: Record<PanelId, RegisteredPanelState>): ParsedGroup[] {
  if (!Array.isArray(rawList)) return []
  const result: ParsedGroup[] = []
  for (const item of rawList) {
    if (typeof item === 'string' && isKnownPanelId(item)) {
      const isContent = PANEL_REGISTRY_BY_ID[item].sizing === 'content'
      const collapsed = panels[item].collapsed
      const rawHeight = panels[item].height
      const height =
        collapsed || isContent || rawHeight === null
          ? null
          : integer(rawHeight, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)
      result.push({ members: [item], active: item, height, collapsed })
    } else {
      const parsed = parseGroupInput(item, panels)
      if (parsed) result.push(parsed)
    }
  }
  return result
}

function parseFloatsInputV5(value: unknown, panels: Record<PanelId, RegisteredPanelState>): ParsedFloatV5[] {
  if (!Array.isArray(value)) return []
  const result: ParsedFloatV5[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const source = entry as {
      id?: unknown
      x?: unknown
      y?: unknown
      width?: unknown
      height?: unknown
      z?: unknown
      groups?: unknown
      members?: unknown
    }
    if (typeof source.id !== 'string' || source.id.length === 0) continue
    const rect = clampFloatRectFields(source as Partial<PanelRect>, { x: 24, y: 24, width: 280, height: 560 })
    const groups: ParsedGroup[] = []
    if (Array.isArray(source.groups)) {
      for (const g of source.groups) {
        const parsed = parseGroupInput(g, panels)
        if (parsed) groups.push(parsed)
      }
    } else if (Array.isArray(source.members)) {
      for (const m of source.members) {
        if (isKnownPanelId(m)) {
          const isContent = PANEL_REGISTRY_BY_ID[m].sizing === 'content'
          const collapsed = panels[m].collapsed
          const rawHeight = panels[m].height
          const height =
            collapsed || isContent || rawHeight === null
              ? null
              : integer(rawHeight, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)
          groups.push({ members: [m], active: m, height, collapsed })
        }
      }
    }
    result.push({
      tempId: source.id,
      ...rect,
      z: integer(source.z, 1, 1, Number.MAX_SAFE_INTEGER),
      groups
    })
  }
  return result
}

function filterValidGroups(
  rawGroups: ParsedGroup[],
  panels: Record<PanelId, RegisteredPanelState>,
  seen: Set<PanelId>
): PanelGroup[] {
  const result: PanelGroup[] = []
  for (const group of rawGroups) {
    const members = group.members.filter((id) => panels[id].open && !seen.has(id))
    if (members.length === 0) continue
    for (const id of members) seen.add(id)
    const active = members.includes(group.active) ? group.active : members[0]
    result.push({ members, active, height: group.height, collapsed: group.collapsed })
  }
  return result
}

function reinsertMissingV5(
  docks: { left: PanelGroup[]; right: PanelGroup[] },
  floats: { tempId: string; groups: PanelGroup[] }[],
  panels: Record<PanelId, RegisteredPanelState>,
  seen: Set<PanelId>
): void {
  for (const id of PANEL_IDS) {
    const state = panels[id]
    if (!state.open || seen.has(id)) continue
    const cached = state.container
    const newGroup: PanelGroup = {
      members: [id],
      active: id,
      height: state.height ?? null,
      collapsed: state.collapsed
    }
    if (cached === 'left' || cached === 'right') {
      docks[cached].splice(Math.min(Math.max(0, state.groupIndex ?? 0), docks[cached].length), 0, newGroup)
    } else {
      const targetFloat = floats.find((entry) => entry.tempId === cached)
      if (targetFloat) {
        targetFloat.groups.splice(Math.min(Math.max(0, state.groupIndex ?? 0), targetFloat.groups.length), 0, newGroup)
      } else {
        const entry = PANEL_REGISTRY_BY_ID[id]
        docks[entry.defaultDock].splice(Math.min(entry.defaultGroupIndex, docks[entry.defaultDock].length), 0, newGroup)
      }
    }
    seen.add(id)
  }
}

function updateV5Cache(
  docks: { left: PanelGroup[]; right: PanelGroup[] },
  floats: FloatContainer[],
  panels: Record<PanelId, RegisteredPanelState>
): void {
  for (const side of ['left', 'right'] as const) {
    docks[side].forEach((group, groupIndex) => {
      group.members.forEach((id, tabIndex) => {
        const s = panels[id]
        s.container = side
        s.groupIndex = groupIndex
        s.tabIndex = tabIndex
        s.lastDock = { side, groupIndex, tabIndex }
      })
    })
  }
  for (const float of floats) {
    (float.groups ?? []).forEach((group, groupIndex) => {
      group.members.forEach((id, tabIndex) => {
        const s = panels[id]
        s.container = float.id
        s.groupIndex = groupIndex
        s.tabIndex = tabIndex
        s.floatFallback = { x: float.x, y: float.y, width: float.width, height: float.height }
      })
    })
  }
}

function clampV5FloatsAndHeights(
  docks: { left: PanelGroup[]; right: PanelGroup[] },
  floats: FloatContainer[],
  panels: Record<PanelId, RegisteredPanelState>
): void {
  const allGroups = [...docks.left, ...docks.right, ...floats.flatMap((f) => f.groups ?? [])]
  for (const group of allGroups) {
    const isContent = PANEL_REGISTRY_BY_ID[group.active].sizing === 'content'
    if (group.collapsed || isContent) {
      group.height = null
    } else if (group.height !== null) {
      group.height = integer(group.height, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)
    }
    for (const id of group.members) {
      panels[id].height = group.height
      panels[id].collapsed = group.collapsed
    }
  }
  for (const id of PANEL_IDS) {
    if (!panels[id].open && (PANEL_REGISTRY_BY_ID[id].sizing === 'content' || panels[id].collapsed)) {
      panels[id].height = null
    }
  }
  for (const float of floats) {
    const groups = float.groups ?? []
    const expanded = groups.filter((g) => !g.collapsed).length
    const required = PANEL_FLOAT_TITLE_HEIGHT + expanded * PANEL_MEMBER_MIN_HEIGHT + (groups.length - expanded) * PANEL_COLLAPSED_HEIGHT
    if (float.height < required) float.height = required
    float.width = integer(float.width, 280, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH)
    float.members = groups.flatMap((g) => g.members)
  }
}

export function normaliseV5(value: unknown): PanelLayout {
  if (!value || typeof value !== 'object') return defaultPanelLayout()
  const source = value as {
    version?: unknown
    dockWidths?: { left?: unknown; right?: unknown }
    docks?: { left?: unknown; right?: unknown }
    floats?: unknown
    panels?: Record<string, unknown>
  }
  const fallback = defaultPanelLayout()
  const dockWidths = {
    left: integer(source.dockWidths?.left, DEFAULT_DOCK_WIDTHS.left, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH),
    right: integer(source.dockWidths?.right, DEFAULT_DOCK_WIDTHS.right, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
  }

  const panelsSource = source.panels ?? {}
  const panels = Object.fromEntries(
    PANEL_IDS.map((id) => [id, normaliseStateV5(panelsSource[id], fallback.panels[id], id)])
  ) as Record<PanelId, RegisteredPanelState>

  const rawFloats = parseFloatsInputV5(source.floats, panels)
  const seen = new Set<PanelId>()
  const docks = {
    left: filterValidGroups(parseDockGroupsInput(source.docks?.left, panels), panels, seen),
    right: filterValidGroups(parseDockGroupsInput(source.docks?.right, panels), panels, seen)
  }

  const floatsWithGroups: { tempId: string; x: number; y: number; width: number; height: number; z: number; groups: PanelGroup[] }[] = []
  for (const float of rawFloats) {
    const groups = filterValidGroups(float.groups, panels, seen)
    if (groups.length > 0) floatsWithGroups.push({ ...float, groups })
  }

  reinsertMissingV5(docks, floatsWithGroups, panels, seen)

  const floats: FloatContainer[] = floatsWithGroups
    .sort((a, b) => a.z - b.z)
    .map((float, index) => ({
      id: `float:${index}`,
      x: float.x,
      y: float.y,
      width: float.width,
      height: float.height,
      z: index + 1,
      groups: float.groups,
      members: float.groups.flatMap((g) => g.members)
    }))

  updateV5Cache(docks, floats, panels)
  clampV5FloatsAndHeights(docks, floats, panels)

  return { version: PANEL_LAYOUT_VERSION, dockWidths, docks, floats, panels }
}

// --- Legacy v4 normalisation and migration to v5 ---

function normaliseStateV4(value: unknown, fallback: RegisteredPanelStateV4, id: PanelId): RegisteredPanelStateV4 {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<RegisteredPanelStateV4>
  const dock = (source.lastDock && typeof source.lastDock === 'object' ? source.lastDock : {}) as Partial<RegisteredPanelStateV4['lastDock']>
  const collapsed = bool(source.collapsed, fallback.collapsed)
  const isContent = PANEL_REGISTRY_BY_ID[id].sizing === 'content'
  const height =
    collapsed || isContent || source.height === null || source.height === undefined
      ? null
      : integer(source.height, fallback.height ?? PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT)

  return {
    open: bool(source.open, fallback.open),
    container: normaliseContainerId(source.container, fallback.container),
    index: integer(source.index, fallback.index, 0, PANEL_IDS.length),
    lastDock: { side: side(dock.side, fallback.lastDock.side), index: integer(dock.index, fallback.lastDock.index, 0, PANEL_IDS.length) },
    height,
    collapsed,
    floatFallback: clampFloatRectFields((source.floatFallback ?? {}) as Partial<PanelRect>, fallback.floatFallback)
  }
}

function normaliseMemberHeightsV4(floats: FloatContainerV4[], panels: Record<PanelId, RegisteredPanelStateV4>): void {
  for (const float of floats) {
    const expandedCount = float.members.filter((id) => !panels[id].collapsed).length
    const collapsedCount = float.members.length - expandedCount
    const required = PANEL_FLOAT_TITLE_HEIGHT + expandedCount * PANEL_MEMBER_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT
    if (float.height < required) float.height = required
  }
}

export function normaliseV4Legacy(value: unknown): PanelLayoutV4 {
  const defaultDocksV4 = { left: ['pages', 'layers'] as PanelId[], right: ['transform', 'appearance', 'page'] as PanelId[] }
  const defaultHeightV4: Partial<Record<PanelId, number>> = { pages: 200 }
  const defaultOpenV4 = new Set<PanelId>(['pages', 'layers', 'transform', 'appearance', 'page'])
  const fallbackPanelsV4 = Object.fromEntries(
    PANEL_IDS.map((id) => {
      const entry = PANEL_REGISTRY_BY_ID[id]
      return [id, { open: defaultOpenV4.has(id), container: entry.defaultDock, index: entry.defaultGroupIndex, lastDock: { side: entry.defaultDock, index: entry.defaultGroupIndex }, height: defaultHeightV4[id] ?? null, collapsed: false, floatFallback: { ...entry.defaultFloating } }]
    })
  ) as Record<PanelId, RegisteredPanelStateV4>

  if (!value || typeof value !== 'object') {
    return {
      version: 4,
      dockWidths: { ...DEFAULT_DOCK_WIDTHS },
      docks: { left: [...defaultDocksV4.left], right: [...defaultDocksV4.right] },
      floats: [],
      panels: fallbackPanelsV4
    }
  }
  const source = value as PanelLayoutInput

  const dockWidths = {
    left: integer(source.dockWidths?.left, DEFAULT_DOCK_WIDTHS.left, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH),
    right: integer(source.dockWidths?.right, DEFAULT_DOCK_WIDTHS.right, PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH)
  }

  const panelsSource = source.panels ?? {}
  const panels = Object.fromEntries(
    PANEL_IDS.map((id) => [id, normaliseStateV4(panelsSource[id], fallbackPanelsV4[id], id)])
  ) as Record<PanelId, RegisteredPanelStateV4>

  const built = buildContainers(source, panels)
  reinsertMissingOpenPanels(built.docks, built.floats, panels, built.seen)
  const floats = finaliseFloats(built.floats.filter((entry) => entry.members.length > 0))
  recomputeContainerCache(built.docks, floats, panels)
  normaliseMemberHeightsV4(floats, panels)

  return { version: 4, dockWidths, docks: built.docks, floats, panels }
}

export function migrateV3ToV4(v3: PanelLayoutV3): PanelLayoutV4 {
  const docks: { left: PanelId[]; right: PanelId[] } = { left: [...v3.docks.left], right: [...v3.docks.right] }
  const floats: FloatContainerV4[] = v3.floats.map((float) => ({ ...float, members: [...float.members] }))
  const panels = {} as Record<PanelId, RegisteredPanelStateV4>
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
  return normaliseV4Legacy({
    version: 4,
    dockWidths: { ...v3.dockWidths },
    docks,
    floats,
    panels
  })
}

export function migrateV4ToV5(v4: PanelLayoutV4): PanelLayout {
  const mapDock = (members: PanelId[]): PanelGroup[] =>
    members.map((id) => ({
      members: [id],
      active: id,
      height: v4.panels[id].height,
      collapsed: v4.panels[id].collapsed
    }))

  const floats = v4.floats.map((float) => ({
    id: float.id,
    x: float.x,
    y: float.y,
    width: float.width,
    height: float.height,
    z: float.z,
    groups: float.members.map((id) => ({ members: [id], active: id, height: v4.panels[id].height, collapsed: v4.panels[id].collapsed })),
    members: [...float.members]
  }))

  const panels = {} as Record<PanelId, RegisteredPanelState>
  for (const id of PANEL_IDS) {
    const s = v4.panels[id]
    panels[id] = {
      open: s.open,
      container: s.container,
      groupIndex: s.index,
      tabIndex: 0,
      lastDock: { side: s.lastDock.side, groupIndex: s.lastDock.index, tabIndex: 0 },
      height: s.height,
      collapsed: s.collapsed,
      floatFallback: { ...s.floatFallback }
    }
  }

  return normaliseV5({
    version: PANEL_LAYOUT_VERSION,
    dockWidths: { ...v4.dockWidths },
    docks: { left: mapDock(v4.docks.left), right: mapDock(v4.docks.right) },
    floats,
    panels
  })
}
