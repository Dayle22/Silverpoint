/* oxlint-disable eslint/no-empty-function, open-pencil/no-broad-double-cast */
import { describe, expect, it } from 'bun:test'
import {
  createFrameGuardState,
  DEFAULT_FRAME_GUARD_POLICY,
  describeRenderHealth,
  noteFrameFailure,
  noteFrameSuccess,
  shouldSkipFrame,
  type FrameGuardPolicy
} from '#core/canvas/renderer/frame-guard'
import { getRenderHealth, render, resetRenderHealth } from '#core/canvas/renderer/pipeline'
import type { SkiaRenderer } from '#core/canvas/renderer'
import type { SceneGraph } from '@open-pencil/scene-graph'

describe('Frame Guard Unit Tests', () => {
  it('1. initializes with healthy state, zero failures, and zero cooldown', () => {
    const state = createFrameGuardState()
    expect(state.health).toBe('healthy')
    expect(state.consecutiveFailures).toBe(0)
    expect(state.totalFailures).toBe(0)
    expect(state.lastError).toBeNull()
    expect(state.lastErrorAt).toBeNull()
    expect(state.cooldownFrames).toBe(0)
    expect(shouldSkipFrame(state)).toBe(false)
  })

  it('2. handles first failure: stays healthy, sets backoff cooldown and error message', () => {
    const state = createFrameGuardState()
    const error = new Error('WASM heap allocation failure')
    const health = noteFrameFailure(state, error)

    expect(health).toBe('healthy')
    expect(state.health).toBe('healthy')
    expect(state.consecutiveFailures).toBe(1)
    expect(state.totalFailures).toBe(1)
    expect(state.cooldownFrames).toBe(2) // 2 ** 1 = 2
    expect(state.lastError).toBe('WASM heap allocation failure')
    expect(state.lastErrorAt).toBeGreaterThan(0)
  })

  it('3. skips frames according to backoff cooldown counter and decrements', () => {
    const state = createFrameGuardState()
    noteFrameFailure(state, new Error('Frame error'))
    expect(state.cooldownFrames).toBe(2)

    // First frame skip: 2 -> 1
    expect(shouldSkipFrame(state)).toBe(true)
    expect(state.cooldownFrames).toBe(1)

    // Second frame skip: 1 -> 0
    expect(shouldSkipFrame(state)).toBe(true)
    expect(state.cooldownFrames).toBe(0)

    // Third frame: cooldown is 0, do not skip
    expect(shouldSkipFrame(state)).toBe(false)
    expect(state.cooldownFrames).toBe(0)
  })

  it('4. escalates to degraded after degradeAfter (default 2) consecutive failures', () => {
    const state = createFrameGuardState()
    noteFrameFailure(state, new Error('Error 1'))
    expect(state.health).toBe('healthy')

    const health = noteFrameFailure(state, new Error('Error 2'))
    expect(health).toBe('degraded')
    expect(state.health).toBe('degraded')
    expect(state.consecutiveFailures).toBe(2)
    expect(state.totalFailures).toBe(2)
    expect(state.cooldownFrames).toBe(4) // 2 ** 2 = 4
  })

  it('5. escalates to disabled after disableAfter (default 10) consecutive failures and caps cooldown', () => {
    const state = createFrameGuardState()
    for (let i = 1; i <= 9; i++) {
      noteFrameFailure(state, new Error(`Error ${i}`))
      expect(state.health).toBe(i < 2 ? 'healthy' : 'degraded')
    }
    expect(state.health).toBe('degraded')

    // 10th failure -> disabled
    const health = noteFrameFailure(state, new Error('Fatal error 10'))
    expect(health).toBe('disabled')
    expect(state.health).toBe('disabled')
    expect(state.consecutiveFailures).toBe(10)
    expect(state.totalFailures).toBe(10)
    // Capped at maxCooldownFrames (default 60)
    expect(state.cooldownFrames).toBe(DEFAULT_FRAME_GUARD_POLICY.maxCooldownFrames)
  })

  it('6. respects custom policy thresholds', () => {
    const customPolicy: FrameGuardPolicy = {
      degradeAfter: 3,
      disableAfter: 5,
      maxCooldownFrames: 16
    }
    const state = createFrameGuardState()

    noteFrameFailure(state, 'err1', customPolicy)
    expect(state.health).toBe('healthy')
    noteFrameFailure(state, 'err2', customPolicy)
    expect(state.health).toBe('healthy')
    noteFrameFailure(state, 'err3', customPolicy)
    expect(state.health).toBe('degraded')
    noteFrameFailure(state, 'err4', customPolicy)
    expect(state.health).toBe('degraded')
    noteFrameFailure(state, 'err5', customPolicy)
    expect(state.health).toBe('disabled')
    expect(state.cooldownFrames).toBe(16) // min(2**5=32, 16) = 16
  })

  it('7. single success recovers healthy state and clears backoff', () => {
    const state = createFrameGuardState()
    // Fail 3 times into degraded
    noteFrameFailure(state, new Error('Err 1'))
    noteFrameFailure(state, new Error('Err 2'))
    noteFrameFailure(state, new Error('Err 3'))
    expect(state.health).toBe('degraded')
    expect(state.consecutiveFailures).toBe(3)
    expect(state.cooldownFrames).toBe(8)

    // Note success
    noteFrameSuccess(state)
    expect(state.health).toBe('healthy')
    expect(state.consecutiveFailures).toBe(0)
    expect(state.cooldownFrames).toBe(0)
    expect(state.totalFailures).toBe(3) // Lifetime count preserved
  })

  it('8. tolerates non-Error throw values (strings, numbers, objects, null, undefined)', () => {
    const state = createFrameGuardState()

    noteFrameFailure(state, 'string exception')
    expect(state.lastError).toBe('string exception')

    noteFrameFailure(state, 404)
    expect(state.lastError).toBe('404')

    noteFrameFailure(state, null)
    expect(state.lastError).toBe('null')

    noteFrameFailure(state, undefined)
    expect(state.lastError).toBe('undefined')

    noteFrameFailure(state, { reason: 'wasm panic' })
    expect(state.lastError).toBe('[object Object]')
  })

  it('9. describeRenderHealth outputs clean operator summary without stack trace', () => {
    const state = createFrameGuardState()
    expect(describeRenderHealth(state)).toContain('Health: healthy')

    noteFrameFailure(state, new Error('Sample error without trace'))
    const summary = describeRenderHealth(state)
    expect(summary).toContain('Health: healthy')
    expect(summary).toContain('consecutive failures: 1')
    expect(summary).toContain('total failures: 1')
    expect(summary).toContain('last error: Sample error without trace')
    expect(summary).not.toContain('at ')
  })
})

