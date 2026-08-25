import { beforeEach, describe, expect, test } from 'bun:test'

import {
  CONTAINER_TYPES,
  CORNER_KEYS,
  LAYOUT_KEYS,
  PAINT_KEYS,
  STROKE_GEOMETRY_KEYS,
  TEXT_KEYS,
  applicablePropertiesFor,
  createEditor,
  extractTransferableProperties,
  type CopiedProperties
} from '@open-pencil/core/editor'
import type { Effect, Fill, Stroke } from '@open-pencil/scene-graph'

import {
  clearPropertyClipboard,
  copiedProperties,
  copySelectionProperties,
  hasCopiedProperties,
  pastePropertiesToSelection
} from '@/app/editor/clipboard/properties'
import { createEditorStore } from '@/app/editor/session'

const BANNED_KEYS: readonly string[] = [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'flipX',
  'flipY',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'name',
  'visible',
  'locked',
  'expanded',
  'autoRename',
  'text',
  'styleRuns',
  'textAutoResize',
  'textPicture',
  'figmaDerivedTextGlyphs',
  'vectorNetwork',
  'fillGeometry',
  'strokeGeometry',
  'arcData',
  'pointCount',
  'starInnerRadius',
  'booleanOperation',
  'isMask',
  'maskType',
  'maskIsOutline',
  'horizontalConstraint',
  'verticalConstraint',
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'gridPosition',
  'componentId',
  'componentKey',
  'componentPropertyDefinitions',
  'componentPropertyValues',
  'overrides',
  'overrideKey',
  'sourceLibraryKey',
  'publishId',
  'publishedVersion',
  'sharedSymbolVersion',
  'isPublishable',
  'isSymbolPublishable',
  'symbolDescription',
  'symbolLinks',
  'variantPropSpecs',
  'boundVariables',
  'exportSettings',
  'pluginData',
  'pluginRelaunchData',
  'source',
  'figmaDerivedLayout',
  'internalOnly',
  'id',
  'type',
  'parentId',
  'childIds'
]

