import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { computeDescendantVisualBounds } from '@open-pencil/scene-graph/geometry'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { EditorState } from '#core/editor/types'

import { drawChromePass, drawLabelPass, drawOverlayPass } from './overlay-pass'
import { renderSceneBacking, updateSceneBackingPreviewState } from './retained-backing'
import {
  clearSubtreePictureCache,
  invalidateAllPictures,
  invalidateScenePicture
} from './state'
import {
  createFrameGuardState,
  noteFrameFailure,
  noteFrameSuccess,
  shouldSkipFrame,
  type FrameGuardState,
  type RenderHealth
} from './frame-guard'

/** Multiples of the visible viewport recorded around it, so small pans need no re-record. */
export const SCENE_PICTURE_VIEWPORT_MARGIN_FACTOR = 1.5

/** Absolute minimum recorded margin in world units, for very small viewports. */
export const SCENE_PICTURE_MIN_MARGIN = 1_024

/** Retained for full-document output. Do not use on the interactive path. */
export const UNBOUNDED_VIEWPORT = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 } as const

export interface WorldViewport {
  x: number
  y: number
  w: number
  h: number
}

const recordedViewports = new WeakMap<SkiaRenderer, WorldViewport>()

export function getRecordedSceneViewport(r: SkiaRenderer): WorldViewport | null {
  return recordedViewports.get(r) ?? null
}

export function setRecordedSceneViewport(r: SkiaRenderer, viewport: WorldViewport | null): void {
  if (viewport) {
    recordedViewports.set(r, viewport)
  } else {
    recordedViewports.delete(r)
  }
}

export function isViewportContained(inner: WorldViewport, outer: WorldViewport): boolean {
  const EPS = 1e-4
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS
  )
}

export function computeRecordingViewport(visible: WorldViewport): WorldViewport {
  const marginX = Math.max(
    (visible.w * (SCENE_PICTURE_VIEWPORT_MARGIN_FACTOR - 1)) / 2,
    SCENE_PICTURE_MIN_MARGIN
  )
  const marginY = Math.max(
    (visible.h * (SCENE_PICTURE_VIEWPORT_MARGIN_FACTOR - 1)) / 2,
    SCENE_PICTURE_MIN_MARGIN
  )

  return {
    x: visible.x - marginX,
    y: visible.y - marginY,
    w: visible.w + marginX * 2,
    h: visible.h + marginY * 2
  }
}

export function renderSceneToCanvas(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  pageId: string
): void {
  const prevViewport = r.worldViewport
  r.worldViewport = UNBOUNDED_VIEWPORT
  const pageNode = graph.getNode(pageId)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(canvas, graph, childId, {})
    }
  }
  r.worldViewport = prevViewport
}

export type RenderLayer = 'full' | 'scene' | 'overlays'

export function renderFromEditorState(
  r: SkiaRenderer,
  state: EditorState,
  graph: SceneGraph,
  textEditor: unknown,
  viewportWidth: number,
  viewportHeight: number,
  showRulers = true,
  dpr = 1,
  layer: RenderLayer = 'full'
): void {
  r.dpr = dpr
  r.panX = state.panX
  r.panY = state.panY
  r.zoom = state.zoom
  r.viewportWidth = viewportWidth
  r.viewportHeight = viewportHeight
  r.showRulers = showRulers
  r.pageColor = state.pageColor
  r.rulerTheme = state.rulerTheme ?? null
  r.pageId = state.currentPageId
  render(
    r,
    graph,
    state.selectedIds,
    {
      hoveredNodeId: state.hoveredNodeId,
      measurementMode: state.measurementMode,
      enteredContainerId: state.enteredContainerId,
      editingTextId: state.editingTextId,
      textEditor: textEditor as RenderOverlays['textEditor'],
      marquee: state.marquee,
      snapGuides: state.snapGuides,
      guides: state.guides,
      rotationPreview: state.rotationPreview,
      dropTargetId: state.dropTargetId,
      layoutInsertIndicator: state.layoutInsertIndicator,
      penState: state.penState
        ? ({
            ...state.penState,
            cursorX: state.penCursorX ?? undefined,
            cursorY: state.penCursorY ?? undefined
          } as RenderOverlays['penState'])
        : null,
      nodeEditState: state.nodeEditState ?? null,
      remoteCursors: state.remoteCursors,
      autoLayoutHover: state.autoLayoutHover,
      progressiveBlurEdit: state.progressiveBlurEdit ?? null,
      gradientEdit: state.gradientEdit ?? null
    },
    state.sceneVersion,
    layer
  )
}

function sceneContentDependsOnOverlay(overlays: RenderOverlays): boolean {
  return (
    overlays.dropTargetId != null ||
    overlays.rotationPreview != null ||
    overlays.editingTextId != null ||
    overlays.nodeEditState != null
  )
}

