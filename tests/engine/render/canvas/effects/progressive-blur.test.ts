import { describe, expect, mock, test } from 'bun:test'

import { resolveProgressiveBlurEdit } from '@open-pencil/core/canvas/overlays'
import { getCachedProgressiveBlur } from '@open-pencil/core/canvas/effects'
import { createEditor } from '@open-pencil/core/editor'
import { renderNode } from '@open-pencil/core/canvas/scene'
import {
  effectOverflow,
  isDegenerateProgressiveAxis,
  progressiveBlurAxis,
  resolveProgressiveBlur,
  type Effect
} from '@open-pencil/scene-graph'

import {
  handleProgressiveBlurMove,
  hitTestProgressiveBlurHandle,
  tryStartProgressiveBlurDrag
} from '#vue/shared/input/progressive-blur'
import { makeSceneGraph } from '#tests/helpers/scene'
import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

describe('Progressive Layer Blur (F-003)', () => {
  describe('effectOverflow', () => {
    test('widens overflow when startRadius > radius', () => {
      const effects: Effect[] = [
        {
          type: 'LAYER_BLUR',
          visible: true,
          blurType: 'PROGRESSIVE',
          radius: 10,
          startRadius: 40,
          spread: 0,
          offset: { x: 0, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 0 }
        }
      ]
      const overflow = effectOverflow(effects)
      expect(overflow.left).toBe(40)
      expect(overflow.right).toBe(40)
      expect(overflow.top).toBe(40)
      expect(overflow.bottom).toBe(40)
    })

    test('uses radius when radius > startRadius', () => {
      const effects: Effect[] = [
        {
          type: 'LAYER_BLUR',
          visible: true,
          blurType: 'PROGRESSIVE',
          radius: 50,
          startRadius: 10,
          spread: 0,
          offset: { x: 0, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 0 }
        }
      ]
      const overflow = effectOverflow(effects)
      expect(overflow.left).toBe(50)
      expect(overflow.right).toBe(50)
    })
  })

  describe('getCachedProgressiveBlur', () => {
    test('falls back to uniform blur when startRadius === endRadius', () => {
      const r = createMockRenderer()
      r.imageFilterCache = new Map()
      const effect: Effect = {
        type: 'LAYER_BLUR',
        visible: true,
        blurType: 'PROGRESSIVE',
        radius: 20,
        startRadius: 20,
        startOffset: { x: 0, y: 0 },
        endOffset: { x: 1, y: 1 },
        offset: { x: 0, y: 0 },
        spread: 0,
        color: { r: 0, g: 0, b: 0, a: 0 }
      }
      const ramp = resolveProgressiveBlur(effect)
      const axis = progressiveBlurAxis(ramp, 100, 100)

      getCachedProgressiveBlur(r, ramp, axis)
      expect(r.getCachedBlur).toHaveBeenCalledWith(10)
    })

    test('falls back to uniform blur when axis is degenerate', () => {
      const r = createMockRenderer()
      r.imageFilterCache = new Map()
      const effect: Effect = {
        type: 'LAYER_BLUR',
        visible: true,
        blurType: 'PROGRESSIVE',
        radius: 30,
        startRadius: 0,
        startOffset: { x: 0.5, y: 0.5 },
        endOffset: { x: 0.5, y: 0.5 },
        offset: { x: 0, y: 0 },
        spread: 0,
        color: { r: 0, g: 0, b: 0, a: 0 }
      }
      const ramp = resolveProgressiveBlur(effect)
      const axis = progressiveBlurAxis(ramp, 100, 100)
      expect(isDegenerateProgressiveAxis(axis)).toBe(true)

      getCachedProgressiveBlur(r, ramp, axis)
      expect(r.getCachedBlur).toHaveBeenCalledWith(15)
    })

    test('builds and caches progressive blur filter for valid ramp', () => {
      const r = createMockRenderer()
      r.imageFilterCache = new Map()
      const makeLinearGradient = r.ck.Shader.MakeLinearGradient
      const makeShader = r.ck.ImageFilter.MakeShader
      const makeBlend = r.ck.ImageFilter.MakeBlend

      const effect: Effect = {
        type: 'LAYER_BLUR',
        visible: true,
        blurType: 'PROGRESSIVE',
        radius: 40,
        startRadius: 0,
        startOffset: { x: 0, y: 0 },
        endOffset: { x: 0, y: 1 },
        offset: { x: 0, y: 0 },
        spread: 0,
        color: { r: 0, g: 0, b: 0, a: 0 }
      }
      const ramp = resolveProgressiveBlur(effect)
      const axis = progressiveBlurAxis(ramp, 100, 100)

      const filter1 = getCachedProgressiveBlur(r, ramp, axis)
      expect(filter1).toBeDefined()
      expect(makeLinearGradient).toHaveBeenCalled()
      expect(makeShader).toHaveBeenCalled()
      expect(makeBlend).toHaveBeenCalled()

      // Calling again returns cached filter without re-creating shaders
      const callCount = mockCalls(makeLinearGradient).length
      const filter2 = getCachedProgressiveBlur(r, ramp, axis)
      expect(filter2).toBe(filter1)
      expect(mockCalls(makeLinearGradient).length).toBe(callCount)
    })
  })

  describe('renderNode with progressive blur', () => {
    test('renders progressive blur with padded saveLayer', () => {
      const base = createMockRenderer()
      const progFilter = base.ck.ImageFilter.MakeBlur(10, 10, base.ck.TileMode.Clamp, null)
      const r = createMockRenderer({
        getCachedProgressiveBlur: mock(() => progFilter)
      })
      const canvas = createMockCanvas()
      const graph = makeSceneGraph()
      const pageId = graph.getPages()[0].id
      graph.createNode('RECTANGLE', pageId, {
        id: 'n1',
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        effects: [
          {
            type: 'LAYER_BLUR',
            visible: true,
            blurType: 'PROGRESSIVE',
            radius: 20,
            startRadius: 40,
            startOffset: { x: 0, y: 0 },
            endOffset: { x: 1, y: 1 },
            offset: { x: 0, y: 0 },
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      })
      renderNode(r, canvas, graph, 'n1', {})
      expect(r.getCachedProgressiveBlur).toHaveBeenCalled()
      expect(r.effectLayerPaint.setImageFilter).toHaveBeenCalledWith(progFilter as never)
      // blur padding uses max(radius, startRadius) * 2 = 40 * 2 = 80
      expect(r.ck.LTRBRect).toHaveBeenCalledWith(-80, -80, 180, 180)
      expect(canvas.saveLayer).toHaveBeenCalled()
    })
  })

  describe('resolveProgressiveBlurEdit', () => {
    test('returns null when selectedIds size is not 1', () => {
      const graph = makeSceneGraph()

      expect(resolveProgressiveBlurEdit(graph, new Set())).toBeNull()
      expect(resolveProgressiveBlurEdit(graph, new Set(['a', 'b']))).toBeNull()
    })

    test('returns explicit edit when valid on sole selected node', () => {
      const graph = makeSceneGraph()
      const pageId = graph.getPages()[0].id
      graph.createNode('RECTANGLE', pageId, {
        id: 'n1',
        visible: true,
        locked: false,
        effects: [
          {
            type: 'DROP_SHADOW',
            visible: true,
            offset: { x: 0, y: 4 },
            radius: 4,
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0.25 }
          },
          {
            type: 'LAYER_BLUR',
            visible: true,
            blurType: 'PROGRESSIVE',
            radius: 20,
            startRadius: 0,
            offset: { x: 0, y: 0 },
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      })

      const resolved = resolveProgressiveBlurEdit(graph, new Set(['n1']), { nodeId: 'n1', effectIndex: 1 })
      expect(resolved).not.toBeNull()
      expect(resolved?.effectIndex).toBe(1)
      expect(resolved?.effect.blurType).toBe('PROGRESSIVE')
    })

    test('falls back to first visible progressive blur when explicit edit belongs to another node', () => {
      const graph = makeSceneGraph()
      const pageId = graph.getPages()[0].id
      graph.createNode('RECTANGLE', pageId, {
        id: 'n2',
        visible: true,
        locked: false,
        effects: [
          {
            type: 'LAYER_BLUR',
            visible: true,
            blurType: 'PROGRESSIVE',
            radius: 15,
            startRadius: 0,
            offset: { x: 0, y: 0 },
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      })

      // Explicit edit references stale 'n1', but selection is 'n2'
      const resolved = resolveProgressiveBlurEdit(graph, new Set(['n2']), { nodeId: 'n1', effectIndex: 0 })
      expect(resolved).not.toBeNull()
      expect(resolved?.node.id).toBe('n2')
      expect(resolved?.effectIndex).toBe(0)
    })
  })

  describe('Canvas input hit-testing and dragging', () => {
    test('hit-tests start and end handles and drags offset', () => {
      const graph = makeSceneGraph()
      const pageId = graph.getPages()[0].id
      graph.createNode('RECTANGLE', pageId, {
        id: 'n1',
        visible: true,
        locked: false,
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        effects: [
          {
            type: 'LAYER_BLUR',
            visible: true,
            blurType: 'PROGRESSIVE',
            radius: 20,
            startRadius: 0,
            startOffset: { x: 0.5, y: 0 },
            endOffset: { x: 0.5, y: 1 },
            offset: { x: 0, y: 0 },
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0 }
          }
        ]
      })

      const editor = createEditor({ graph })
      editor.select(['n1'])
      editor.state.progressiveBlurEdit = { nodeId: 'n1', effectIndex: 0 }

      // Start handle is at local (100, 0) -> world (200, 100)
      const hitStart = hitTestProgressiveBlurHandle(200, 100, editor)
      expect(hitStart).not.toBeNull()
      expect(hitStart?.handle).toBe('start')

      // End handle is at local (100, 200) -> world (200, 300)
      const hitEnd = hitTestProgressiveBlurHandle(200, 300, editor)
      expect(hitEnd).not.toBeNull()
      expect(hitEnd?.handle).toBe('end')

      // Drag start handle to world (100, 100) -> local (0, 0) -> normalised (0, 0)
      const drag = tryStartProgressiveBlurDrag(200, 100, editor)
      expect(drag).not.toBeNull()
      if (drag) {
        handleProgressiveBlurMove(drag, 100, 100, editor)
        const updated = graph.getNode('n1')
        expect(updated?.effects[0].startOffset).toEqual({ x: 0, y: 0 })
      }
    })
  })
})
