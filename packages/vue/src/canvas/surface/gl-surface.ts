import type { CanvasKit, Surface } from 'canvaskit-wasm'

import type { Editor } from '@open-pencil/core/editor'

import type { CanvasSurfaceInfo, UseCanvasOptions } from '#vue/canvas/surface/types'

type GLContext = ReturnType<CanvasKit['MakeGrContext']>

export type CanvasGLContext = GLContext

export type CanvasSurfaceResult = {
  surface: Surface | null
  glContext: GLContext | null
  info: CanvasSurfaceInfo
}

/**
 * The only editor state surface creation reads.
 *
 * A full {@link Editor} satisfies this, and narrowing keeps surface creation
 * independent of the rest of the editor.
 */
export type SurfaceColorSpaceSource = {
  graph: { documentColorSpace: Editor['graph']['documentColorSpace'] }
}

export function sizeCanvas(canvas: HTMLCanvasElement, editor: Editor) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  if ('setViewportSize' in editor && typeof editor.setViewportSize === 'function') {
    editor.setViewportSize(canvas.clientWidth, canvas.clientHeight)
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Reads the driver's vendor and renderer names from an already-created WebGL
 * context.
 *
 * Only safe once `GetWebGLContext` has bound a WebGL context to this canvas:
 * requesting one on an unbound canvas would permanently stop the CPU path from
 * taking a 2D context on the same element.
 */
function readGpuNames(canvas: HTMLCanvasElement): {
  vendor: string | null
  renderer: string | null
} {
  const gl = (canvas.getContext('webgl2') ??
    canvas.getContext('webgl')) as WebGLRenderingContext | null
  if (!gl) return { vendor: null, renderer: null }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const vendor = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
    : gl.getParameter(gl.VENDOR)
  const renderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER)

  return { vendor: asString(vendor), renderer: asString(renderer) }
}

function makeSoftwareSurface(ck: CanvasKit, canvas: HTMLCanvasElement): CanvasSurfaceResult {
  const surface = ck.MakeSWCanvasSurface(canvas)
  return {
    surface,
    glContext: null,
    info: {
      backend: surface ? 'cpu' : 'none',
      accelerationRequested: false,
      vendor: null,
      renderer: null,
      colorSpace: surface ? 'srgb' : null
    }
  }
}

export function makeGLSurface(
  ck: CanvasKit,
  canvas: HTMLCanvasElement,
  editor: SurfaceColorSpaceSource,
  options: UseCanvasOptions | undefined,
  glContext: GLContext | null
): CanvasSurfaceResult {
  const failed: CanvasSurfaceInfo = {
    backend: 'none',
    accelerationRequested: true,
    vendor: null,
    renderer: null,
    colorSpace: null
  }

  let context = glContext
  if (!context) {
    const glAttrs = options?.preserveDrawingBuffer ? { preserveDrawingBuffer: 1 } : undefined
    const handle = ck.GetWebGLContext(canvas, glAttrs)
    if (!handle) return { surface: null, glContext: context, info: failed }
    context = ck.MakeGrContext(handle)
  }
  if (!context) return { surface: null, glContext: context, info: failed }

  const preferredSpace = editor.graph.documentColorSpace
  const colorSpaces =
    preferredSpace === 'display-p3'
      ? ([
          [ck.ColorSpace.DISPLAY_P3, 'display-p3'],
          [ck.ColorSpace.SRGB, 'srgb']
        ] as const)
      : ([[ck.ColorSpace.SRGB, 'srgb']] as const)

  for (const [colorSpace, label] of colorSpaces) {
    const surface = ck.MakeOnScreenGLSurface(context, canvas.width, canvas.height, colorSpace)
    if (!surface) continue
    const { vendor, renderer } = readGpuNames(canvas)
    return {
      surface,
      glContext: context,
      info: { backend: 'gpu', accelerationRequested: true, vendor, renderer, colorSpace: label }
    }
  }

  return { surface: null, glContext: context, info: failed }
}

/**
 * Builds the rendering surface for a canvas, honouring the caller's
 * acceleration request.
 *
 * A canvas element binds one context type for its lifetime, so a surface built
 * on one backend cannot be rebuilt on the other without replacing the element.
 */
export function createCanvasSurface(
  ck: CanvasKit,
  canvas: HTMLCanvasElement,
  editor: SurfaceColorSpaceSource,
  options: UseCanvasOptions | undefined,
  glContext: GLContext | null
): CanvasSurfaceResult {
  if (options?.accelerated?.() === false) return makeSoftwareSurface(ck, canvas)
  return makeGLSurface(ck, canvas, editor, options, glContext)
}
