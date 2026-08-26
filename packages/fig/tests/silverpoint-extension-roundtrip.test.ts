import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Effect, type Fill, type PluginDataEntry } from '@open-pencil/scene-graph'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { nodeChangeToProps, sceneNodeToKiwi } from '../src/node-change'

function exportAndRestore({
  fills = [],
  effects = [],
  pluginData = []
}: {
  fills?: Fill[]
  effects?: Effect[]
  pluginData?: PluginDataEntry[]
}) {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    fills,
    effects,
    pluginData
  })
  const [change] = sceneNodeToKiwi(
    node,
    { sessionID: 1, localID: 1 },
    0,
    { value: 2 },
    graph,
    []
  )
  return { change, props: nodeChangeToProps(change, []) }
}

describe('Silverpoint FIG extension round trips', () => {
  test('exports curved gradients through a linear carrier and restores the spine', () => {
    const curved: Fill = {
      type: 'GRADIENT_CURVED',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 0.75,
      visible: true,
      blendMode: 'MULTIPLY',
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      gradientSpine: [
        { t: 0, offset: 0.2 },
        { t: 0.5, offset: -0.1 },
        { t: 1, offset: 0.3 }
      ]
    }

    const solid: Fill = {
      type: 'SOLID',
      color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL'
    }
    const { change, props } = exportAndRestore({ fills: [solid, curved] })

    expect(change.fillPaints?.map((fill) => fill.type)).toEqual(['SOLID', 'GRADIENT_LINEAR'])
    const payload = change.pluginData?.find(
      (entry) => entry.pluginID === 'open-pencil' && entry.key === 'curvedGradientFillsV1'
    )
    expect(payload).toBeDefined()
    expect(JSON.parse(payload?.value ?? '')).toEqual({
      version: 1,
      byIndex: { 1: curved.gradientSpine }
    })
    expect(props.fills).toEqual([solid, curved])
  })

  test('preserves custom effect order and progressive blur fields outside Kiwi effects', () => {
    const effects: Effect[] = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.4 },
        offset: { x: 2, y: 3 },
        radius: 4,
        spread: 1,
        visible: true,
        blendMode: 'MULTIPLY'
      },
      {
        type: 'BRIGHTNESS_CONTRAST',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: false,
        brightness: 24,
        contrast: -18
      },
      {
        type: 'NOISE',
        color: { r: 0.1, g: 0.2, b: 0.3, a: 0.6 },
        offset: { x: 0, y: 0 },
        radius: 2.5,
        spread: 0,
        visible: true,
        blendMode: 'SOFT_LIGHT'
      },
      {
        type: 'SATURATION',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        saturation: 125
      },
      {
        type: 'LAYER_BLUR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 12,
        spread: 0,
        visible: true,
        blurType: 'PROGRESSIVE',
        startRadius: 2,
        startOffset: { x: 0, y: 0.25 },
        endOffset: { x: 1, y: 0.75 }
      },
      {
        type: 'CURVES',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        gamma: 1.4
      }
    ]

    const { change, props } = exportAndRestore({ effects })

    expect(change.effects?.map((effect) => effect.type)).toEqual([
      'DROP_SHADOW',
      'FOREGROUND_BLUR'
    ])
    expect(change.pluginData).toContainEqual(
      expect.objectContaining({ pluginID: 'open-pencil', key: 'adjustmentEffectStackV1' })
    )
    expect(props.effects?.map((effect) => effect.type)).toEqual([
      'DROP_SHADOW',
      'BRIGHTNESS_CONTRAST',
      'NOISE',
      'SATURATION',
      'FOREGROUND_BLUR',
      'CURVES'
    ])
    expect(props.effects?.[1]).toMatchObject({ visible: false, brightness: 24, contrast: -18 })
    expect(props.effects?.[2]).toMatchObject({
      radius: 2.5,
      color: { r: 0.1, g: 0.2, b: 0.3, a: 0.6 },
      blendMode: 'SOFT_LIGHT'
    })
    expect(props.effects?.[3]).toMatchObject({ saturation: 125 })
    expect(props.effects?.[4]).toMatchObject({
      blurType: 'PROGRESSIVE',
      startRadius: 2,
      startOffset: { x: 0, y: 0.25 },
      endOffset: { x: 1, y: 0.75 }
    })
    expect(props.effects?.[5]).toMatchObject({ gamma: 1.4 })
  })

  test('clamps adjustment payload values and preserves unrelated plugin data', () => {
    const effects: Effect[] = [
      {
        type: 'BRIGHTNESS_CONTRAST',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        brightness: 500,
        contrast: -500
      },
      {
        type: 'SATURATION',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        saturation: 900
      },
      {
        type: 'CURVES',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 0,
        visible: true,
        gamma: 0
      }
    ]
    const unrelated = [
      { pluginId: 'third-party', key: 'keep-me', value: 'yes' },
      { pluginId: 'open-pencil', key: 'also-keep-me', value: 'yes' }
    ]

    const { change, props } = exportAndRestore({ effects, pluginData: unrelated })

    for (const entry of unrelated) {
      expect(change.pluginData).toContainEqual({
        pluginID: entry.pluginId,
        key: entry.key,
        value: entry.value
      })
    }
    expect(props.effects).toMatchObject([
      { brightness: 100, contrast: -100 },
      { saturation: 200 },
      { gamma: 0.1 }
    ])
  })

  test('fails closed when an effect-stack payload is malformed', () => {
    const nativeEffect = {
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 1 },
      offset: { x: 1, y: 2 },
      radius: 3,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL' as const
    }
    const malformedStacks = [
      [{ kind: 'native', index: 0 }, { kind: 'native', index: 0 }],
      [{ kind: 'native', index: 4 }],
      [{ kind: 'unknown' }],
      [{ kind: 'noise', visible: true, radius: -1, color: { r: 0, g: 0, b: 0, a: 1 } }]
    ]

    for (const stack of malformedStacks) {
      const props = nodeChangeToProps(
        {
          type: 'RECTANGLE',
          effects: [nativeEffect],
          pluginData: [
            {
              pluginID: 'open-pencil',
              key: 'adjustmentEffectStackV1',
              value: JSON.stringify({ version: 1, stack })
            }
          ]
        } as NodeChange,
        []
      )
      expect(props.effects).toEqual([
        { ...nativeEffect, showShadowBehindNode: true }
      ])
    }
  })

  test('ignores invalid curved-gradient entries and non-linear carriers', () => {
    const linearCarrier = {
      type: 'GRADIENT_LINEAR' as const,
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const solidCarrier = { ...linearCarrier, type: 'SOLID' as const }
    const pluginData = (byIndex: Record<string, unknown>) => [
      {
        pluginID: 'open-pencil',
        key: 'curvedGradientFillsV1',
        value: JSON.stringify({ version: 1, byIndex })
      }
    ]

    expect(
      nodeChangeToProps(
        {
          type: 'RECTANGLE',
          fillPaints: [linearCarrier],
          pluginData: pluginData({ 0: [{ t: 'bad', offset: 0 }] })
        } as NodeChange,
        []
      ).fills?.[0]?.type
    ).toBe('GRADIENT_LINEAR')
    expect(
      nodeChangeToProps(
        {
          type: 'RECTANGLE',
          fillPaints: [solidCarrier],
          pluginData: pluginData({ 0: [{ t: 0, offset: 0 }] })
        } as NodeChange,
        []
      ).fills?.[0]?.type
    ).toBe('SOLID')
  })

  test('leaves raw unsupported Figma effects and existing extension data untouched', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      effects: [
        {
          type: 'BRIGHTNESS_CONTRAST',
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 0,
          spread: 0,
          visible: true,
          brightness: 10,
          contrast: 20
        }
      ],
      pluginData: [
        {
          pluginId: 'open-pencil',
          key: 'adjustmentEffectStackV1',
          value: 'preserve-existing-value'
        }
      ]
    })
    node.source.fig.rawNodeFields.effects = [
      { type: 'VARIABLE_BLUR', radius: 8, visible: true }
    ]

    const [change] = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )

    expect((change as unknown as { effects: unknown[] }).effects).toEqual([
      { type: 'VARIABLE_BLUR', radius: 8, visible: true }
    ])
    expect(change.pluginData).toContainEqual({
      pluginID: 'open-pencil',
      key: 'adjustmentEffectStackV1',
      value: 'preserve-existing-value'
    })
  })
})
