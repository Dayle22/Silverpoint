import type { Canvas, ImageFilter, MaskFilter } from 'canvaskit-wasm'

import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import {
  isDegenerateProgressiveAxis,
  progressiveBlurAxis,
  progressiveBlurGradient,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'

import type { SkiaRenderer } from './renderer'

export const MAX_CACHED_IMAGE_FILTERS = 128
export const MAX_CACHED_MASK_FILTERS = 128

function setBounded<K, V extends { delete: () => void } | null>(
  map: Map<K, V>,
  key: K,
  value: V,
  max: number
): void {
  map.set(key, value)
  while (map.size > max) {
    const oldestKey = map.keys().next().value
    if (oldestKey === undefined) break
    const oldestVal = map.get(oldestKey)
    oldestVal?.delete()
    map.delete(oldestKey)
  }
}

export function getCachedDropShadow(
  r: SkiaRenderer,
  dx: number,
  dy: number,
  sigma: number,
  color: Float32Array
): ImageFilter {
  const qdx = Math.round(dx * 2) / 2
  const qdy = Math.round(dy * 2) / 2
  const qsigma = Math.round(sigma * 2) / 2
  const key = `ds:${qdx},${qdy},${qsigma},${color[0]},${color[1]},${color[2]},${color[3]}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
    setBounded(r.imageFilterCache, key, filter, MAX_CACHED_IMAGE_FILTERS)
  }
  return filter
}

export function getCachedBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const qsigma = Math.round(sigma * 2) / 2
  const key = `blur:${qsigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
    setBounded(r.imageFilterCache, key, filter, MAX_CACHED_IMAGE_FILTERS)
  }
  return filter
}

export function getCachedDecalBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const qsigma = Math.round(sigma * 2) / 2
  const key = `dblur:${qsigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Decal, null)
    setBounded(r.imageFilterCache, key, filter, MAX_CACHED_IMAGE_FILTERS)
  }
  return filter
}

/**
 * Image filter for a progressive blur ramp, in node-local coordinates.
 *
 * Skia blurs by a single sigma, so the ramp is a stack: one copy per band, each
 * blurred by its own radius and masked to the slice of the ramp axis it owns.
 * Bands cross-fade at slice boundaries and retire once the next covers them, so
 * exactly one blur radius is visible at any point — no sharper copy shows its
 * hard edge through the softer halo above it. Coverage clamps to the start and
 * end radius beyond the handles.
 *
 * Falls back to a uniform end-radius blur when the ramp has no direction or no
 * radius difference to ramp across.
 */
export function getCachedProgressiveBlur(
  r: SkiaRenderer,
  effect: Effect,
  width: number,
  height: number
): ImageFilter {
  const ramp = resolveProgressiveBlur(effect)
  const axis = progressiveBlurAxis(ramp, width, height)
  if (ramp.bands.length === 0 || isDegenerateProgressiveAxis(axis)) {
    return getCachedBlur(r, ramp.endRadius / 2)
  }

  const qStart = Math.round(ramp.startRadius * 2) / 2
  const qEnd = Math.round(ramp.endRadius * 2) / 2
  const qx0 = Math.round(axis.x0)
  const qy0 = Math.round(axis.y0)
  const qx1 = Math.round(axis.x1)
  const qy1 = Math.round(axis.y1)
  const key = `pblur:${qStart},${qEnd},${qx0},${qy0},${qx1},${qy1}`
  const cached = r.imageFilterCache.get(key)
  if (cached) return cached

  let stack: ImageFilter | null = null

  for (const band of ramp.bands) {
    const { from, to, positions, alphas } = progressiveBlurGradient(band, axis)
    // A zero radius needs no blur filter: a null input is the source itself.
    const blurred =
      band.radius > 0
        ? r.ck.ImageFilter.MakeBlur(band.radius / 2, band.radius / 2, r.ck.TileMode.Clamp, null)
        : null
    const gradient = r.ck.Shader.MakeLinearGradient(
      [from.x, from.y],
      [to.x, to.y],
      alphas.map((alpha) => r.ck.Color4f(0, 0, 0, alpha)),
      positions,
      r.ck.TileMode.Clamp
    )
    const mask = r.ck.ImageFilter.MakeShader(gradient)
    // Blend(mode, background, foreground) treats the foreground as src: DstIn
    // keeps the blurred copy only where the gradient mask is opaque.
    const banded = r.ck.ImageFilter.MakeBlend(r.ck.BlendMode.DstIn, blurred, mask)

    // The composite holds its own reference to each input, so the intermediate
    // wrappers can be released immediately instead of accumulating per frame.
    gradient.delete()
    mask.delete()
    blurred?.delete()

    if (!stack) {
      // A null background would mean the unfiltered source, which would put a
      // sharp copy under the whole ramp; the first band starts the stack.
      stack = banded
      continue
    }
    const composited = r.ck.ImageFilter.MakeBlend(r.ck.BlendMode.SrcOver, stack, banded)
    banded.delete()
    stack.delete()
    stack = composited
  }

  const filter = stack as ImageFilter
  setBounded(r.imageFilterCache, key, filter, MAX_CACHED_IMAGE_FILTERS)
  return filter
}

export function getCachedMaskBlur(r: SkiaRenderer, sigma: number): MaskFilter {
  const qsigma = Math.round(sigma * 2) / 2
  let filter = r.maskFilterCache.get(qsigma)
  if (!filter) {
    filter = r.ck.MaskFilter.MakeBlur(r.ck.BlurStyle.Normal, sigma, true)
    setBounded(r.maskFilterCache, qsigma, filter, MAX_CACHED_MASK_FILTERS)
  }
  return filter
}

export function applyClippedBlur(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  sigma: number
): void {
  // Entry guard: reset shared paint to known state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

  canvas.save()
  try {
    r.clipNodeShape(canvas, node, rect, hasRadius)
    canvas.saveLayer(undefined, rect, r.getCachedBlur(sigma), undefined, r.ck.TileMode.Clamp)
    canvas.restore()
  } finally {
    // Exit guard: ensure shared paint is in clean state
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    canvas.restore()
  }
}
