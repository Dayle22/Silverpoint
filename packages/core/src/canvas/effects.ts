import type { Canvas, ImageFilter, MaskFilter } from 'canvaskit-wasm'

import type {
  ProgressiveBlurAxis,
  ProgressiveBlurRamp,
  SceneNode
} from '@open-pencil/scene-graph'
import {
  isDegenerateProgressiveAxis,
  progressiveBlurGradient
} from '@open-pencil/scene-graph'

import type { SkiaRenderer } from './renderer'

export function getCachedDropShadow(
  r: SkiaRenderer,
  dx: number,
  dy: number,
  sigma: number,
  color: Float32Array
): ImageFilter {
  const key = `ds:${dx},${dy},${sigma},${color[0]},${color[1]},${color[2]},${color[3]}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `blur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedDecalBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `dblur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Decal, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedMaskBlur(r: SkiaRenderer, sigma: number): MaskFilter {
  let filter = r.maskFilterCache.get(sigma)
  if (!filter) {
    filter = r.ck.MaskFilter.MakeBlur(r.ck.BlurStyle.Normal, sigma, true)
    r.maskFilterCache.set(sigma, filter)
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
  r.clipNodeShape(canvas, node, rect, hasRadius)
  canvas.saveLayer(undefined, rect, r.getCachedBlur(sigma), undefined, r.ck.TileMode.Clamp)
  canvas.restore()
  // Exit guard: ensure shared paint is in clean state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  canvas.restore()
}

export function getCachedProgressiveBlur(
  r: SkiaRenderer,
  ramp: ProgressiveBlurRamp,
  axis: ProgressiveBlurAxis
): ImageFilter {
  if (isDegenerateProgressiveAxis(axis) || ramp.startRadius === ramp.endRadius) {
    return r.getCachedBlur(ramp.endRadius / 2)
  }

  const key = `pblur:${ramp.startRadius},${ramp.endRadius},${axis.x0.toFixed(2)},${axis.y0.toFixed(2)},${axis.x1.toFixed(2)},${axis.y1.toFixed(2)}`
  let filter = r.imageFilterCache.get(key)
  if (filter) return filter

  let accumFilter: ImageFilter | null = null

  for (const band of ramp.bands) {
    const blurFilter = r.getCachedBlur(band.radius / 2)
    const grad = progressiveBlurGradient(band, axis)
    const colors = grad.alphas.map((a) => r.ck.Color4f(0, 0, 0, a))
    const shader = r.ck.Shader.MakeLinearGradient(
      [grad.from.x, grad.from.y],
      [grad.to.x, grad.to.y],
      colors,
      grad.positions,
      r.ck.TileMode.Clamp
    )
    const maskFilter = r.ck.ImageFilter.MakeShader(shader)
    shader.delete()

    const bandFilter = r.ck.ImageFilter.MakeBlend(r.ck.BlendMode.DstIn, blurFilter, maskFilter)

    if (!accumFilter) {
      accumFilter = bandFilter
    } else {
      accumFilter = r.ck.ImageFilter.MakeBlend(r.ck.BlendMode.SrcOver, accumFilter, bandFilter)
    }
  }

  filter = accumFilter ?? getCachedBlur(r, ramp.endRadius / 2)
  r.imageFilterCache.set(key, filter)
  return filter
}