export function scenePictureMissReason(
  r: SkiaRenderer,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  hasPositionPreview: boolean
): string {
  if (hasPositionPreview) return 'position-preview'
  if (sceneContentDependsOnOverlay(overlays)) return 'volatile-overlay'
  if (!r.scenePicture) return 'missing-picture'
  if (graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion)
    return 'position-preview-version'
  if (sceneVersion !== r.scenePictureVersion) return 'scene-version'
  if (r.fontGeneration !== r.scenePictureFontGeneration) return 'font-generation'
  if (r.pageId !== r.scenePicturePageId) return 'page'

  const recordedViewport = recordedViewports.get(r)
  const currentViewport = r.worldViewport ?? {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }
  if (!recordedViewport || !isViewportContained(currentViewport, recordedViewport)) {
    return 'viewport-escaped'
  }

  return 'unknown'
}

export function canUseScenePicture(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number,
  requiresUncachedSceneRender: boolean
): boolean {
  if (
    requiresUncachedSceneRender ||
    !r.scenePicture ||
    graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion ||
    sceneVersion !== r.scenePictureVersion ||
    r.fontGeneration !== r.scenePictureFontGeneration ||
    r.pageId !== r.scenePicturePageId
  ) {
    return false
  }

  const recordedViewport = recordedViewports.get(r)
  if (!recordedViewport) return false

  const currentViewport = r.worldViewport ?? {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }

  return isViewportContained(currentViewport, recordedViewport)
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0

function measure<T>(fn: () => T): { value: T; duration: number } {
  const start = now()
  const value = fn()
  return { value, duration: now() - start }
}

const frameGuards = new WeakMap<SkiaRenderer, FrameGuardState>()

function guardFor(r: SkiaRenderer): FrameGuardState {
  let s = frameGuards.get(r)
  if (!s) {
    s = createFrameGuardState()
    frameGuards.set(r, s)
  }
  return s
}

export function getRenderHealth(r: SkiaRenderer): RenderHealth {
  return guardFor(r).health
}

export function resetRenderHealth(r: SkiaRenderer): void {
  const guard = guardFor(r)
  guard.health = 'healthy'
  guard.consecutiveFailures = 0
  guard.totalFailures = 0
  guard.lastError = null
  guard.lastErrorAt = null
  guard.cooldownFrames = 0
}

function handleFrameFailure(
  r: SkiaRenderer,
  guard: FrameGuardState,
  health: RenderHealth,
  error: unknown,
  prevHealth: RenderHealth
): void {
  try {
    if (health === 'disabled') {
      if (prevHealth !== 'disabled') {
        console.error(
          `[Silverpoint Render Guard] Render disabled after ${guard.consecutiveFailures} consecutive failures:`,
          guard.lastError ?? error
        )
      }
      return
    }

    if (health === 'degraded') {
      if (prevHealth !== 'degraded') {
        console.warn(
          `[Silverpoint Render Guard] Render entered degraded mode (failure ${guard.consecutiveFailures}):`,
          guard.lastError ?? error
        )
      }
      invalidateAllPictures(r)
      clearSubtreePictureCache(r)
      return
    }

    // health === 'healthy' (first failure)
    if (guard.consecutiveFailures === 1) {
      console.warn(
        `[Silverpoint Render Guard] Render frame failure (retrying with backoff):`,
        guard.lastError ?? error
      )
    }
    invalidateScenePicture(r)
  } catch (recoveryError) {
    console.error('[Silverpoint Render Guard] Recovery ladder failed:', recoveryError)
  }
}

export function render(
  r: SkiaRenderer,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays = {},
  sceneVersion = -1,
  layer: RenderLayer = 'full'
): void {
  const guard = guardFor(r)
  if (guard.health === 'disabled') return
  if (shouldSkipFrame(guard)) return

  try {
    r.syncFontGeneration()
    const p = r.profiler
    p.beginFrame()
    p.setScenePictureDrawTime(0)
    p.setScenePictureRecordTime(0)
    p.setFlushTime(0)

    graph.clearAbsPosCache()

    const canvas = r.surface.getCanvas()
    if (layer === 'overlays') {
      canvas.clear(r.ck.Color4f(0, 0, 0, 0))
    } else {
      canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
    }

    r.worldViewport = {
      x: -r.panX / r.zoom,
      y: -r.panY / r.zoom,
      w: r.viewportWidth / r.zoom,
      h: r.viewportHeight / r.zoom
    }
    updateSceneBackingPreviewState(r, layer)

    const hasPositionPreview =
      graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion &&
      sceneVersion === r.scenePictureVersion
    const isDegraded = guard.health === 'degraded'
    const requiresUncachedSceneRender =
      hasPositionPreview ||
      sceneContentDependsOnOverlay(overlays) ||
      isDegraded

    const canUsePicture = canUseScenePicture(r, graph, sceneVersion, requiresUncachedSceneRender)
    const cacheMissReason = scenePictureMissReason(
      r,
      graph,
      overlays,
      sceneVersion,
      hasPositionPreview
    )

    if (layer !== 'overlays') {
      canvas.save()
      canvas.scale(r.dpr, r.dpr)

      p.beginPhase('render:scene')
      if (
        layer === 'scene' &&
        !requiresUncachedSceneRender &&
        renderSceneBacking(r, canvas, graph, sceneVersion)
      ) {
        p.setScenePictureMode('hit', 'backing')
      } else {
        canvas.translate(r.panX, r.panY)
        canvas.scale(r.zoom, r.zoom)
        renderSceneContent(
          r,
          canvas,
          graph,
          overlays,
          sceneVersion,
          canUsePicture,
          cacheMissReason,
          requiresUncachedSceneRender
        )
      }
      p.endPhase('render:scene')

      canvas.restore()
    }

    if (layer !== 'scene') {
      canvas.save()
      canvas.scale(r.dpr, r.dpr)
      r.labelCache.update(graph, r.pageId, sceneVersion, graph.positionPreviewVersion)
      drawLabelPass(r, canvas, graph)
      canvas.restore()

      canvas.save()
      canvas.scale(r.dpr, r.dpr)

      drawOverlayPass(r, canvas, graph, selectedIds, overlays)
      drawChromePass(r, canvas, graph, selectedIds, overlays)

      canvas.restore()
    }

    p.beginPhase('render:flush')
    const { duration: flushDuration } = measure(() => r.surface.flush())
    p.setFlushTime(flushDuration)
    p.endPhase('render:flush')

    p.setNodeCounts(r._nodeCount, r._culledCount)
    p.endFrame()
    noteFrameSuccess(guard)
  } catch (error) {
    const prevHealth = guard.health
    const health = noteFrameFailure(guard, error)
    handleFrameFailure(r, guard, health, error, prevHealth)
  }
}

function renderSceneContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  canUsePicture: boolean,
  cacheMissReason: string,
  requiresUncachedSceneRender: boolean
): void {
  const p = r.profiler
  if (canUsePicture) {
    p.setScenePictureMode('hit')
    p.beginPhase('render:drawPicture')
    if (r.scenePicture) {
      const picture = r.scenePicture
      const { duration } = measure(() => canvas.drawPicture(picture))
      p.setScenePictureDrawTime(duration)
    }
    p.endPhase('render:drawPicture')
  } else if (requiresUncachedSceneRender) {
    p.setScenePictureMode('volatile', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    p.beginPhase('render:volatile')
    renderPageChildren(r, canvas, graph, overlays)
    p.endPhase('render:volatile')
  } else {
    p.setScenePictureMode('record', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    p.beginPhase('render:recordPicture')
    const { duration } = measure(() => recordScenePicture(r, canvas, graph, sceneVersion))
    p.setScenePictureRecordTime(duration)
    p.endPhase('render:recordPicture')
  }
}

function renderPageChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays
): void {
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return
  for (const childId of pageNode.childIds) {
    r.renderNode(canvas, graph, childId, overlays)
  }
}

export function recordScenePicture(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): void {
  r.scenePicture?.delete()
  const prevViewport = r.worldViewport
  const visible = prevViewport ?? {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }
  const recordingViewport = computeRecordingViewport(visible)
  r.worldViewport = recordingViewport
  const recorder = new r.ck.PictureRecorder()
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  const sceneContentBounds = pageNode
    ? computeDescendantVisualBounds(
        pageNode.childIds,
        (id) => graph.getNode(id),
        (id) => graph.getAbsolutePosition(id)
      )
    : null
  const sceneBounds = sceneContentBounds
    ? {
        x: sceneContentBounds.minX,
        y: sceneContentBounds.minY,
        width: sceneContentBounds.maxX - sceneContentBounds.minX,
        height: sceneContentBounds.maxY - sceneContentBounds.minY
      }
    : { x: 0, y: 0, width: 1, height: 1 }
  const padding = 1024
  const bounds = r.ck.LTRBRect(
    sceneBounds.x - padding,
    sceneBounds.y - padding,
    sceneBounds.x + sceneBounds.width + padding,
    sceneBounds.y + sceneBounds.height + padding
  )
  const recCanvas = recorder.beginRecording(bounds)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(recCanvas, graph, childId, {})
    }
  }
  r.scenePicture = recorder.finishRecordingAsPicture()
  recorder.delete()
  r.worldViewport = prevViewport
  r.scenePictureVersion = sceneVersion
  r.scenePictureFontGeneration = r.fontGeneration
  r.scenePicturePositionPreviewVersion = graph.positionPreviewVersion
  r.scenePicturePageId = r.pageId
  recordedViewports.set(r, recordingViewport)
  canvas.drawPicture(r.scenePicture)
}