describe('Pipeline Render Error Boundary Integration', () => {
  function createMockRenderer(shouldThrow = false) {
    let clearCallCount = 0
    const mockCanvas = {
      clear: () => {
        clearCallCount++
      },
      save: () => {},
      scale: () => {},
      translate: () => {},
      restore: () => {},
      drawPicture: () => {}
    }

    const mockSurface = {
      getCanvas: () => {
        if (shouldThrow) {
          throw new Error('Surface getCanvas failed')
        }
        return mockCanvas
      },
      flush: () => {}
    }

    const mockProfiler = {
      beginFrame: () => {},
      setScenePictureDrawTime: () => {},
      setScenePictureRecordTime: () => {},
      setFlushTime: () => {},
      beginPhase: () => {},
      endPhase: () => {},
      setScenePictureMode: () => {},
      setNodeCounts: () => {},
      endFrame: () => {},
      drawHUD: () => {}
    }

    const mockRenderer = {
      syncFontGeneration: () => {},
      profiler: mockProfiler,
      surface: mockSurface,
      ck: {
        Color4f: () => ({})
      },
      pageColor: { r: 1, g: 1, b: 1 },
      panX: 0,
      panY: 0,
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
      worldViewport: { x: 0, y: 0, w: 800, h: 600 },
      dpr: 1,
      _nodeCount: 0,
      _culledCount: 0,
      scenePicture: null,
      scenePictureVersion: -1,
      scenePictureFontGeneration: -1,
      scenePicturePositionPreviewVersion: -1,
      scenePicturePageId: null,
      sceneBacking: null,
      sceneBackingBuild: null,
      subtreePictureCache: { clear: () => {}, delete: () => {} },
      nodePictureCache: { clear: () => {}, delete: () => {} },
      nodePictureCacheGenerations: { clear: () => {}, delete: () => {} },
      labelCache: { update: () => {} },
      renderNode: () => {},
      drawSectionTitles: () => {},
      drawComponentLabels: () => {},
      drawHoverHighlight: () => {},
      drawEnteredContainer: () => {},
      drawSelection: () => {},
      drawProgressiveBlurHandles: () => {},
      drawGradientOverlay: () => {},
      drawMeasurements: () => {},
      drawFlashes: () => {},
      drawSnapGuides: () => {},
      drawMarquee: () => {},
      drawLayoutInsertIndicator: () => {},
      drawAutoLayoutHover: () => {},
      drawNodeEditOverlay: () => {},
      drawPenOverlay: () => {},
      drawRemoteCursors: () => {},
      drawPixelGrid: () => {},
      drawCanvasGrid: () => {},
      drawRulers: () => {}
    } as unknown as SkiaRenderer

    return { mockRenderer, getClearCount: () => clearCallCount, setThrow: (val: boolean) => { shouldThrow = val } }
  }

  const mockGraph = {
    clearAbsPosCache: () => {},
    positionPreviewVersion: 0,
    getNode: () => null,
    rootId: 'root'
  } as unknown as SceneGraph

  it('10. render does not throw and recovers across failure ladder', () => {
    const { mockRenderer, getClearCount, setThrow } = createMockRenderer(true)

    // Initial state is healthy
    expect(getRenderHealth(mockRenderer)).toBe('healthy')

    // 1st failure: render catches throw, does NOT clear canvas in failure handler
    expect(() => {
      render(mockRenderer, mockGraph, new Set())
    }).not.toThrow()
    expect(getRenderHealth(mockRenderer)).toBe('healthy')
    expect(getClearCount()).toBe(0)

    // Cooldown is 2 frames: next 2 frames are skipped
    render(mockRenderer, mockGraph, new Set()) // skip 1
    render(mockRenderer, mockGraph, new Set()) // skip 2

    // 2nd failure: escalates to degraded
    render(mockRenderer, mockGraph, new Set())
    expect(getRenderHealth(mockRenderer)).toBe('degraded')

    // Now make it succeed
    setThrow(false)
    // Cooldown is 4 frames: skip 4
    for (let i = 0; i < 4; i++) {
      render(mockRenderer, mockGraph, new Set())
    }
    // Now render succeeds
    render(mockRenderer, mockGraph, new Set())
    expect(getRenderHealth(mockRenderer)).toBe('healthy')

    // Test resetRenderHealth
    setThrow(true)
    for (let i = 0; i < 500; i++) {
      render(mockRenderer, mockGraph, new Set())
    }
    expect(getRenderHealth(mockRenderer)).toBe('disabled')

    // Reset clears disabled
    resetRenderHealth(mockRenderer)
    expect(getRenderHealth(mockRenderer)).toBe('healthy')
  })
})
