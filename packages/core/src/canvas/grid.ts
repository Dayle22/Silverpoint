import type { Canvas, Paint } from 'canvaskit-wasm'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import type { SkiaRenderer } from '#core/canvas/renderer'

export type CanvasGridMode = 'dots' | 'lines'

export interface CanvasGridSettings {
  visible: boolean
  mode: CanvasGridMode
  spacing: number
  dotSize: number
  opacity: number
  color: string
}

export const DEFAULT_CANVAS_GRID_SETTINGS: CanvasGridSettings = {
  visible: true,
  mode: 'dots',
  spacing: 16,
  dotSize: 1.5,
  opacity: 0.2,
  color: '#808080'
}

const MIN_GRID_SPACING = 4
const MAX_GRID_SPACING = 256
const MIN_GRID_DOT_SIZE = 1
const MAX_GRID_DOT_SIZE = 8
const MIN_GRID_OPACITY = 0.05
const MAX_GRID_OPACITY = 0.8
const MAX_GRID_CELLS = 400
const MIN_GRID_SCREEN_SPACING = 8

function normaliseGridColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CANVAS_GRID_SETTINGS.color
  const color = value.trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : DEFAULT_CANVAS_GRID_SETTINGS.color
}

export function normalizeCanvasGridSettings(value: Partial<CanvasGridSettings>): CanvasGridSettings {
  return {
    visible: value.visible === undefined ? DEFAULT_CANVAS_GRID_SETTINGS.visible : value.visible,
    mode: value.mode === 'lines' ? 'lines' : 'dots',
    spacing:
      typeof value.spacing === 'number' && Number.isFinite(value.spacing)
        ? Math.min(MAX_GRID_SPACING, Math.max(MIN_GRID_SPACING, value.spacing))
        : DEFAULT_CANVAS_GRID_SETTINGS.spacing,
    dotSize:
      typeof value.dotSize === 'number' && Number.isFinite(value.dotSize)
        ? Math.min(MAX_GRID_DOT_SIZE, Math.max(MIN_GRID_DOT_SIZE, value.dotSize))
        : DEFAULT_CANVAS_GRID_SETTINGS.dotSize,
    opacity:
      typeof value.opacity === 'number' && Number.isFinite(value.opacity)
        ? Math.min(MAX_GRID_OPACITY, Math.max(MIN_GRID_OPACITY, value.opacity))
        : DEFAULT_CANVAS_GRID_SETTINGS.opacity,
    color: normaliseGridColor(value.color)
  }
}

function gridStep(r: SkiaRenderer, spacing: number): number {
  let step = spacing
  while (
    step * r.zoom < MIN_GRID_SCREEN_SPACING ||
    r.worldViewport.w / step > MAX_GRID_CELLS ||
    r.worldViewport.h / step > MAX_GRID_CELLS
  ) {
    step *= 2
  }
  return step
}

function gridColor(r: SkiaRenderer, settings: CanvasGridSettings): Color {
  const base = parseColor(settings.color)
  if (settings.color === DEFAULT_CANVAS_GRID_SETTINGS.color && r.rulerTheme?.tick) {
    return { ...r.rulerTheme.tick, a: settings.opacity }
  }
  return { r: base.r, g: base.g, b: base.b, a: settings.opacity }
}

export function drawCanvasGrid(
  r: SkiaRenderer,
  canvas: Canvas,
  settings: CanvasGridSettings,
  paint: Paint
): void {
  if (!settings.visible) return

  const step = gridStep(r, settings.spacing)
  const color = gridColor(r, settings)
  paint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  paint.setStrokeWidth(1 / r.zoom)

  const startX = Math.floor(r.worldViewport.x / step) * step
  const startY = Math.floor(r.worldViewport.y / step) * step
  const endX = r.worldViewport.x + r.worldViewport.w
  const endY = r.worldViewport.y + r.worldViewport.h

  if (settings.mode === 'lines') {
    for (let x = startX; x <= endX; x += step) canvas.drawLine(x, r.worldViewport.y, x, endY, paint)
    for (let y = startY; y <= endY; y += step) canvas.drawLine(r.worldViewport.x, y, endX, y, paint)
    return
  }

  const radius = settings.dotSize / (2 * r.zoom)
  for (let x = startX; x <= endX; x += step) {
    for (let y = startY; y <= endY; y += step) canvas.drawCircle(x, y, radius, paint)
  }
}
