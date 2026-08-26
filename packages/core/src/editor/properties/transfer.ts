import type {
  Effect,
  Fill,
  FontFeature,
  FontVariation,
  GridTrack,
  NodeType,
  SceneNode,
  Stroke
} from '@open-pencil/scene-graph'
import { copyEffects, copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'

export const PAINT_KEYS: readonly (keyof SceneNode)[] = [
  'fills',
  'strokes',
  'effects',
  'opacity',
  'blendMode'
] as const

export const STROKE_GEOMETRY_KEYS: readonly (keyof SceneNode)[] = [
  'strokeCap',
  'strokeJoin',
  'dashPattern',
  'strokeMiterLimit',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'independentStrokeWeights',
  'strokesIncludedInLayout'
] as const

export const CORNER_KEYS: readonly (keyof SceneNode)[] = [
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'cornerSmoothing'
] as const

export const LAYOUT_KEYS: readonly (keyof SceneNode)[] = [
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'counterAxisAlignContent',
  'itemReverseZIndex',
  'clipsContent',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap'
] as const

export const TEXT_KEYS: readonly (keyof SceneNode)[] = [
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
  'textAlignVertical',
  'textCase',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'leadingTrim',
  'lineHeight',
  'letterSpacing',
  'maxLines',
  'textTruncation',
  'textDirection',
  'textLanguage',
  'fontVariations',
  'fontFeatures'
] as const

export const CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SECTION'
])

export interface CopiedProperties {
  sourceType: NodeType
  properties: Partial<SceneNode>
  images?: Map<string, Uint8Array>
}

function cloneArrayValue<K extends keyof SceneNode>(key: K, value: unknown[]): SceneNode[K] {
  switch (key) {
    case 'fills':
    case 'textDecorationFills':
      return copyFills(value as Fill[]) as SceneNode[K]
    case 'strokes':
      return copyStrokes(value as Stroke[]) as SceneNode[K]
    case 'effects':
      return copyEffects(value as Effect[]) as SceneNode[K]
    case 'dashPattern':
      return [...(value as number[])] as SceneNode[K]
    case 'fontVariations':
      return (value as FontVariation[]).map((v) => ({ ...v })) as SceneNode[K]
    case 'fontFeatures':
      return (value as FontFeature[]).map((f) => ({ ...f })) as SceneNode[K]
    case 'gridTemplateColumns':
    case 'gridTemplateRows':
      return (value as GridTrack[]).map((t) => ({ ...t })) as SceneNode[K]
    default:
      return value as SceneNode[K]
  }
}

function cloneValue<K extends keyof SceneNode>(key: K, value: SceneNode[K]): SceneNode[K] {
  if (value === undefined) return value
  if (Array.isArray(value)) {
    return cloneArrayValue(key, value)
  }
  return value
}

function copyKeysInto(
  source: SceneNode | Partial<SceneNode>,
  keys: readonly (keyof SceneNode)[],
  target: Partial<SceneNode>
): void {
  for (const key of keys) {
    const val = source[key]
    if (val !== undefined) {
      Reflect.set(target, key, cloneValue(key, val))
    }
  }
}

export function extractTransferableProperties(node: SceneNode): CopiedProperties {
  const properties: Partial<SceneNode> = {}

  copyKeysInto(node, PAINT_KEYS, properties)
  copyKeysInto(node, STROKE_GEOMETRY_KEYS, properties)
  copyKeysInto(node, CORNER_KEYS, properties)

  if (CONTAINER_TYPES.has(node.type)) {
    copyKeysInto(node, LAYOUT_KEYS, properties)
  }

  if (node.type === 'TEXT') {
    copyKeysInto(node, TEXT_KEYS, properties)
  }

  return {
    sourceType: node.type,
    properties
  }
}

export function applicablePropertiesFor(
  sourceType: NodeType,
  targetType: NodeType,
  payload: CopiedProperties
): Partial<SceneNode> {
  const result: Partial<SceneNode> = {}
  const props = payload.properties

  copyKeysInto(props, PAINT_KEYS, result)
  copyKeysInto(props, STROKE_GEOMETRY_KEYS, result)
  copyKeysInto(props, CORNER_KEYS, result)

  if (CONTAINER_TYPES.has(sourceType) && CONTAINER_TYPES.has(targetType)) {
    copyKeysInto(props, LAYOUT_KEYS, result)
  }

  if (sourceType === 'TEXT' && targetType === 'TEXT') {
    copyKeysInto(props, TEXT_KEYS, result)
  }

  return result
}
