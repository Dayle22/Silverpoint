import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { GUID } from '@open-pencil/scene-graph/primitives'

import {
  buildComponentPropIndex,
  fractionalPosition,
  mapToFigmaType,
  sceneNodeToKiwi,
  type FigNodeChangeExportRuntime,
  type KiwiNodeChange
} from '../src/node-change'

interface TestComponentPropDef {
  id?: GUID
  name?: string
  initialValue?: { guidValue?: GUID }
  preferredValues?: { instanceSwapValues?: Array<{ type: string; key: string }> }
}

interface TestComponentPropRef {
  defID?: GUID
}

interface TestSymbolOverride {
  guidPath?: { guids?: GUID[] }
  textData?: { characters?: string }
  visible?: boolean
  opacity?: number
  fillPaints?: unknown[]
}

interface TestSymbolData {
  symbolID?: GUID
  symbolOverrides?: TestSymbolOverride[]
}

interface TestExportNodeChange extends Omit<KiwiNodeChange, 'symbolData'> {
  symbolData?: TestSymbolData
  componentPropDefs?: TestComponentPropDef[]
  componentPropRefs?: TestComponentPropRef[]
  componentPropAssignments?: unknown
}

function asExportNodeChange(change: KiwiNodeChange): TestExportNodeChange {
  return change as TestExportNodeChange
}

