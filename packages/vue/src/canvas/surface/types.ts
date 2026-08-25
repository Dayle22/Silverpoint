/**
 * Options for {@link useCanvas}.
 */
export type CanvasRenderLayer = 'full' | 'scene' | 'overlays'

export interface UseCanvasOptions {
  /**
   * Selects which render layer this canvas owns.
   */
  layer?: CanvasRenderLayer
  /**
   * Forces ruler visibility on or off for this canvas.
   *
   * When omitted, the composable falls back to viewport and URL-param logic.
   */
  showRulers?: boolean
  /**
   * Keeps the drawing buffer after presenting frames.
   *
   * Useful for screenshot or pixel-readback workflows, but may increase memory
   * usage depending on the browser and GPU backend.
   */
  preserveDrawingBuffer?: boolean
  /**
   * Requests a GPU-backed surface.
   *
   * Read once per surface creation, so a host application can supply reactive
   * state without this package depending on it. Returning `false` builds a
   * CPU raster surface instead. Defaults to accelerated.
   */
  accelerated?: () => boolean
  /**
   * Receives the backend actually obtained each time a surface is built.
   *
   * Reports what the renderer got, never what was asked for, so capability UI
   * cannot claim GPU support the surface does not have.
   */
  onSurfaceInfo?: (info: CanvasSurfaceInfo) => void
  /**
   * Called once the rendering surface is ready.
   */
  onReady?: () => void
}

/**
 * Which backend a created surface actually draws through.
 *
 * `none` means surface creation failed and nothing can be drawn.
 */
export type CanvasSurfaceBackend = 'gpu' | 'cpu' | 'none'

/**
 * Observed capabilities of a created rendering surface.
 */
export interface CanvasSurfaceInfo {
  /** Backend the surface was actually created with. */
  backend: CanvasSurfaceBackend
  /** Whether acceleration was requested when this surface was built. */
  accelerationRequested: boolean
  /** Unmasked GPU vendor, when the driver exposes it. */
  vendor: string | null
  /** Unmasked GPU renderer, when the driver exposes it. */
  renderer: string | null
  /** Colour space the surface was created with. */
  colorSpace: 'display-p3' | 'srgb' | null
}
