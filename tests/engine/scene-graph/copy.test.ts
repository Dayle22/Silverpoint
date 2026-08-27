import { describe, test, expect } from 'bun:test'

import type { Effect, Fill, GeometryPath, Stroke, StyleRun } from '@open-pencil/scene-graph'
import {
  copyFill,
  copyFills,
  copyStroke,
  copyEffect,
  copyStyleRun,
  copyGeometryPaths,
  scaleGeometryPaths
} from '@open-pencil/scene-graph/copy'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

describe('copy helpers — mutation isolation', () => {
  test('copyFill: mutating copy does not affect original', () => {
    const original: Fill = {
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const copy = copyFill(original)
    copy.color.r = 0
    copy.opacity = 0.5
    expect(original.color.r).toBe(1)
    expect(original.opacity).toBe(1)
  })

  test('copyFill: gradient stops are deep copied', () => {
    const original: Fill = {
      type: 'GRADIENT_LINEAR',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
    const copy = copyFill(original)
    expectDefined(copy.gradientStops?.[0], 'copied gradient stop').color.r = 0
    expectDefined(copy.gradientTransform, 'copied gradient transform').m00 = 99
    expect(expectDefined(original.gradientStops?.[0], 'original gradient stop').color.r).toBe(1)
    expect(expectDefined(original.gradientTransform, 'original gradient transform').m00).toBe(1)
  })

  test('copyStroke: dash pattern is independent', () => {
    const original: Stroke = {
      color: { r: 0, g: 0, b: 0, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'CENTER',
      dashPattern: [5, 3]
    }
    const copy = copyStroke(original)
    expectDefined(copy.dashPattern, 'copied dash pattern').push(99)
    copy.color.g = 1
    expect(original.dashPattern).toEqual([5, 3])
    expect(original.color.g).toBe(0)
  })

  test('copyStroke: gradient stops and transform are deep copied', () => {
    const original: Stroke = {
      type: 'GRADIENT_LINEAR',
      color: { r: 0, g: 0, b: 0, a: 1 },
      weight: 2,
      opacity: 1,
      visible: true,
      align: 'CENTER',
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 1, b: 0, a: 1 }, position: 1 }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
    const copy = copyStroke(original)
    expectDefined(copy.gradientStops?.[0], 'copied gradient stop').color.r = 0
    expectDefined(copy.gradientTransform, 'copied gradient transform').m00 = 99
    expect(expectDefined(original.gradientStops?.[0], 'original gradient stop').color.r).toBe(1)
    expect(expectDefined(original.gradientTransform, 'original gradient transform').m00).toBe(1)
  })

  test('copyEffect: offset and color are independent', () => {
    const original: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 4, y: 4 },
      radius: 8,
      spread: 0,
      visible: true
    }
    const copy = copyEffect(original)
    copy.offset.x = 100
    copy.color.a = 1
    expect(original.offset.x).toBe(4)
    expect(original.color.a).toBe(0.5)
  })

  test('cloneTree and updateNode retain isolated gradient and effect model data', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = graph.createNode('RECTANGLE', page.id, {
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
            { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
          ]
        }
      ],
      effects: [
        {
          type: 'FOREGROUND_BLUR',
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 12,
          spread: 0,
          visible: true,
          blurType: 'PROGRESSIVE',
          startRadius: 2,
          startOffset: { x: 0.5, y: 0 },
          endOffset: { x: 0.5, y: 1 }
        },
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
      ]
    })
    const clone = graph.cloneTree(source.id, page.id)
    if (!clone) throw new Error('expected cloneTree to return a node')

    expectDefined(clone.fills[0].gradientStops?.[0], 'clone gradient stop').position = 0.5
    expectDefined(clone.effects[0].startOffset, 'clone progressive blur start').x = 0
    expectDefined(clone.effects[0].endOffset, 'clone progressive blur end').y = 0.5
    clone.effects[1].brightness = 30

    expect(expectDefined(source.fills[0].gradientStops?.[0], 'source gradient stop').position).toBe(0)
    expect(expectDefined(source.effects[0].startOffset, 'source progressive blur start').x).toBe(0.5)
    expect(expectDefined(source.effects[0].endOffset, 'source progressive blur end').y).toBe(1)
    expect(source.effects[1].brightness).toBe(10)

    const updates: Array<Partial<typeof source>> = []
    graph.onNodeEvents({
      updated: (id, changes) => {
        if (id === source.id) updates.push(changes)
      }
    })
    graph.updateNode(source.id, { fills: clone.fills, effects: clone.effects })

    expect(updates).toHaveLength(1)
    expect(updates[0]?.fills).toBe(clone.fills)
    expect(updates[0]?.effects).toBe(clone.effects)
    expect(graph.getNode(source.id)?.fills[0].gradientStops?.[0]?.position).toBe(0.5)
    expect(graph.getNode(source.id)?.effects[0].blurType).toBe('PROGRESSIVE')
    expect(graph.getNode(source.id)?.effects[1].contrast).toBe(20)
  })

  test('copyStyleRun: style object is independent', () => {
    const original: StyleRun = {
      start: 0,
      length: 5,
      style: { fontWeight: 700, fontSize: 24 }
    }
    const copy = copyStyleRun(original)
    copy.style.fontWeight = 400
    expect(original.style.fontWeight).toBe(700)
  })

  test('copyGeometryPaths: blobs and path fills are independent', () => {
    const original: GeometryPath[] = [
      {
        windingRule: 'NONZERO',
        commandsBlob: new Uint8Array([1, 2, 3]),
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      }
    ]
    const copy = copyGeometryPaths(original)
    copy[0].commandsBlob[0] = 99
    if (copy[0].fills?.[0]) copy[0].fills[0].color.r = 0
    expect(original[0].commandsBlob[0]).toBe(1)
    expect(original[0].fills?.[0]?.color.r).toBe(1)
  })

  test('copyGeometryPaths and scaleGeometryPaths keep path-level fills', () => {
    // Resize snapshots use these helpers; dropping fills collapses multi-color
    // vectors to a single node fill (gray blob).
    const orange: Fill = {
      type: 'SOLID',
      color: { r: 1, g: 0.32, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const original: GeometryPath[] = [
      {
        windingRule: 'NONZERO',
        commandsBlob: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0]),
        fills: [orange]
      },
      { windingRule: 'EVENODD', commandsBlob: new Uint8Array([2, 3, 4]) }
    ]

    const copied = copyGeometryPaths(original)
    expect(copied[0]?.fills?.[0]?.color.r).toBeCloseTo(1, 2)
    expect(copied[1]?.fills).toBeUndefined()
    expectDefined(copied[0]?.fills?.[0], 'copied path fill').color.r = 0
    expect(original[0]?.fills?.[0]?.color.r).toBe(1)

    const scaled = scaleGeometryPaths(original, 0.5, 0.5)
    expect(scaled[0]?.fills?.[0]?.color.g).toBeCloseTo(0.32, 2)
    expect(scaled[0]?.commandsBlob).not.toBe(original[0]?.commandsBlob)
  })

  test('copyFills: array independence', () => {
    const originals: Fill[] = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true },
      { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0.5, visible: true }
    ]
    const copies = copyFills(originals)
    copies.push({ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true })
    copies[0].color.r = 0
    expect(originals).toHaveLength(2)
    expect(originals[0].color.r).toBe(1)
  })
})
