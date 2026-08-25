import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  type Effect,
  type ExportFormatId,
  type ExportSetting,
  type Fill,
  type GradientSpinePoint,
  type PluginDataEntry,
  type PluginRelaunchDataEntry
} from '@open-pencil/scene-graph'
import { isAdjustmentEffect } from '@open-pencil/scene-graph/node-defaults'
import { BLACK } from '@open-pencil/scene-graph/constants'

export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
export const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
export const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'
export const NODE_TYPE_PLUGIN_KEY = 'nodeType'
export const BOUND_VARIABLES_PLUGIN_KEY = 'boundVariables'
export const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'
export const ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY = 'adjustmentEffectStackV1'
export const CURVED_GRADIENT_PLUGIN_KEY = 'curvedGradientFillsV1'

const NATIVE_EXPORT_FORMATS: Record<string, ExportFormatId> = {
  PNG: 'png',
  JPEG: 'jpg',
  SVG: 'svg',
  PDF: 'pdf'
}

export function upsertPluginData(
  node: { pluginData: PluginDataEntry[] },
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
  )
  pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_ID, key, value })
  node.pluginData = pluginData
}

type AdjustmentStackEntry =
  | { kind: 'native'; index: number }
  | { kind: 'adjustment'; type: 'BRIGHTNESS_CONTRAST'; visible: boolean; brightness: number; contrast: number }
  | { kind: 'adjustment'; type: 'SATURATION'; visible: boolean; saturation: number }
  | { kind: 'adjustment'; type: 'CURVES'; visible: boolean; gamma: number }

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function syncAdjustmentEffectStackPluginData(node: {
  effects: Effect[]
  pluginData: PluginDataEntry[]
}): void {
  const native = node.effects.filter((effect) => !isAdjustmentEffect(effect))
  const stack: AdjustmentStackEntry[] = []
  let nativeIndex = 0
  for (const effect of node.effects) {
    if (!isAdjustmentEffect(effect)) stack.push({ kind: 'native', index: nativeIndex++ })
    else if (effect.type === 'BRIGHTNESS_CONTRAST') {
      stack.push({ kind: 'adjustment', type: effect.type, visible: effect.visible, brightness: clamp(effect.brightness ?? 0, -100, 100), contrast: clamp(effect.contrast ?? 0, -100, 100) })
    } else if (effect.type === 'SATURATION') {
      stack.push({ kind: 'adjustment', type: effect.type, visible: effect.visible, saturation: clamp(effect.saturation ?? 100, 0, 200) })
    } else if (effect.type === 'CURVES') {
      stack.push({ kind: 'adjustment', type: effect.type, visible: effect.visible, gamma: clamp(effect.gamma ?? 1, 0.1, 3) })
    }
  }
  const preserved = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY)
  )
  node.pluginData = native.length === node.effects.length
    ? preserved
    : [...preserved, { pluginId: OPEN_PENCIL_PLUGIN_ID, key: ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY, value: JSON.stringify({ version: 1, stack }) }]
}

