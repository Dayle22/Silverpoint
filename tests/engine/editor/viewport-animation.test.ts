import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { createEditor, shouldAnimate } from '@open-pencil/core/editor'

describe('viewport animation', () => {
  const originalRaf = globalThis.requestAnimationFrame
  const originalCaf = globalThis.cancelAnimationFrame

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
    Reflect.deleteProperty(globalThis, 'window')
  })

  function setupEditor(viewportSize = { width: 800, height: 600 }) {
    const editor = createEditor({
      getViewportSize: () => viewportSize
    })
    const pageId = editor.graph.getPages()[0].id
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Rect',
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    return { editor, pageId, rect }
  }

  describe('synchronous behaviour in headless environment (no rAF)', () => {
    beforeEach(() => {
      Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
      Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
      Reflect.deleteProperty(globalThis, 'window')
    })

    test('zoomToFit executes synchronously and emits viewport:changed once', () => {
      const { editor } = setupEditor()
      const events: Array<{ next: { panX: number; panY: number; zoom: number }; previous: { panX: number; panY: number; zoom: number } }> = []
      editor.onEditorEvent('viewport:changed', (next, previous) => {
        events.push({ next: { ...next }, previous: { ...previous } })
      })

      const initialPanX = editor.state.panX
      const initialPanY = editor.state.panY
      const initialZoom = editor.state.zoom

      editor.zoomToFit()

      expect(events.length).toBe(1)
      expect(events[0].previous).toEqual({ panX: initialPanX, panY: initialPanY, zoom: initialZoom })
      expect(events[0].next).toEqual({
        panX: editor.state.panX,
        panY: editor.state.panY,
        zoom: editor.state.zoom
      })
      expect(editor.state.zoom).toBe(1)
      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(100)
    })

    test('zoomToSelection executes synchronously', () => {
      const { editor, rect } = setupEditor()
      editor.select([rect.id])

      editor.zoomToSelection()

      expect(editor.state.zoom).toBe(1)
      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(100)
    })

    test('zoomTo100 executes synchronously', () => {
      const { editor } = setupEditor()
      editor.state.zoom = 2
      editor.state.panX = 100
      editor.state.panY = 100

      editor.zoomTo100()

      expect(editor.state.zoom).toBe(1)
      expect(editor.state.panX).toBe(250)
      expect(editor.state.panY).toBe(200)
    })

    test('zoomToLevel executes synchronously', () => {
      const { editor } = setupEditor()

      editor.zoomToLevel(2)

      expect(editor.state.zoom).toBe(2)
      expect(editor.state.panX).toBe(0)
      expect(editor.state.panY).toBe(0)
    })

    test('zoomToBounds executes synchronously', () => {
      const { editor } = setupEditor()

      editor.zoomToBounds(0, 0, 400, 300)

      expect(editor.state.zoom).toBe(1)
      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(150)
    })
  })

  describe('animated behaviour with requestAnimationFrame pump', () => {
    let rAFCallbacks: Array<{ id: number; fn: (ts: number) => void }> = []
    let nextRafId = 1
    let currentTime = 0

    beforeEach(() => {
      rAFCallbacks = []
      nextRafId = 1
      currentTime = 0

      globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        const id = nextRafId++
        rAFCallbacks.push({ id, fn: cb as (ts: number) => void })
        return id
      }) as typeof requestAnimationFrame

      globalThis.cancelAnimationFrame = ((id: number) => {
        rAFCallbacks = rAFCallbacks.filter((item) => item.id !== id)
      }) as typeof cancelAnimationFrame

      Object.assign(globalThis, {
        window: {
          matchMedia: () => ({ matches: false })
        }
      })
    })

    function advanceTime(ms: number) {
      currentTime += ms
      const callbacks = [...rAFCallbacks]
      rAFCallbacks = []
      for (const cb of callbacks) {
        cb.fn(currentTime)
      }
    }

    test('glides smoothly and finishes on exact target with single viewport:changed event', () => {
      const { editor } = setupEditor()
      const events: Array<{ next: { panX: number; panY: number; zoom: number }; previous: { panX: number; panY: number; zoom: number } }> = []
      editor.onEditorEvent('viewport:changed', (next, previous) => {
        events.push({ next: { ...next }, previous: { ...previous } })
      })

      const initialPanX = editor.state.panX
      const initialPanY = editor.state.panY
      const initialZoom = editor.state.zoom

      editor.zoomToFit()

      // Immediately after call: state has not jumped yet, rAF scheduled
      expect(rAFCallbacks.length).toBe(1)
      expect(events.length).toBe(0)

      // Initial frame at 0ms: captures start time
      advanceTime(0)
      expect(events.length).toBe(0)
      expect(rAFCallbacks.length).toBe(1)

      // Frame 1 at 50ms elapsed
      advanceTime(50)
      expect(events.length).toBe(0)
      const p1X = editor.state.panX
      const p1Y = editor.state.panY
      expect(p1X).toBeGreaterThan(initialPanX)
      expect(p1Y).toBeGreaterThan(initialPanY)

      // Frame 2 at 150ms elapsed
      advanceTime(100)
      expect(events.length).toBe(0)
      expect(editor.state.panX).toBeGreaterThan(p1X)
      expect(editor.state.panY).toBeGreaterThan(p1Y)

      // Final frame at 260ms elapsed (total currentTime = 260)
      advanceTime(110)
      expect(events.length).toBe(1)
      expect(events[0].previous).toEqual({ panX: initialPanX, panY: initialPanY, zoom: initialZoom })
      expect(events[0].next).toEqual({ panX: 200, panY: 100, zoom: 1 })
      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(100)
      expect(editor.state.zoom).toBe(1)
      expect(rAFCallbacks.length).toBe(0)
    })

    test('pan mid-flight stops animation and preserves current position', () => {
      const { editor } = setupEditor()
      const events: Array<{ next: { panX: number; panY: number; zoom: number }; previous: { panX: number; panY: number; zoom: number } }> = []
      editor.onEditorEvent('viewport:changed', (next, previous) => {
        events.push({ next: { ...next }, previous: { ...previous } })
      })

      editor.zoomToFit()
      advanceTime(0)
      advanceTime(100)

      const midPanX = editor.state.panX
      const midPanY = editor.state.panY

      expect(midPanX).toBeGreaterThan(0)
      expect(events.length).toBe(0)

      // Interrupted by pan
      editor.pan(15, 25)

      // Animation cancelled, so cancel emits the reached position, and pan emits the panned position
      expect(events.length).toBe(2)
      expect(events[0].next).toEqual({ panX: midPanX, panY: midPanY, zoom: editor.state.zoom })
      expect(events[1].next).toEqual({ panX: midPanX + 15, panY: midPanY + 25, zoom: editor.state.zoom })

      // Advancing further does not continue previous glide
      advanceTime(200)
      expect(editor.state.panX).toBe(midPanX + 15)
      expect(editor.state.panY).toBe(midPanY + 25)
      expect(rAFCallbacks.length).toBe(0)
    })

    test('second animateTo mid-flight retargets from current position without snapping back', () => {
      const { editor } = setupEditor()
      editor.zoomToFit()
      advanceTime(0)
      advanceTime(100)

      const midZoom = editor.state.zoom
      const midPanX = editor.state.panX
      const midPanY = editor.state.panY

      // Retarget to zoomToLevel(2)
      editor.zoomToLevel(2)

      // Position does not snap back to initial (0, 0, 1)
      expect(editor.state.zoom).toBe(midZoom)
      expect(editor.state.panX).toBe(midPanX)
      expect(editor.state.panY).toBe(midPanY)

      // Let new animation initialize and finish
      advanceTime(0)
      advanceTime(260)
      expect(editor.state.zoom).toBe(2)
      expect(rAFCallbacks.length).toBe(0)
    })

    test('settleViewportAnimation immediately snaps to target and finishes', () => {
      const { editor } = setupEditor()
      const events: Array<{ next: { panX: number; panY: number; zoom: number }; previous: { panX: number; panY: number; zoom: number } }> = []
      editor.onEditorEvent('viewport:changed', (next, previous) => {
        events.push({ next: { ...next }, previous: { ...previous } })
      })

      const initial = { panX: editor.state.panX, panY: editor.state.panY, zoom: editor.state.zoom }
      editor.zoomToFit()
      advanceTime(0)
      advanceTime(50)

      expect(events.length).toBe(0)

      editor.settleViewportAnimation()

      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(100)
      expect(editor.state.zoom).toBe(1)
      expect(events.length).toBe(1)
      expect(events[0].previous).toEqual(initial)
      expect(events[0].next).toEqual({ panX: 200, panY: 100, zoom: 1 })
      expect(rAFCallbacks.length).toBe(0)
    })

    test('switchPage cancels in-flight camera animation', () => {
      const { editor } = setupEditor()
      const page2Id = editor.addPage('Page 2')
      editor.switchPage(editor.graph.getPages()[0].id)

      editor.zoomToFit()
      advanceTime(0)
      advanceTime(50)

      editor.switchPage(page2Id)

      expect(rAFCallbacks.length).toBe(0)
      expect(editor.state.currentPageId).toBe(page2Id)
    })

    test('explicit animate: false option performs synchronous jump', () => {
      const { editor } = setupEditor()
      const events: Array<{ next: { panX: number; panY: number; zoom: number }; previous: { panX: number; panY: number; zoom: number } }> = []
      editor.onEditorEvent('viewport:changed', (next, previous) => {
        events.push({ next: { ...next }, previous: { ...previous } })
      })

      editor.zoomToFit({ animate: false })

      expect(rAFCallbacks.length).toBe(0)
      expect(events.length).toBe(1)
      expect(editor.state.panX).toBe(200)
      expect(editor.state.panY).toBe(100)
      expect(editor.state.zoom).toBe(1)
    })
  })

  describe('shouldAnimate decision logic', () => {
    beforeEach(() => {
      globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame
      Object.assign(globalThis, {
        window: {
          matchMedia: () => ({ matches: false })
        }
      })
    })

    test('refuses when animate: false', () => {
      expect(
        shouldAnimate(
          { panX: 0, panY: 0, zoom: 1 },
          { panX: 100, panY: 100, zoom: 2 },
          { animate: false }
        )
      ).toBe(false)
    })

    test('refuses under prefers-reduced-motion: reduce', () => {
      Object.assign(globalThis, {
        window: {
          matchMedia: (query: string) => ({
            matches: query.includes('prefers-reduced-motion: reduce')
          })
        }
      })

      expect(
        shouldAnimate(
          { panX: 0, panY: 0, zoom: 1 },
          { panX: 100, panY: 100, zoom: 2 }
        )
      ).toBe(false)
    })

    test('refuses sub-pixel / negligible moves', () => {
      // Zoom delta < 0.5% and both pan deltas < 1px
      expect(
        shouldAnimate(
          { panX: 100, panY: 200, zoom: 1 },
          { panX: 100.4, panY: 200.3, zoom: 1.002 }
        )
      ).toBe(false)
    })

    test('allows move when pan delta >= 1px', () => {
      expect(
        shouldAnimate(
          { panX: 100, panY: 200, zoom: 1 },
          { panX: 102, panY: 200, zoom: 1 }
        )
      ).toBe(true)
    })

    test('allows move when zoom ratio delta >= 0.5%', () => {
      expect(
        shouldAnimate(
          { panX: 100, panY: 200, zoom: 1 },
          { panX: 100, panY: 200, zoom: 1.01 }
        )
      ).toBe(true)
    })
  })
})
