import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { effectScope, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import { useCanvasInput } from '#vue/canvas/useCanvasInput'

const originalWindow = globalThis.window
const originalDocument = globalThis.document

function setupGlobals() {
  const listeners = new Map<string, Array<(event: unknown) => void>>()
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = listeners.get(type) ?? []
      listeners.set(
        type,
        list.filter((l) => l !== listener)
      )
    },
    dispatchEvent: () => true
  } as Window & typeof globalThis

  globalThis.document = {
    createElement: () => ({})
  } as Document
}

function restoreGlobals() {
  if (originalWindow) {
    globalThis.window = originalWindow
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
  if (originalDocument) {
    globalThis.document = originalDocument
  } else {
    Reflect.deleteProperty(globalThis, 'document')
  }
}

function createMockCanvas(): {
  canvas: HTMLCanvasElement
  capturedPointerIds: Set<number>
  listeners: Map<string, Array<(event: unknown) => void>>
} {
  const capturedPointerIds = new Set<number>()
  const listeners = new Map<string, Array<(event: unknown) => void>>()

  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }),
    focus: () => undefined,
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      const list = listeners.get(type) ?? []
      listeners.set(
        type,
        list.filter((l) => l !== listener)
      )
    },
    setPointerCapture: (pointerId: number) => {
      capturedPointerIds.add(pointerId)
    },
    releasePointerCapture: (pointerId: number) => {
      capturedPointerIds.delete(pointerId)
    },
    hasPointerCapture: (pointerId: number) => capturedPointerIds.has(pointerId)
  } as HTMLCanvasElement

  return { canvas, capturedPointerIds, listeners }
}

describe('useCanvasInput pen and touch pointer capture', () => {
  beforeAll(setupGlobals)
  afterAll(restoreGlobals)

  test('captures pointer on pointerdown for stylus/pen events with button 0', () => {
    const scope = effectScope()
    scope.run(() => {
      const editor = createEditor()
      const { canvas, capturedPointerIds, listeners } = createMockCanvas()
      const canvasRef = ref<HTMLCanvasElement | null>(canvas)

      useCanvasInput(
        canvasRef,
        editor,
        () => null,
        () => null,
        () => null
      )

      const pointerdownHandler = listeners.get('pointerdown')?.[0]
      expect(pointerdownHandler).toBeDefined()

      // Pen pointerdown with primary button
      pointerdownHandler?.({
        pointerId: 42,
        pointerType: 'pen',
        button: 0,
        clientX: 100,
        clientY: 100
      })
      expect(capturedPointerIds.has(42)).toBe(true)

      // Secondary button should not capture
      pointerdownHandler?.({
        pointerId: 43,
        pointerType: 'pen',
        button: 2,
        clientX: 100,
        clientY: 100
      })
      expect(capturedPointerIds.has(43)).toBe(false)
    })
    scope.stop()
  })

  test('releases pointer on pointerup and completes drag for pen events', () => {
    const scope = effectScope()
    scope.run(() => {
      const editor = createEditor()
      const { canvas, capturedPointerIds, listeners } = createMockCanvas()
      const canvasRef = ref<HTMLCanvasElement | null>(canvas)

      const { drag } = useCanvasInput(
        canvasRef,
        editor,
        () => null,
        () => null,
        () => null
      )

      const pointerdownHandler = listeners.get('pointerdown')?.[0]
      const pointerupHandler = listeners.get('pointerup')?.[0]

      // Set up a pointerdown with pen
      pointerdownHandler?.({
        pointerId: 101,
        pointerType: 'pen',
        button: 0,
        clientX: 50,
        clientY: 50
      })
      expect(capturedPointerIds.has(101)).toBe(true)

      // Set a mock drag
      drag.value = {
        type: 'pan',
        startScreenX: 50,
        startScreenY: 50,
        startPanX: 0,
        startPanY: 0
      }

      // Pointer up releases capture and ends drag
      pointerupHandler?.({
        pointerId: 101,
        pointerType: 'pen',
        button: 0,
        clientX: 80,
        clientY: 80
      })
      expect(capturedPointerIds.has(101)).toBe(false)
      expect(drag.value).toBeNull()
    })
    scope.stop()
  })

  test('cancels pointer interaction on pointercancel for pen events', () => {
    const scope = effectScope()
    scope.run(() => {
      const editor = createEditor()
      const { canvas, capturedPointerIds, listeners } = createMockCanvas()
      const canvasRef = ref<HTMLCanvasElement | null>(canvas)

      const { drag } = useCanvasInput(
        canvasRef,
        editor,
        () => null,
        () => null,
        () => null
      )

      const pointerdownHandler = listeners.get('pointerdown')?.[0]
      const pointercancelHandler = listeners.get('pointercancel')?.[0]

      pointerdownHandler?.({
        pointerId: 202,
        pointerType: 'pen',
        button: 0,
        clientX: 100,
        clientY: 100
      })
      expect(capturedPointerIds.has(202)).toBe(true)

      drag.value = {
        type: 'pan',
        startScreenX: 100,
        startScreenY: 100,
        startPanX: 0,
        startPanY: 0
      }

      pointercancelHandler?.({
        pointerId: 202,
        pointerType: 'pen',
        button: 0,
        clientX: 100,
        clientY: 100
      })
      expect(capturedPointerIds.has(202)).toBe(false)
      expect(drag.value).toBeNull()
    })
    scope.stop()
  })

  test('captures and releases touch pointer events identically', () => {
    const scope = effectScope()
    scope.run(() => {
      const editor = createEditor()
      const { canvas, capturedPointerIds, listeners } = createMockCanvas()
      const canvasRef = ref<HTMLCanvasElement | null>(canvas)

      useCanvasInput(
        canvasRef,
        editor,
        () => null,
        () => null,
        () => null
      )

      const pointerdownHandler = listeners.get('pointerdown')?.[0]
      const pointerupHandler = listeners.get('pointerup')?.[0]

      pointerdownHandler?.({
        pointerId: 303,
        pointerType: 'touch',
        button: 0,
        clientX: 200,
        clientY: 200
      })
      expect(capturedPointerIds.has(303)).toBe(true)

      pointerupHandler?.({
        pointerId: 303,
        pointerType: 'touch',
        button: 0,
        clientX: 200,
        clientY: 200
      })
      expect(capturedPointerIds.has(303)).toBe(false)
    })
    scope.stop()
  })
})
