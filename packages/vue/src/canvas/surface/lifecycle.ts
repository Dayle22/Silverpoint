import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'

import {
  createCanvasSurface,
  sizeCanvas,
  type CanvasGLContext
} from '#vue/canvas/surface/gl-surface'
import { useCanvasKitLoader } from '#vue/canvas/surface/kit-loader'
import { createCanvasRenderLoop } from '#vue/canvas/surface/render-loop'
import { useCanvasResizeObserver } from '#vue/canvas/surface/resize-observer'
import type { CanvasSurfaceInfo, UseCanvasOptions } from '#vue/canvas/surface/types'

type SurfaceManagerState = {
  renderer: SkiaRenderer | null
  glContext: CanvasGLContext | null
  info: CanvasSurfaceInfo | null
}

export function createCanvasSurfaceManager({
  editor,
  canvasRef,
  options,
  getCanvasKit,
  isDestroyed,
  shouldShowRulers
}: {
  editor: Editor
  canvasRef: { value: HTMLCanvasElement | null }
  options: UseCanvasOptions | undefined
  getCanvasKit: () => CanvasKit | null
  isDestroyed: () => boolean
  shouldShowRulers: () => boolean
}) {
  const state: SurfaceManagerState = { renderer: null, glContext: null, info: null }
  let sceneBackingRenderTimer: ReturnType<typeof setTimeout> | null = null
  let contextLost = false
  let boundCanvas: HTMLCanvasElement | null = null

  function reportSurfaceInfo(info: CanvasSurfaceInfo) {
    state.info = info
    options?.onSurfaceInfo?.(info)
  }

  function clearSceneBackingRenderTimer() {
    if (sceneBackingRenderTimer === null) return
    clearTimeout(sceneBackingRenderTimer)
    sceneBackingRenderTimer = null
  }

  function handleContextLost(event: Event) {
    event.preventDefault()
    contextLost = true
    renderLoop.pause()
    state.glContext = null
  }

  function handleContextRestored() {
    contextLost = false
    if (!boundCanvas || isDestroyed()) return
    createSurface(boundCanvas, { reloadFonts: true })
    renderNow()
  }

  function bindContextListeners(canvas: HTMLCanvasElement) {
    if (boundCanvas === canvas) return
    unbindContextListeners()
    boundCanvas = canvas
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
  }

  function unbindContextListeners() {
    if (!boundCanvas) return
    boundCanvas.removeEventListener('webglcontextlost', handleContextLost)
    boundCanvas.removeEventListener('webglcontextrestored', handleContextRestored)
    boundCanvas = null
  }

  function createSurface(
    canvas: HTMLCanvasElement,
    { reloadFonts = false }: { reloadFonts?: boolean } = {}
  ) {
    const ck = getCanvasKit()
    if (!ck) return

    bindContextListeners(canvas)

    if (state.renderer) editor.removeCanvasRenderer(state.renderer)
    state.renderer?.destroy()
    state.renderer = null
    state.glContext?.delete()
    state.glContext = null

    sizeCanvas(canvas, editor)

    const result = createCanvasSurface(ck, canvas, editor, options, state.glContext)
    state.glContext = result.glContext
    reportSurfaceInfo(result.info)
    const surface = result.surface
    if (!surface) {
      canvas.dataset.surfaceError = result.info.accelerationRequested ? 'webgl' : 'software'
      return
    }
    delete canvas.dataset.surfaceError

    // Profiling reads GPU timer queries, so only the accelerated path has one.
    const glCtx = result.info.backend === 'gpu' ? (canvas.getContext('webgl2') ?? null) : null
    state.renderer = new SkiaRenderer(ck, surface, glCtx)
    editor.setCanvasKit(ck, state.renderer)
    canvas.dataset.ready = '1'

    // When the surface is recreated after a resize fallback, destroyRenderer
    // has cleared the module-level fontProvider — the new renderer must reload.
    // On initial mount, kit-loader.init() handles loadFonts, so skip here.
    if (reloadFonts && !isDestroyed()) {
      void state.renderer.loadFonts(renderNow).then(() => {
        if (!isDestroyed()) renderNow()
        return undefined
      })
    }
  }

  function renderNow() {
    if (contextLost || !state.renderer || isDestroyed()) return
    state.renderer.renderFromEditorState(
      editor.state,
      editor.graph,
      editor.textEditor,
      canvasRef.value?.clientWidth ?? 0,
      canvasRef.value?.clientHeight ?? 0,
      shouldShowRulers(),
      options?.layer ?? 'full'
    )
    renderLoop.markRendered()
    clearSceneBackingRenderTimer()
    if (options?.layer === 'scene' && state.renderer.sceneBackingNeedsCrispRender) {
      const delay = Math.max(0, state.renderer.sceneBackingPreviewUntil - performance.now())
      sceneBackingRenderTimer = setTimeout(() => renderLoop.markDirty(), delay)
    }
  }

  const renderLoop = createCanvasRenderLoop(editor, renderNow, { layer: options?.layer })

  function resizeCanvas(canvas: HTMLCanvasElement) {
    const ck = getCanvasKit()
    if (!ck || !state.renderer) {
      createSurface(canvas)
      return
    }

    sizeCanvas(canvas, editor)

    // The canvas element keeps whichever context type it was first given, so a
    // resize has to rebuild on the backend already in use, not the one the
    // preference currently asks for.
    const activeBackend = state.info?.backend
    const resizeOptions: UseCanvasOptions = {
      ...options,
      accelerated: () => activeBackend === 'gpu'
    }

    const result = createCanvasSurface(ck, canvas, editor, resizeOptions, state.glContext)
    state.glContext = result.glContext
    const surface = result.surface
    if (!surface) {
      console.warn('Falling back to full surface recreation after resize')
      createSurface(canvas, { reloadFonts: true })
      return
    }
    reportSurfaceInfo(result.info)
    state.renderer.replaceSurface(surface)
    renderNow()
  }

  function destroy() {
    unbindContextListeners()
    contextLost = false
    clearSceneBackingRenderTimer()
    renderLoop.pause()
    if (state.renderer) editor.removeCanvasRenderer(state.renderer)
    state.renderer?.destroy()
    state.renderer = null
    state.glContext?.delete()
    state.glContext = null
  }

  return {
    createSurface,
    resizeCanvas,
    renderNow,
    destroy,
    markDirty: renderLoop.markDirty,
    getRenderer: () => state.renderer,
    getSurfaceInfo: () => state.info
  }
}

export function useCanvasSurfaceLifecycle({
  canvasRef,
  surface,
  setCanvasKit,
  getCanvasKitValue,
  lifecycle,
  onReady
}: {
  canvasRef: Ref<HTMLCanvasElement | null>
  surface: ReturnType<typeof createCanvasSurfaceManager>
  setCanvasKit: (ck: CanvasKit | null) => void
  getCanvasKitValue: () => CanvasKit | null
  lifecycle: { destroyed: boolean }
  onReady?: () => void
}) {
  useCanvasKitLoader({
    canvasRef,
    lifecycle,
    setCanvasKit,
    createSurface: surface.createSurface,
    loadFonts: () => surface.getRenderer()?.loadFonts(surface.renderNow),
    renderNow: surface.renderNow,
    onReady
  })

  const { cancelResize } = useCanvasResizeObserver({
    canvasRef,
    getCanvasKitValue,
    resizeCanvas: surface.resizeCanvas
  })

  onScopeDispose(() => {
    lifecycle.destroyed = true
    cancelResize()
    surface.destroy()
  })
}
