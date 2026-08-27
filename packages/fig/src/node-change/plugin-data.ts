import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  type BlendMode,
  type Effect,
  type ExportFormatId,
  type ExportSetting,
  type Fill,
  type PluginDataEntry,
  type PluginRelaunchDataEntry,
  type SceneNode
} from '@open-pencil/scene-graph'
import { isFigmaNativeEffect } from '@open-pencil/scene-graph/node-defaults'
import { BLACK } from '@open-pencil/scene-graph/constants'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'

/* eslint-disable max-lines -- format-boundary validation is intentionally co-located */

import { readEffectiveFigmaRawField } from '../source-metadata'
import { resolveVariableConsumptionEntry } from './variable-bindings'

export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
export const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
export const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'
export const NODE_TYPE_PLUGIN_KEY = 'nodeType'
export const BOUND_VARIABLES_PLUGIN_KEY = 'boundVariables'
export const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'
export const TEXT_PATH_BOX_PLUGIN_KEY = 'textPathBox'
export const LIBRARY_SOURCE_PLUGIN_KEY = 'librarySource'
export const ENABLED_LIBRARIES_PLUGIN_KEY = 'enabledLibraries'
export const ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY = 'adjustmentEffectStackV1'

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

type NativeEffectStackEntry = {
  kind: 'native'
  index: number
  blurType?: 'NORMAL' | 'PROGRESSIVE'
  startRadius?: number
  startOffset?: Vector
  endOffset?: Vector
}

type AdjustmentEffectStackEntry =
  | {
      kind: 'adjustment'
      type: 'BRIGHTNESS_CONTRAST'
      visible: boolean
      brightness: number
      contrast: number
    }
  | { kind: 'adjustment'; type: 'SATURATION'; visible: boolean; saturation: number }
  | { kind: 'adjustment'; type: 'CURVES'; visible: boolean; gamma: number }
  | {
      kind: 'noise'
      visible: boolean
      radius: number
      color: Color
      blendMode?: BlendMode
    }

type EffectStackEntry = NativeEffectStackEntry | AdjustmentEffectStackEntry

const VALID_BLEND_MODES = new Set<BlendMode>([
  'NORMAL',
  'DARKEN',
  'MULTIPLY',
  'COLOR_BURN',
  'LIGHTEN',
  'SCREEN',
  'COLOR_DODGE',
  'OVERLAY',
  'SOFT_LIGHT',
  'HARD_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY',
  'PASS_THROUGH'
])

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hasProgressiveBlurFields(effect: Effect): boolean {
  return (
    effect.blurType !== undefined ||
    effect.startRadius !== undefined ||
    effect.startOffset !== undefined ||
    effect.endOffset !== undefined
  )
}

function nativeStackEntry(effect: Effect, index: number): NativeEffectStackEntry {
  return {
    kind: 'native',
    index,
    blurType: effect.blurType,
    startRadius: effect.startRadius,
    startOffset: effect.startOffset,
    endOffset: effect.endOffset
  }
}

export function syncAdjustmentEffectStackPluginData(
  node: Pick<SceneNode, 'effects' | 'pluginData'>
): void {
  const stack: EffectStackEntry[] = []
  let nativeIndex = 0
  let hasExtensionState = false

  for (const effect of node.effects) {
    if (isFigmaNativeEffect(effect)) {
      stack.push(nativeStackEntry(effect, nativeIndex++))
      hasExtensionState ||= hasProgressiveBlurFields(effect)
    } else if (effect.type === 'BRIGHTNESS_CONTRAST') {
      hasExtensionState = true
      stack.push({
        kind: 'adjustment',
        type: effect.type,
        visible: effect.visible,
        brightness: clamp(effect.brightness ?? 0, -100, 100),
        contrast: clamp(effect.contrast ?? 0, -100, 100)
      })
    } else if (effect.type === 'SATURATION') {
      hasExtensionState = true
      stack.push({
        kind: 'adjustment',
        type: effect.type,
        visible: effect.visible,
        saturation: clamp(effect.saturation ?? 100, 0, 200)
      })
    } else if (effect.type === 'CURVES') {
      hasExtensionState = true
      stack.push({
        kind: 'adjustment',
        type: effect.type,
        visible: effect.visible,
        gamma: clamp(effect.gamma ?? 1, 0.1, 3)
      })
    } else if (effect.type === 'NOISE') {
      hasExtensionState = true
      stack.push({
        kind: 'noise',
        visible: effect.visible,
        radius: Math.max(0, effect.radius),
        color: { ...effect.color },
        blendMode: effect.blendMode
      })
    }
  }

  const preserved = node.pluginData.filter(
    (entry) =>
      !(
        entry.pluginId === OPEN_PENCIL_PLUGIN_ID &&
        entry.key === ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY
      )
  )
  node.pluginData = hasExtensionState
    ? [
        ...preserved,
        {
          pluginId: OPEN_PENCIL_PLUGIN_ID,
          key: ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY,
          value: JSON.stringify({ version: 1, stack })
        }
      ]
    : preserved
}

