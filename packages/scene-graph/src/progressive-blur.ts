import type { Vector } from './primitives'
import type { Effect } from './types'

/**
 * Number of overlay bands used to approximate a continuous blur ramp.
 *
 * Skia and SVG can only blur by one radius at a time, so a progressive blur is
 * built as a stack: the source blurred at the start radius, then this many
 * blurrier copies, each fading in across its own slice of the ramp axis. Six
 * reads as continuous at normal zoom while keeping the canvas stack cheap.
 */
export const PROGRESSIVE_BLUR_BANDS = 6

/** Default ramp: sharp at the top edge, blurriest at the bottom edge. */
export const DEFAULT_PROGRESSIVE_START_OFFSET: Vector = { x: 0.5, y: 0 }
export const DEFAULT_PROGRESSIVE_END_OFFSET: Vector = { x: 0.5, y: 1 }

/** Ramp axis shorter than this in canvas pixels is treated as uniform. */
const MIN_AXIS_LENGTH = 0.5

export interface ProgressiveBlurStop {
  /** Normalised ramp position. */
  t: number
  /** Mask coverage at that position, 0 (hidden) to 1 (fully drawn). */
  alpha: number
}

export interface ProgressiveBlurBand {
  /** Blur radius this band applies. */
  radius: number
  /**
   * Mask gradient along the ramp axis, in order. Coverage is clamped outside
   * the first and last stop, so a band that never fades out simply ends at 1.
   */
  stops: ProgressiveBlurStop[]
}

export interface ProgressiveBlurRamp {
  /** Radius at (and before) `startOffset`. */
  startRadius: number
  /** Radius at (and after) `endOffset`. */
  endRadius: number
  startOffset: Vector
  endOffset: Vector
  /**
   * The full stack, ordered sharpest (drawn first) to blurriest (drawn last).
   * Each band is masked to the slice of the ramp it owns, so exactly one blur
   * radius covers any point and no sharper copy shows through the blurrier
   * ones along the node's edges.
   */
  bands: ProgressiveBlurBand[]
}

export interface ProgressiveBlurAxis {
  x0: number
  y0: number
  x1: number
  y1: number
  length: number
}

const clampMin = (value: number, min: number) =>
  Number.isFinite(value) ? Math.max(min, value) : min