describe('Property transfer model & contract', () => {
  beforeEach(() => {
    clearPropertyClipboard()
  })

  test('pinned key constants match specification exactly', () => {
    expect(PAINT_KEYS).toEqual(['fills', 'strokes', 'effects', 'opacity', 'blendMode'])
    expect(STROKE_GEOMETRY_KEYS).toEqual([
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
    ])
    expect(CORNER_KEYS).toEqual([
      'cornerRadius',
      'topLeftRadius',
      'topRightRadius',
      'bottomRightRadius',
      'bottomLeftRadius',
      'independentCorners',
      'cornerSmoothing'
    ])
    expect(LAYOUT_KEYS).toEqual([
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
    ])
    expect(TEXT_KEYS).toEqual([
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
    ])
    expect(Array.from(CONTAINER_TYPES).sort()).toEqual(
      ['COMPONENT', 'COMPONENT_SET', 'FRAME', 'INSTANCE', 'SECTION'].sort()
    )
  })

  test('banned keys are never extracted or applicable', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]?.id ?? ''
    const node = editor.graph.createNode('FRAME', page, {
      name: 'TestFrame',
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      rotation: 45,
      visible: true,
      locked: false,
      opacity: 0.8
    })

    const payload = extractTransferableProperties(node)
    const targetChanges = applicablePropertiesFor('FRAME', 'FRAME', payload)

    for (const banned of BANNED_KEYS) {
      expect(banned in payload.properties).toBe(false)
      expect(banned in targetChanges).toBe(false)
    }
  })

  test('extractTransferableProperties filters keys based on source node type', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]?.id ?? ''

    const frameNode = editor.graph.createNode('FRAME', page, {
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
      opacity: 0.9
    })
    const framePayload = extractTransferableProperties(frameNode)
    expect(framePayload.properties.layoutMode).toBe('HORIZONTAL')
    expect(framePayload.properties.itemSpacing).toBe(12)
    expect(framePayload.properties.opacity).toBe(0.9)
    expect(framePayload.properties.fontSize).toBeUndefined()

    const textNode = editor.graph.createNode('TEXT', page, {
      fontSize: 24,
      fontFamily: 'Inter',
      lineHeight: 32,
      layoutMode: 'HORIZONTAL' as const
    })
    const textPayload = extractTransferableProperties(textNode)
    expect(textPayload.properties.fontSize).toBe(24)
    expect(textPayload.properties.fontFamily).toBe('Inter')
    expect(textPayload.properties.layoutMode).toBeUndefined()

    const rectNode = editor.graph.createNode('RECTANGLE', page, {
      cornerRadius: 8,
      opacity: 0.5,
      fontSize: 16
    })
    const rectPayload = extractTransferableProperties(rectNode)
    expect(rectPayload.properties.cornerRadius).toBe(8)
    expect(rectPayload.properties.opacity).toBe(0.5)
    expect(rectPayload.properties.fontSize).toBeUndefined()
    expect(rectPayload.properties.layoutMode).toBeUndefined()
  })

  test('applicablePropertiesFor enforces group gating between container, text and shapes', () => {
    const solidFill: Fill = {
      type: 'SOLID',
      color: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
      visible: true,
      opacity: 1
    }

    const payload: CopiedProperties = {
      sourceType: 'FRAME',
      properties: {
        fills: [solidFill],
        opacity: 0.75,
        cornerRadius: 16,
        layoutMode: 'VERTICAL',
        itemSpacing: 24,
        paddingTop: 10,
        fontSize: 32,
        fontFamily: 'Roboto'
      }
    }

    // FRAME -> FRAME: transfers paints, corners, and layout, but not text
    const frameToFrame = applicablePropertiesFor('FRAME', 'FRAME', payload)
    expect(frameToFrame.fills).toHaveLength(1)
    expect(frameToFrame.opacity).toBe(0.75)
    expect(frameToFrame.cornerRadius).toBe(16)
    expect(frameToFrame.layoutMode).toBe('VERTICAL')
    expect(frameToFrame.itemSpacing).toBe(24)
    expect(frameToFrame.paddingTop).toBe(10)
    expect(frameToFrame.fontSize).toBeUndefined()

    // FRAME -> RECTANGLE: transfers paints & corners, skips layout & text
    const frameToRect = applicablePropertiesFor('FRAME', 'RECTANGLE', payload)
    expect(frameToRect.fills).toHaveLength(1)
    expect(frameToRect.opacity).toBe(0.75)
    expect(frameToRect.cornerRadius).toBe(16)
    expect(frameToRect.layoutMode).toBeUndefined()
    expect(frameToRect.itemSpacing).toBeUndefined()
    expect(frameToRect.fontSize).toBeUndefined()

    // TEXT -> TEXT: transfers typography, paints, corners
    const textPayload: CopiedProperties = {
      sourceType: 'TEXT',
      properties: {
        fills: [solidFill],
        fontSize: 28,
        fontFamily: 'Geist',
        letterSpacing: 2,
        layoutMode: 'HORIZONTAL'
      }
    }
    const textToText = applicablePropertiesFor('TEXT', 'TEXT', textPayload)
    expect(textToText.fills).toHaveLength(1)
    expect(textToText.fontSize).toBe(28)
    expect(textToText.fontFamily).toBe('Geist')
    expect(textToText.letterSpacing).toBe(2)
    expect(textToText.layoutMode).toBeUndefined()

    // TEXT -> RECTANGLE: transfers paints, skips typography
    const textToRect = applicablePropertiesFor('TEXT', 'RECTANGLE', textPayload)
    expect(textToRect.fills).toHaveLength(1)
    expect(textToRect.fontSize).toBeUndefined()
    expect(textToRect.fontFamily).toBeUndefined()
  })

  test('deep-cloning ensures no shared object or array references', () => {
    const fill: Fill = {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      visible: true,
      opacity: 1
    }
    const stroke: Stroke = {
      type: 'SOLID',
      color: { r: 0, g: 1, b: 0, a: 1 },
      visible: true,
      opacity: 1,
      dashPattern: [4, 4]
    }
    const effect: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
      visible: true
    }

    const editor = createEditor()
    const page = editor.graph.getPages()[0]?.id ?? ''
    const sourceNode = editor.graph.createNode('FRAME', page, {
      fills: [fill],
      strokes: [stroke],
      effects: [effect],
      dashPattern: [2, 2],
      gridTemplateColumns: [{ sizing: 'FIXED', value: 100 }],
      gridTemplateRows: [{ sizing: 'FR', value: 1 }]
    })

    const payload = extractTransferableProperties(sourceNode)
    const targetChanges1 = applicablePropertiesFor('FRAME', 'FRAME', payload)
    const targetChanges2 = applicablePropertiesFor('FRAME', 'FRAME', payload)

    expect(targetChanges1.fills).not.toBe(payload.properties.fills)
    expect(targetChanges1.strokes).not.toBe(targetChanges2.strokes)
    expect(targetChanges1.effects).not.toBe(targetChanges2.effects)
    expect(targetChanges1.gridTemplateColumns).not.toBe(payload.properties.gridTemplateColumns)

    const firstFill1 = targetChanges1.fills?.[0]
    const firstFillPayload = payload.properties.fills?.[0]
    const firstFill2 = targetChanges2.fills?.[0]

    expect(firstFill1).toBeDefined()
    expect(firstFillPayload).toBeDefined()
    expect(firstFill2).toBeDefined()

    if (firstFill1 && firstFillPayload && firstFill2) {
      expect(firstFill1).not.toBe(firstFillPayload)
      expect(firstFill1.color).not.toBe(firstFillPayload.color)

      firstFill1.color.r = 0.99
      expect(firstFillPayload.color.r).toBe(1)
      expect(firstFill2.color.r).toBe(1)
    }
  })

  test('clipboard module: copySelectionProperties and pastePropertiesToSelection lifecycle', () => {
    const store = createEditorStore()
    const page = store.graph.getPages()[0]?.id ?? ''

    // Empty selection returns false
    expect(copySelectionProperties(store)).toBe(false)
    expect(hasCopiedProperties.value).toBe(false)

    // Select source node and copy
    const sourceNode = store.graph.createNode('RECTANGLE', page, {
      name: 'SourceRect',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 }, visible: true, opacity: 1 }],
      cornerRadius: 12,
      opacity: 0.85
    })
    store.select([sourceNode.id])

    expect(copySelectionProperties(store)).toBe(true)
    expect(hasCopiedProperties.value).toBe(true)
    expect(copiedProperties.value?.sourceType).toBe('RECTANGLE')
    expect(copiedProperties.value?.properties.cornerRadius).toBe(12)

    // Target nodes
    const target1 = store.graph.createNode('RECTANGLE', page, {
      name: 'Target1',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      cornerRadius: 0,
      opacity: 1
    })
    const target2 = store.graph.createNode('RECTANGLE', page, {
      name: 'Target2',
      x: 150,
      y: 20,
      width: 120,
      height: 120,
      cornerRadius: 0,
      opacity: 1
    })
    const lockedTarget = store.graph.createNode('RECTANGLE', page, {
      name: 'LockedTarget',
      cornerRadius: 0,
      locked: true
    })

    store.select([target1.id, target2.id, lockedTarget.id])

    // Paste properties onto selection
    const pasteResult = pastePropertiesToSelection(store)
    expect(pasteResult).toBe(true)

    // Verify targets updated
    const updated1 = store.graph.getNode(target1.id)
    const updated2 = store.graph.getNode(target2.id)
    const updatedLocked = store.graph.getNode(lockedTarget.id)

    expect(updated1.cornerRadius).toBe(12)
    expect(updated1.opacity).toBe(0.85)
    expect(updated1.x).toBe(10)
    expect(updated1.y).toBe(20)
    expect(updated1.width).toBe(100)
    expect(updated1.height).toBe(100)
    expect(updated1.name).toBe('Target1')

    expect(updated2.cornerRadius).toBe(12)
    expect(updated2.opacity).toBe(0.85)
    expect(updated2.name).toBe('Target2')

    // Locked target skipped
    expect(updatedLocked.cornerRadius).toBe(0)

    // Undo should revert all targets in a SINGLE undo transaction
    expect(store.undo.canUndo).toBe(true)
    store.undo.undo()

    const reverted1 = store.graph.getNode(target1.id)
    const reverted2 = store.graph.getNode(target2.id)

    expect(reverted1.cornerRadius).toBe(0)
    expect(reverted1.opacity).toBe(1)
    expect(reverted2.cornerRadius).toBe(0)
    expect(reverted2.opacity).toBe(1)
  })

  test('clipboard carries image bytes and merges into destination graph', () => {
    const store = createEditorStore()
    const page = store.graph.getPages()[0]?.id ?? ''

    const imageHash = 'hash-abc-123'
    const imageBytes = new Uint8Array([1, 2, 3, 4, 5])
    store.graph.images.set(imageHash, imageBytes)

    const sourceNode = store.graph.createNode('RECTANGLE', page, {
      fills: [{ type: 'IMAGE', imageHash, visible: true, opacity: 1 }]
    })
    store.select([sourceNode.id])

    expect(copySelectionProperties(store)).toBe(true)
    expect(copiedProperties.value?.images?.get(imageHash)).toEqual(imageBytes)

    // Create a second editor store instance with empty images map
    const secondStore = createEditorStore()
    const secondPage = secondStore.graph.getPages()[0]?.id ?? ''
    const targetNode = secondStore.graph.createNode('RECTANGLE', secondPage, {
      fills: []
    })

    expect(secondStore.graph.images.has(imageHash)).toBe(false)

    secondStore.select([targetNode.id])
    expect(pastePropertiesToSelection(secondStore)).toBe(true)

    // Verify image bytes were transferred into the second editor's graph
    expect(secondStore.graph.images.has(imageHash)).toBe(true)
    expect(secondStore.graph.getNode(targetNode.id).fills?.[0]?.type).toBe('IMAGE')
    expect(secondStore.graph.getNode(targetNode.id).fills?.[0]?.imageHash).toBe(imageHash)
  })
})