// eslint-disable-next-line complexity
export function restoreAdjustmentEffectStack(
  nativeEffects: Effect[],
  pluginData: PluginDataEntry[]
): Effect[] {
  const value = pluginData.find((entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY)?.value
  if (!value) return nativeEffects
  try {
    const payload = JSON.parse(value) as { version?: unknown; stack?: unknown }
    if (payload.version !== 1 || !Array.isArray(payload.stack)) return nativeEffects
    const used = new Set<number>()
    const result: Effect[] = []
    for (const raw of payload.stack) {
      if (!raw || typeof raw !== 'object') return nativeEffects
      const entry = raw
      if (entry.kind === 'native') {
        if (!Number.isInteger(entry.index) || Number(entry.index) < 0 || Number(entry.index) >= nativeEffects.length || used.has(Number(entry.index))) return nativeEffects
        used.add(Number(entry.index)); result.push(nativeEffects[Number(entry.index)])
      } else if (entry.kind === 'adjustment' && typeof entry.type === 'string' && typeof entry.visible === 'boolean') {
        if (entry.type === 'BRIGHTNESS_CONTRAST' && finite(entry.brightness) && finite(entry.contrast)) result.push({ type: entry.type, color: BLACK, offset: { x: 0, y: 0 }, radius: 0, spread: 0, visible: entry.visible, brightness: clamp(entry.brightness, -100, 100), contrast: clamp(entry.contrast, -100, 100) })
        else if (entry.type === 'SATURATION' && finite(entry.saturation)) result.push({ type: entry.type, color: BLACK, offset: { x: 0, y: 0 }, radius: 0, spread: 0, visible: entry.visible, saturation: clamp(entry.saturation, 0, 200) })
        else if (entry.type === 'CURVES' && finite(entry.gamma)) result.push({ type: entry.type, color: BLACK, offset: { x: 0, y: 0 }, radius: 0, spread: 0, visible: entry.visible, gamma: clamp(entry.gamma, 0.1, 3) })
        else return nativeEffects
      } else return nativeEffects
    }
    return used.size === nativeEffects.length ? result : nativeEffects
  } catch {
    return nativeEffects
  }
}

export function syncCurvedGradientPluginData(node: {
  fills: Fill[]
  pluginData: PluginDataEntry[]
}): void {
  const byIndex: Record<number, GradientSpinePoint[]> = {}
  for (let i = 0; i < node.fills.length; i++) {
    const fill = node.fills[i]
    if (fill.type === 'GRADIENT_CURVED') {
      byIndex[i] = (fill.gradientSpine ?? []).map((p) => ({
        t: p.t,
        offset: p.offset
      }))
    }
  }
  const preserved = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === CURVED_GRADIENT_PLUGIN_KEY)
  )
  node.pluginData =
    Object.keys(byIndex).length === 0
      ? preserved
      : [
          ...preserved,
          {
            pluginId: OPEN_PENCIL_PLUGIN_ID,
            key: CURVED_GRADIENT_PLUGIN_KEY,
            value: JSON.stringify({ version: 1, byIndex })
          }
        ]
}

export function restoreCurvedGradientFills(
  fills: Fill[],
  pluginData: PluginDataEntry[]
): Fill[] {
  const value = pluginData.find(
    (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === CURVED_GRADIENT_PLUGIN_KEY
  )?.value
  if (!value) return fills
  try {
    const payload = JSON.parse(value) as { version?: unknown; byIndex?: unknown }
    if (
      payload.version !== 1 ||
      !payload.byIndex ||
      typeof payload.byIndex !== 'object' ||
      Array.isArray(payload.byIndex)
    ) {
      return fills
    }
    type SpineByIndexMap = Record<string | number, unknown>
    const byIndex = payload.byIndex as SpineByIndexMap
    return fills.map((fill, index) => {
      const entry = byIndex[index] ?? byIndex[String(index)]
      if (!Array.isArray(entry)) return fill
      const spine: GradientSpinePoint[] = []
      for (const point of entry) {
        if (!point || typeof point !== 'object' || Array.isArray(point)) return fill
        const t = (point as { t?: unknown }).t
        const offset = (point as { offset?: unknown }).offset
        if (
          typeof t !== 'number' ||
          !Number.isFinite(t) ||
          typeof offset !== 'number' ||
          !Number.isFinite(offset)
        ) {
          return fill
        }
        spine.push({ t, offset })
      }
      return {
        ...fill,
        type: 'GRADIENT_CURVED',
        gradientSpine: spine
      }
    })
  } catch {
    return fills
  }
}

export function applyExportSettingsPluginData(node: {
  exportSettings: ExportSetting[]
  pluginData: PluginDataEntry[]
  source?: { fig?: { rawNodeFields?: Record<string, unknown> } }
}): void {
  if (node.exportSettings.length === 0) return
  if (
    !hasOpenPencilExportSettingsPluginData(node.pluginData) &&
    Array.isArray(node.source?.fig?.rawNodeFields?.exportSettings)
  ) {
    return
  }
  upsertPluginData(node, EXPORT_SETTINGS_PLUGIN_KEY, JSON.stringify(node.exportSettings))
}

function hasOpenPencilExportSettingsPluginData(pluginData: PluginDataEntry[]): boolean {
  return pluginData.some(
    (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === EXPORT_SETTINGS_PLUGIN_KEY
  )
}

function parseBoundVariablesPluginValue(value: string | null): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  const bindings = parseBoundVariablesPluginValue(
    getOpenPencilPluginValue(nc, BOUND_VARIABLES_PLUGIN_KEY)
  )
  nc.fillPaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`fills/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  nc.strokePaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`strokes/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  return bindings
}

function isExportFormatId(value: unknown): value is ExportFormatId {
  return (
    value === 'png' ||
    value === 'jpg' ||
    value === 'webp' ||
    value === 'svg' ||
    value === 'pdf' ||
    value === 'pdf-print' ||
    value === 'idml'
  )
}

function parseExportSettingsPluginValue(value: string | null): ExportSetting[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return null
    const settings = parsed.flatMap((entry): ExportSetting[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
      const scale = (entry as { scale?: unknown }).scale
      const format = (entry as { format?: unknown }).format
      if (typeof scale !== 'number' || !Number.isFinite(scale) || !isExportFormatId(format)) {
        return []
      }
      // Clamp at the file-format boundary: imported plugin data may carry an
      // out-of-range scale the UI would never produce.
      return [{ scale: clampExportScale(scale), format }]
    })
    return settings.length === parsed.length ? settings : null
  } catch {
    return null
  }
}

