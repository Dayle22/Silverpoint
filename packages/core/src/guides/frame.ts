import type { PluginDataEntry } from '@open-pencil/scene-graph'

export const FRAME_GUIDES_PLUGIN_ID = 'open-pencil'
export const FRAME_GUIDES_PLUGIN_KEY = 'frameGuides'
export const FRAME_GUIDE_MAX = 100000

export type FrameGuideEdge = 'top' | 'right' | 'bottom' | 'left'
export type FrameGuideKind = 'margins' | 'bleed'

export interface FrameEdgeGuides {
  enabled: boolean
  linked: boolean
  top: number
  right: number
  bottom: number
  left: number
}

export interface FrameGuides {
  version: 1
  margins: FrameEdgeGuides
  bleed: FrameEdgeGuides
}

interface RawFrameEdgeGuides {
  enabled?: unknown
  linked?: unknown
  top?: unknown
  right?: unknown
  bottom?: unknown
  left?: unknown
}

interface RawFrameGuides {
  version?: unknown
  margins?: unknown
  bleed?: unknown
}

const DEFAULT_EDGES: FrameEdgeGuides = {
  enabled: false,
  linked: true,
  top: 16,
  right: 16,
  bottom: 16,
  left: 16
}

export const DEFAULT_FRAME_GUIDES: FrameGuides = {
  version: 1,
  margins: { ...DEFAULT_EDGES },
  bleed: { ...DEFAULT_EDGES }
}

function cloneDefaults(): FrameGuides {
  return structuredClone(DEFAULT_FRAME_GUIDES)
}

function clampGuideValue(value: number): number {
  return Math.min(FRAME_GUIDE_MAX, Math.max(0, value))
}

function parseEdges(value: unknown): FrameEdgeGuides | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const edges = value as RawFrameEdgeGuides
  if (typeof edges.enabled !== 'boolean' || typeof edges.linked !== 'boolean') return null
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    if (typeof edges[side] !== 'number' || !Number.isFinite(edges[side])) return null
  }
  return {
    enabled: edges.enabled,
    linked: edges.linked,
    top: clampGuideValue(edges.top as number),
    right: clampGuideValue(edges.right as number),
    bottom: clampGuideValue(edges.bottom as number),
    left: clampGuideValue(edges.left as number)
  }
}

export function parseFrameGuides(pluginData?: PluginDataEntry[]): FrameGuides {
  const entry = (pluginData ?? []).find(
    (candidate) =>
      candidate.pluginId === FRAME_GUIDES_PLUGIN_ID && candidate.key === FRAME_GUIDES_PLUGIN_KEY
  )
  if (!entry) return cloneDefaults()
  try {
    const value = JSON.parse(entry.value) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return cloneDefaults()
    const record = value as RawFrameGuides
    if (record.version !== 1) return cloneDefaults()
    const margins = parseEdges(record.margins)
    const bleed = parseEdges(record.bleed)
    if (!margins || !bleed) return cloneDefaults()
    return { version: 1, margins, bleed }
  } catch {
    return cloneDefaults()
  }
}

export function upsertFrameGuides(
  pluginData: PluginDataEntry[],
  guides: FrameGuides
): PluginDataEntry[] {
  const preserved = pluginData.filter(
    (entry) => !(entry.pluginId === FRAME_GUIDES_PLUGIN_ID && entry.key === FRAME_GUIDES_PLUGIN_KEY)
  )
  return [
    ...structuredClone(preserved),
    {
      pluginId: FRAME_GUIDES_PLUGIN_ID,
      key: FRAME_GUIDES_PLUGIN_KEY,
      value: JSON.stringify(guides)
    }
  ]
}

function maxMarginForEdge(
  guides: FrameEdgeGuides,
  edge: FrameGuideEdge,
  width: number,
  height: number
): number {
  const epsilon = 0.000001
  if (edge === 'left') return Math.max(0, width - guides.right - epsilon)
  if (edge === 'right') return Math.max(0, width - guides.left - epsilon)
  if (edge === 'top') return Math.max(0, height - guides.bottom - epsilon)
  return Math.max(0, height - guides.top - epsilon)
}

export function setFrameGuideEdge(
  current: FrameGuides,
  kind: FrameGuideKind,
  edge: FrameGuideEdge,
  value: number,
  frameWidth: number,
  frameHeight: number
): FrameGuides {
  if (!Number.isFinite(value)) return structuredClone(current)
  const next = structuredClone(current)
  const edges = next[kind]
  let committed = clampGuideValue(value)
  if (kind === 'margins') {
    committed = edges.linked
      ? Math.min(committed, Math.max(0, Math.min(frameWidth, frameHeight) / 2 - 0.000001))
      : Math.min(committed, maxMarginForEdge(edges, edge, frameWidth, frameHeight))
  }
  if (edges.linked) {
    edges.top = committed
    edges.right = committed
    edges.bottom = committed
    edges.left = committed
  } else {
    edges[edge] = committed
  }
  return next
}

export function setFrameGuideLinked(
  current: FrameGuides,
  kind: FrameGuideKind,
  linked: boolean,
  frameWidth = FRAME_GUIDE_MAX,
  frameHeight = FRAME_GUIDE_MAX
): FrameGuides {
  const next = structuredClone(current)
  const edges = next[kind]
  if (edges.linked === linked) return next
  edges.linked = linked
  if (linked) {
    const relinked = setFrameGuideEdge(next, kind, 'top', edges.top, frameWidth, frameHeight)
    relinked[kind].linked = true
    return relinked
  }
  return next
}