describe('@open-pencil/fig SceneGraph export policy', () => {
  test('maps node types and sibling positions deterministically', () => {
    expect(mapToFigmaType('COMPONENT')).toBe('SYMBOL')
    expect([0, 93, 94, 188].map(fractionalPosition)).toEqual(['!', '~', '~!', '~~!'])
  })

  test('reuses an export-scoped component property definition index', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: '1:100', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
      ]
    })
    const instance = graph.createNode('INSTANCE', page.id, {
      componentId: component.id,
      componentPropertyAssignments: { '1:100': 'Override' }
    })
    const serialize = (definitions?: ReturnType<typeof buildComponentPropIndex>) =>
      asExportNodeChange(
        sceneNodeToKiwi(
          instance,
          { sessionID: 1, localID: 1 },
          0,
          { value: 2 },
          graph,
          [],
          new Map(),
          undefined,
          undefined,
          undefined,
          undefined,
          new Set(),
          undefined,
          definitions
        )[0]
      ).componentPropAssignments

    const definitions = buildComponentPropIndex(graph)
    expect(definitions.get('1:100')).toBe(component.componentPropertyDefinitions[0])
    expect(serialize(definitions)).toEqual(serialize())
  })

  test('merges edited text into an existing override path', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    const sourceText = graph.createNode('TEXT', component.id, {
      overrideKey: '2:20',
      text: 'Default'
    })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('instance expected')
    const targetText = graph.getChildren(instance.id)[0]
    expect(targetText).toBeDefined()
    const originalOverride: TestSymbolOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
      textData: { characters: 'Stale' },
      opacity: 0.5
    }
    const currentFig = instance.source.fig ?? { symbolOverrides: [] }
    graph.updateNode(instance.id, {
      overrides: { [`${targetText?.id}:text`]: 'Edited' },
      source: {
        ...instance.source,
        fig: {
          ...currentFig,
          symbolOverrides: [originalOverride]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect(sourceText.overrideKey).toBe('2:20')
    const exported = asExportNodeChange(change)
    expect(exported.symbolData?.symbolOverrides).toEqual([
      {
        ...originalOverride,
        textData: { characters: 'Edited' }
      }
    ])
  })

  test('injects runtime glyph outlines into derived text data', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'A',
      width: 20,
      height: 20,
      fontSize: 16
    })
    const blobs: Uint8Array[] = []
    const runtime: FigNodeChangeExportRuntime = {
      getGlyphOutlineMetrics: () => [
        {
          commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 8, y: 16 }, { type: 'Z' }],
          x: 0,
          advance: 10
        }
      ]
    }

    const [change] = sceneNodeToKiwi(
      text,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      blobs,
      undefined,
      new Map([['Inter|Regular', new Uint8Array([1, 2, 3])]]),
      undefined,
      new Map(),
      undefined,
      undefined,
      runtime
    )

    expect(change.derivedTextData?.glyphs).toHaveLength(1)
    expect(blobs).toHaveLength(1)
  })

  test('mints a synthetic GUID for app-created (non-Figma-shaped) component property IDs', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const componentSet = graph.createNode('COMPONENT_SET', page.id, {
      componentPropertyDefinitions: [
        {
          id: 'prop:abc12345',
          name: 'Style',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        }
      ]
    })

    const [change] = sceneNodeToKiwi(
      componentSet,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const defs = asExportNodeChange(change).componentPropDefs
    expect(defs).toHaveLength(1)
    expect(defs?.[0].id).toEqual(
      expect.objectContaining({ sessionID: expect.any(Number), localID: expect.any(Number) })
    )
    expect(defs?.[0].name).toBe('Style')
  })

  test('reuses the same synthetic GUID for a def and the ref that points at it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:icon1234', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '' }
      ]
    })
    const slot = graph.createNode('INSTANCE', component.id, {
      componentPropertyReferences: [{ propertyId: 'prop:icon1234', field: 'INSTANCE_SWAP' }]
    })

    const nodeIdToGuid = new Map<string, GUID>()
    const propertyIdToGuid = new Map<string, GUID>()
    const localIdCounter = { value: 2 }
    const [componentChange] = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )
    if (!componentChange.guid) throw new Error('guid expected')
    const slotChange = sceneNodeToKiwi(
      slot,
      componentChange.guid,
      0,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )[0]

    const compDefs = asExportNodeChange(componentChange).componentPropDefs
    const slotRefs = asExportNodeChange(slotChange).componentPropRefs
    expect(compDefs?.[0].id).toEqual(slotRefs?.[0].defID)
  })

  test('points an INSTANCE_SWAP default value at the same GUID the target component is exported with', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/Tune',
      componentKey: 'icon-tune-key'
    })
    const button = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:iconswap1', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: icon.id }
      ]
    })

    const nodeIdToGuid = new Map<string, GUID>()
    const propertyIdToGuid = new Map<string, GUID>()
    const localIdCounter = { value: 2 }
    const [iconChange] = sceneNodeToKiwi(
      icon,
      { sessionID: 1, localID: 1 },
      0,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )
    const [buttonChange] = sceneNodeToKiwi(
      button,
      { sessionID: 1, localID: 1 },
      1,
      localIdCounter,
      graph,
      [],
      nodeIdToGuid,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      propertyIdToGuid
    )

    const btnDefs = asExportNodeChange(buttonChange).componentPropDefs
    expect(btnDefs?.[0].initialValue).toEqual({ guidValue: iconChange.guid })
    expect(btnDefs?.[0].preferredValues).toBeUndefined()
  })

  test('exports INSTANCE_SWAP preferred values as component keys', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, {
      name: 'Icon/Tune',
      componentKey: 'icon-tune-key'
    })
    const button = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        {
          id: 'prop:iconswap2',
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          defaultValue: icon.id,
          preferredValues: [icon.id, 'external-library-key']
        }
      ]
    })

    const [buttonChange] = sceneNodeToKiwi(
      button,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const btnDefs = asExportNodeChange(buttonChange).componentPropDefs
    expect(btnDefs?.[0].preferredValues?.instanceSwapValues).toEqual([
      { type: 'COMPONENT', key: 'icon-tune-key' },
      { type: 'COMPONENT', key: 'external-library-key' }
    ])
  })

  test('preserves unresolved GUID-shaped INSTANCE_SWAP values as GUIDs', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:iconswap3', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '70:1' }
      ]
    })

    const [change] = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const compDefs = asExportNodeChange(change).componentPropDefs
    expect(compDefs?.[0].initialValue).toEqual({
      guidValue: { sessionID: 70, localID: 1 }
    })
  })

  test('shares synthetic property GUIDs across recursive serialization without a supplied map', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      componentPropertyDefinitions: [
        { id: 'prop:recursive', name: 'Label', type: 'TEXT', defaultValue: 'Default' }
      ]
    })
    graph.createNode('TEXT', component.id, {
      componentPropertyReferences: [{ propertyId: 'prop:recursive', field: 'TEXT' }]
    })

    const changes = sceneNodeToKiwi(
      component,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const compDefs = asExportNodeChange(changes[0]).componentPropDefs
    const compRefs = asExportNodeChange(changes[1]).componentPropRefs
    expect(compDefs?.[0].id).toEqual(compRefs?.[0].defID)
  })

  test('merges an edited text override without losing sibling raw overrides', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id)
    const textNode1 = graph.createNode('TEXT', component.id, {
      overrideKey: '2:20',
      text: 'Original Title'
    })
    graph.createNode('TEXT', component.id, {
      overrideKey: '2:21',
      text: 'Original Subtitle'
    })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('instance expected')
    const children = graph.getChildren(instance.id)
    const targetText1 = children.find((c) => c.componentId === textNode1.id)
    expect(targetText1).toBeDefined()

    const siblingOverride: TestSymbolOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 21 }] },
      textData: { characters: 'Untouched Subtitle' },
      visible: true
    }
    const rawSiblingNodeOverride: TestSymbolOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 30 }] },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }]
    }
    const initialText1Override: TestSymbolOverride = {
      guidPath: { guids: [{ sessionID: 2, localID: 20 }] },
      textData: { characters: 'Stale Title' },
      opacity: 0.8
    }

    const currentFig = instance.source.fig ?? { symbolOverrides: [] }
    graph.updateNode(instance.id, {
      overrides: { [`${targetText1?.id}:text`]: 'Updated Title' },
      source: {
        ...instance.source,
        fig: {
          ...currentFig,
          symbolOverrides: [siblingOverride, rawSiblingNodeOverride, initialText1Override]
        }
      }
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    const symbolData = asExportNodeChange(change).symbolData
    expect(symbolData?.symbolOverrides).toHaveLength(3)
    expect(symbolData?.symbolOverrides).toContainEqual(siblingOverride)
    expect(symbolData?.symbolOverrides).toContainEqual(rawSiblingNodeOverride)
    expect(symbolData?.symbolOverrides).toContainEqual({
      ...initialText1Override,
      textData: { characters: 'Updated Title' }
    })
  })

  test('preserves d1a extension metadata on export without emitting unsupported typed Kiwi values', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      fills: [
        {
          type: 'GRADIENT_CURVED',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL',
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          gradientSpine: [{ t: 0, offset: 0.1 }, { t: 1, offset: 0.5 }]
        }
      ],
      effects: [
        {
          type: 'NOISE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 1,
          spread: 0,
          visible: true
        },
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    const [change] = sceneNodeToKiwi(
      rect,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    // Kiwi paints and effects should only contain standard supported types
    expect(change.fillPaints?.every((paint) => (paint.type as string) !== 'GRADIENT_CURVED')).toBe(true)
    expect(change.fillPaints?.[0]?.type).toBe('GRADIENT_LINEAR')
    expect(change.effects?.every((eff) => (eff.type as string) !== 'NOISE')).toBe(true)
    expect(change.effects?.[0]?.type).toBe('DROP_SHADOW')

    // Extension metadata survives via pluginData
    const curvedPlugin = change.pluginData?.find((p) => p.key === 'curvedGradientFillsV1')
    expect(curvedPlugin).toBeDefined()
    const effectPlugin = change.pluginData?.find((p) => p.key === 'adjustmentEffectStackV1')
    expect(effectPlugin).toBeDefined()
  })
})