function mapNativeImageType(imageType: unknown): ExportFormatId | null {
  if (typeof imageType === 'string') return NATIVE_EXPORT_FORMATS[imageType] ?? null
  if (imageType === 0) return 'png'
  if (imageType === 1) return 'jpg'
  if (imageType === 2) return 'svg'
  if (imageType === 3) return 'pdf'
  return null
}

function extractNativeConstraintScale(constraint: unknown): number {
  if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) return 1
  const type = (constraint as { type?: unknown }).type
  if (type !== 'CONTENT_SCALE' && type !== 0) return 1
  const value = (constraint as { value?: unknown }).value
  // Clamp native CONTENT_SCALE too: malformed .fig data can carry huge multipliers.
  return typeof value === 'number' && Number.isFinite(value) ? clampExportScale(value) : 1
}

export function extractExportSettings(nc: NodeChange): ExportSetting[] {
  const pluginSettings = parseExportSettingsPluginValue(
    getOpenPencilPluginValue(nc, EXPORT_SETTINGS_PLUGIN_KEY)
  )
  if (pluginSettings) return pluginSettings

  return (nc.exportSettings ?? []).flatMap((entry): ExportSetting[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const format = mapNativeImageType((entry as { imageType?: unknown }).imageType)
    if (!format) return []
    return [
      {
        scale: extractNativeConstraintScale((entry as { constraint?: unknown }).constraint),
        format
      }
    ]
  })
}

export function extractPluginData(nc: NodeChange): PluginDataEntry[] {
  return (nc.pluginData ?? []).map((entry) => ({
    pluginId: entry.pluginID,
    key: entry.key,
    value: entry.value
  }))
}

export function getOpenPencilPluginValue(nc: NodeChange, key: string): string | null {
  return (
    nc.pluginData?.find((entry) => entry.pluginID === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
      ?.value ?? null
  )
}

export function extractPluginRelaunchData(nc: NodeChange): PluginRelaunchDataEntry[] {
  return (nc.pluginRelaunchData ?? []).map((entry) => ({
    pluginId: entry.pluginID,
    command: entry.command,
    message: entry.message,
    isDeleted: entry.isDeleted
  }))
}

export function mergePluginData(pluginData: PluginDataEntry[]): PluginData[] {
  return pluginData.map((entry) => ({
    pluginID: entry.pluginId,
    key: entry.key,
    value: entry.value
  }))
}

export function serializePluginRelaunchData(
  entries: PluginRelaunchDataEntry[]
): PluginRelaunchData[] {
  return entries.map((entry) => ({
    pluginID: entry.pluginId,
    command: entry.command,
    message: entry.message,
    isDeleted: entry.isDeleted
  }))
}