const offsetOr = (offset: Vector | undefined, fallback: Vector): Vector => {
  if (!offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return fallback
  return { x: offset.x, y: offset.y }
}

/**
 * Blur effects that can carry a progressive ramp. `BACKGROUND_BLUR` is absent
 * deliberately: it blurs the backdrop through a clip rather than the node's own
 * layer, so it has no ramp implementation to honour.
 */
export function supportsProgressiveBlur(effect: Effect): boolean {
  return effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR'
}

/** True when `effect` is a blur configured as a progressive ramp. */
export function isProgressiveBlur(effect: Effect): boolean {
  return effect.blurType === 'PROGRESSIVE' && supportsProgressiveBlur(effect)
}

/**
 * Resolves a progressive blur effect into the band stack every renderer and
 * exporter draws, so the canvas and the SVG/PDF exports stay in step.
 *
 * Band `k` owns the slice `[k/N, (k+1)/N]`: it fades in across the slice before
 * it — over the band below, which is still fully opaque there, so coverage
 * stays complete — holds through its own slice, then fades back out across the
 * slice after, by which point the next band has taken over. That retirement is
 * what keeps a sharper copy from showing its hard edge through the softer halo
 * of the bands above it.
 */
export function resolveProgressiveBlur(
  effect: Effect,
  bandCount: number = PROGRESSIVE_BLUR_BANDS
): ProgressiveBlurRamp {
  const startRadius = clampMin(effect.startRadius ?? 0, 0)
  const endRadius = clampMin(effect.radius, 0)
  const startOffset = offsetOr(effect.startOffset, DEFAULT_PROGRESSIVE_START_OFFSET)
  const endOffset = offsetOr(effect.endOffset, DEFAULT_PROGRESSIVE_END_OFFSET)

  const count = Math.max(1, Math.round(bandCount))
  const bands: ProgressiveBlurBand[] = []
  if (endRadius !== startRadius) {
    for (let k = 0; k <= count; k++) {
      const stops: ProgressiveBlurStop[] = []
      // Sharpest band starts opaque: it also covers everything before the ramp.
      if (k > 0) stops.push({ t: (k - 1) / count, alpha: 0 })
      stops.push({ t: k / count, alpha: 1 })
      // Blurriest band never retires: it holds past the end of the ramp.
      if (k < count) {
        // The fade-out may run past the end handle; the axis extends with it.
        stops.push({ t: (k + 1) / count, alpha: 1 })
        stops.push({ t: (k + 2) / count, alpha: 0 })
      }
      bands.push({ radius: startRadius + (endRadius - startRadius) * (k / count), stops })
    }
  }

  return { startRadius, endRadius, startOffset, endOffset, bands }
}

/** Ramp axis in node-local pixels, from normalised object-space offsets. */
export function progressiveBlurAxis(
  ramp: ProgressiveBlurRamp,
  width: number,
  height: number
): ProgressiveBlurAxis {
  const x0 = ramp.startOffset.x * width
  const y0 = ramp.startOffset.y * height
  const x1 = ramp.endOffset.x * width
  const y1 = ramp.endOffset.y * height
  return { x0, y0, x1, y1, length: Math.hypot(x1 - x0, y1 - y0) }
}

/**
 * True when the ramp axis has collapsed to a point, in which case there is no
 * direction to ramp along and callers fall back to a uniform `endRadius` blur.
 */
export function isDegenerateProgressiveAxis(axis: ProgressiveBlurAxis): boolean {
  return !(axis.length >= MIN_AXIS_LENGTH)
}

/**
 * Effect patch that switches a blur to a progressive ramp, keeping the existing
 * radius as the end radius and filling in any missing ramp fields.
 */
export function progressiveBlurPatch(effect: Effect): Partial<Effect> {
  return {
    blurType: 'PROGRESSIVE',
    startRadius: effect.startRadius ?? 0,
    startOffset: offsetOr(effect.startOffset, DEFAULT_PROGRESSIVE_START_OFFSET),
    endOffset: offsetOr(effect.endOffset, DEFAULT_PROGRESSIVE_END_OFFSET)
  }
}

/**
 * Effect patch that switches a blur back to a single uniform radius. The ramp
 * fields are kept so toggling back restores the previous ramp.
 */
export function uniformBlurPatch(): Partial<Effect> {
  return { blurType: 'NORMAL' }
}

export interface ProgressiveBlurGradient {
  /** Gradient start in node-local pixels. */
  from: Vector
  /** Gradient end in node-local pixels. */
  to: Vector
  /** Stop positions, 0..1 between `from` and `to`. */
  positions: number[]
  /** Coverage at each position, matching `positions` by index. */
  alphas: number[]
}

/**
 * Maps a band's mask stops onto the ramp axis as a plain linear gradient.
 * Coverage outside the returned endpoints is clamped, which is what holds the
 * sharpest band opaque before the ramp and the blurriest one opaque after it.
 */
export function progressiveBlurGradient(
  band: ProgressiveBlurBand,
  axis: ProgressiveBlurAxis
): ProgressiveBlurGradient {
  const first = band.stops[0].t
  const last = band.stops[band.stops.length - 1].t
  const span = last - first
  return {
    from: progressiveBlurPointAt(axis, first),
    to: progressiveBlurPointAt(axis, last),
    positions: band.stops.map((stop) => (span > 0 ? (stop.t - first) / span : 0)),
    alphas: band.stops.map((stop) => stop.alpha)
  }
}

/** Point at normalised position `t` along the ramp axis, in node-local pixels. */
export function progressiveBlurPointAt(axis: ProgressiveBlurAxis, t: number): Vector {
  return { x: axis.x0 + (axis.x1 - axis.x0) * t, y: axis.y0 + (axis.y1 - axis.y0) * t }
}