function finiteVector(value: unknown): value is Vector {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const vector = value as { x?: unknown; y?: unknown }
  return finite(vector.x) && finite(vector.y)
}

function finiteColor(value: unknown): value is Color {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const color = value as { r?: unknown; g?: unknown; b?: unknown; a?: unknown }
  return finite(color.r) && finite(color.g) && finite(color.b) && finite(color.a)
}

function validBlendMode(value: unknown): value is BlendMode {
  return typeof value === 'string' && VALID_BLEND_MODES.has(value as BlendMode)
}

// eslint-disable-next-line complexity -- each optional field is independently fail-closed
function restoreNativeEffect(
  nativeEffect: Effect,
  entry: Record<string, unknown>
): Effect | null {
  const hasExtension =
    entry.blurType !== undefined ||
    entry.startRadius !== undefined ||
    entry.startOffset !== undefined ||
    entry.endOffset !== undefined
  if (!hasExtension) return nativeEffect
  if (
    nativeEffect.type !== 'LAYER_BLUR' &&
    nativeEffect.type !== 'BACKGROUND_BLUR' &&
    nativeEffect.type !== 'FOREGROUND_BLUR'
  ) {
    return null
  }
  if (
    entry.blurType !== undefined &&
    entry.blurType !== 'NORMAL' &&
    entry.blurType !== 'PROGRESSIVE'
  ) {
    return null
  }
  if (entry.startRadius !== undefined && (!finite(entry.startRadius) || entry.startRadius < 0)) {
    return null
  }
  if (entry.startOffset !== undefined && !finiteVector(entry.startOffset)) return null
  if (entry.endOffset !== undefined && !finiteVector(entry.endOffset)) return null

  return {
    ...nativeEffect,
    ...(entry.blurType === undefined ? {} : { blurType: entry.blurType }),
    ...(entry.startRadius === undefined ? {} : { startRadius: entry.startRadius }),
    ...(entry.startOffset === undefined ? {} : { startOffset: entry.startOffset }),
    ...(entry.endOffset === undefined ? {} : { endOffset: entry.endOffset })
  }
}

// eslint-disable-next-line complexity -- fail-closed validation is deliberately explicit
export function restoreAdjustmentEffectStack(
  nativeEffects: Effect[],
  pluginData: PluginDataEntry[]
): Effect[] {
  const value = pluginData.find(
    (entry) =>
      entry.pluginId === OPEN_PENCIL_PLUGIN_ID &&
      entry.key === ADJUSTMENT_EFFECT_STACK_PLUGIN_KEY
  )?.value
  if (!value) return nativeEffects

  try {
    const payload = JSON.parse(value) as { version?: unknown; stack?: unknown }
    if (payload.version !== 1 || !Array.isArray(payload.stack)) return nativeEffects
    const used = new Set<number>()
    const result: Effect[] = []

    for (const raw of payload.stack) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return nativeEffects
      const entry = raw as {
        kind?: unknown
        type?: unknown
        index?: unknown
        visible?: unknown
        brightness?: unknown
        contrast?: unknown
        saturation?: unknown
        gamma?: unknown
        radius?: unknown
        color?: unknown
        blendMode?: unknown
        blurType?: unknown
        startRadius?: unknown
        startOffset?: unknown
        endOffset?: unknown
      }
      if (entry.kind === 'native') {
        if (
          !Number.isInteger(entry.index) ||
          Number(entry.index) < 0 ||
          Number(entry.index) >= nativeEffects.length ||
          used.has(Number(entry.index))
        ) {
          return nativeEffects
        }
        const index = Number(entry.index)
        const restored = restoreNativeEffect(nativeEffects[index], entry)
        if (!restored) return nativeEffects
        used.add(index)
        result.push(restored)
      } else if (
        entry.kind === 'adjustment' &&
        typeof entry.type === 'string' &&
        typeof entry.visible === 'boolean'
      ) {
        if (
          entry.type === 'BRIGHTNESS_CONTRAST' &&
          finite(entry.brightness) &&
          finite(entry.contrast)
        ) {
          result.push({
            type: entry.type,
            color: { ...BLACK },
            offset: { x: 0, y: 0 },
            radius: 0,
            spread: 0,
            visible: entry.visible,
            brightness: clamp(entry.brightness, -100, 100),
            contrast: clamp(entry.contrast, -100, 100)
          })
        } else if (entry.type === 'SATURATION' && finite(entry.saturation)) {
          result.push({
            type: entry.type,
            color: { ...BLACK },
            offset: { x: 0, y: 0 },
            radius: 0,
            spread: 0,
            visible: entry.visible,
            saturation: clamp(entry.saturation, 0, 200)
          })
        } else if (entry.type === 'CURVES' && finite(entry.gamma)) {
          result.push({
            type: entry.type,
            color: { ...BLACK },
            offset: { x: 0, y: 0 },
            radius: 0,
            spread: 0,
            visible: entry.visible,
            gamma: clamp(entry.gamma, 0.1, 3)
          })
        } else {
          return nativeEffects
        }
      } else if (
        entry.kind === 'noise' &&
        typeof entry.visible === 'boolean' &&
        finite(entry.radius) &&
        entry.radius >= 0 &&
        finiteColor(entry.color) &&
        (entry.blendMode === undefined || validBlendMode(entry.blendMode))
      ) {
        result.push({
          type: 'NOISE',
          color: entry.color,
          offset: { x: 0, y: 0 },
          radius: entry.radius,
          spread: 0,
          visible: entry.visible,
          ...(entry.blendMode === undefined ? {} : { blendMode: entry.blendMode })
        })
      } else {
        return nativeEffects
      }
    }

    return used.size === nativeEffects.length ? result : nativeEffects
  } catch {
    return nativeEffects
  }
}

