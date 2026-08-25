import { describe, expect, test, spyOn } from 'bun:test'

import { computeEffectiveDpi } from '@open-pencil/core'
import { computeImageHash, SceneGraph } from '@open-pencil/scene-graph'
import * as coordinate from '@open-pencil/scene-graph/coordinate'

function createPng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(33)
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  buf[8] = 0
  buf[9] = 0
  buf[10] = 0
  buf[11] = 13
  buf.set([0x49, 0x48, 0x44, 0x52], 12)
  buf[16] = (width >>> 24) & 0xff
  buf[17] = (width >>> 16) & 0xff
  buf[18] = (width >>> 8) & 0xff
  buf[19] = width & 0xff
  buf[20] = (height >>> 24) & 0xff
  buf[21] = (height >>> 16) & 0xff
  buf[22] = (height >>> 8) & 0xff
  buf[23] = height & 0xff
  buf[24] = 8
  buf[25] = 6
  buf[26] = 0
  buf[27] = 0
  buf[28] = 0
  return buf
}

describe('computeEffectiveDpi', () => {
  test('1000x1000 source in 500x500 FILL node at 300 document DPI -> 600 DPI', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 1000)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Rect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    expect(result.x).toBe(600)
    expect(result.y).toBe(600)
    expect(result.min).toBe(600)
    expect(result.sourceWidth).toBe(1000)
    expect(result.sourceHeight).toBe(1000)
    expect(result.scaleMode).toBe('FILL')
    expect(result.belowThreshold).toBe(false)
  })

  test('the same node at 2x parent scale -> 300 DPI', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 1000)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Rect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const spy = spyOn(coordinate, 'getWorldMatrix').mockReturnValue([
      2, 0, 0,
      0, 2, 0,
      0, 0, 1
    ])

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    spy.mockRestore()

    expect(result.x).toBe(300)
    expect(result.y).toBe(300)
    expect(result.min).toBe(300)
    expect(result.belowThreshold).toBe(false)
  })

  test('a rotated node -> identical DPI to the unrotated case', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 1000)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const unrotated = graph.createNode('RECTANGLE', page.id, {
      name: 'Unrotated',
      width: 500,
      height: 500,
      rotation: 0,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const rotated = graph.createNode('RECTANGLE', page.id, {
      name: 'Rotated',
      width: 500,
      height: 500,
      rotation: 45,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const unrotatedResult = computeEffectiveDpi(graph, unrotated.id, 0, 300, 300)
    const rotatedResult = computeEffectiveDpi(graph, rotated.id, 0, 300, 300)

    expect(rotatedResult.x).toBe(unrotatedResult.x)
    expect(rotatedResult.y).toBe(unrotatedResult.y)
    expect(rotatedResult.min).toBe(unrotatedResult.min)
    expect(rotatedResult.belowThreshold).toBe(unrotatedResult.belowThreshold)
  })

  test('FIT with a non-matching aspect ratio', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 500)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'FitRect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FIT'
        }
      ]
    })

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    expect(result.x).toBe(600)
    expect(result.y).toBe(600)
    expect(result.min).toBe(600)
    expect(result.scaleMode).toBe('FIT')
  })

  test('CROP with an imageTransform', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 1000)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'CropRect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'CROP',
          imageTransform: {
            m00: 2,
            m01: 0,
            m02: 0,
            m10: 0,
            m11: 2,
            m12: 0
          }
        }
      ]
    })

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    expect(result.x).toBe(300)
    expect(result.y).toBe(300)
    expect(result.min).toBe(300)
    expect(result.scaleMode).toBe('CROP')
  })

  test('anisotropic parent scale producing different X and Y', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(1000, 1000)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Rect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const spy = spyOn(coordinate, 'getWorldMatrix').mockReturnValue([
      1, 0, 0,
      0, 2, 0,
      0, 0, 1
    ])

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    spy.mockRestore()

    expect(result.x).toBe(600)
    expect(result.y).toBe(300)
    expect(result.min).toBe(300)
  })

  test('unknown source -> all null, belowThreshold: false', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const garbageBytes = new Uint8Array([1, 2, 3])
    const hash = computeImageHash(garbageBytes)
    graph.images.set(hash, garbageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'UnknownImg',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    const result = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    expect(result.x).toBeNull()
    expect(result.y).toBeNull()
    expect(result.min).toBeNull()
    expect(result.sourceWidth).toBeNull()
    expect(result.sourceHeight).toBeNull()
    expect(result.belowThreshold).toBe(false)
  })

  test('threshold boundary exactly at 300 -> not below', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = createPng(500, 500)
    const hash = computeImageHash(imageBytes)
    graph.images.set(hash, imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'BoundaryRect',
      width: 500,
      height: 500,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    // At 500x500 in 500x500 at 300 DPI, effective DPI is exactly 300
    const at300 = computeEffectiveDpi(graph, node.id, 0, 300, 300)
    expect(at300.min).toBe(300)
    expect(at300.belowThreshold).toBe(false)

    // With threshold 301, 300 < 301 is true -> below threshold
    const at301 = computeEffectiveDpi(graph, node.id, 0, 300, 301)
    expect(at301.min).toBe(300)
    expect(at301.belowThreshold).toBe(true)
  })
})