export function applyExportSettingsPluginData(
  node: Pick<SceneNode, 'exportSettings' | 'pluginData' | 'source'>
): void {
  if (node.exportSettings.length === 0) return
  if (
    !hasOpenPencilExportSettingsPluginData(node.pluginData) &&
    Array.isArray(readEffectiveFigmaRawField(node, 'exportSettings'))
  ) {
    return
  }
  upsertPluginData(node, EXPORT_SETTINGS_PLUGIN_KEY, JSON.stringify(node.exportSettings))
}

/**
 * textPathBox is OpenPencil-only state (the node-local rect the TEXT_PATH
 * layout path maps onto, after import-time box expansion and resize scaling).
 * The Kiwi schema has no home for it, and reconstructing it from an expanded,
 * resized node is ambiguous — persist it as plugin data so save/reopen keeps
 * reflow anchored correctly.
 */
export function applyTextPathBoxPluginData(node: {
  textPathBox: Rect | null
  pluginData: PluginDataEntry[]
}): void {
  if (!node.textPathBox) return
  upsertPluginData(node, TEXT_PATH_BOX_PLUGIN_KEY, JSON.stringify(node.textPathBox))
}

export function extractTextPathBox(nc: NodeChange): Rect | null {
  const value = getOpenPencilPluginValue(nc, TEXT_PATH_BOX_PLUGIN_KEY)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<Rect> | null
    if (!parsed || typeof parsed !== 'object') return null
    const { x, y, width, height } = parsed
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return null
    }
    if (!Number.isFinite(x + y + width + height) || width <= 0 || height <= 0) return null
    return { x, y, width, height }
  } catch {
    return null
  }
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
  for (const entry of nc.variableConsumptionMap?.entries ?? []) {
    const binding = resolveVariableConsumptionEntry(entry)
    if (binding) bindings[binding.field] = binding.variableId
  }
  nc.fillPaints?.forEach((paint, i) => {
    const variableGuid =
      paint.colorVariableBinding?.variableID ?? paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`fills/${i}/color`] = guidToString(variableGuid)
  })
  nc.strokePaints?.forEach((paint, i) => {
    const variableGuid =
      paint.colorVariableBinding?.variableID ?? paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`strokes/${i}/color`] = guidToString(variableGuid)
  })
  return bindings
}

function isExportFormatId(value: unknown): value is ExportFormatId {
  return (
    value === 'png' || value === 'jpg' || value === 'webp' || value === 'svg' || value === 'pdf'
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

export function extractLibrarySource(nc: NodeChange): SceneNode['librarySource'] {
  const value = getOpenPencilPluginValue(nc, LIBRARY_SOURCE_PLUGIN_KEY)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const source = parsed as {
      identity?: { libraryId?: unknown; assetKey?: unknown; revisionId?: unknown }
      sourceNodeId?: unknown
      readOnly?: unknown
    }
    if (
      typeof source.identity?.libraryId !== 'string' ||
      typeof source.identity.assetKey !== 'string' ||
      typeof source.identity.revisionId !== 'string'
    ) {
      return null
    }
    return {
      identity: {
        libraryId: source.identity.libraryId,
        assetKey: source.identity.assetKey,
        revisionId: source.identity.revisionId
      },
      sourceNodeId: typeof source.sourceNodeId === 'string' ? source.sourceNodeId : null,
      readOnly: source.readOnly === true
    }
  } catch {
    return null
  }
}

export function applyLibrarySourcePluginData(node: SceneNode): void {
  if (node.librarySource) {
    upsertPluginData(node, LIBRARY_SOURCE_PLUGIN_KEY, JSON.stringify(node.librarySource))
  } else {
    node.pluginData = node.pluginData.filter(
      (entry) =>
        !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === LIBRARY_SOURCE_PLUGIN_KEY)
    )
  }
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
