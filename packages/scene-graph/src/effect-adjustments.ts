export type AdjustmentType = 'BRIGHTNESS_CONTRAST' | 'SATURATION' | 'CURVES'

export type AdjustmentInput =
  | { type: 'BRIGHTNESS_CONTRAST'; brightness?: number; contrast?: number }
  | { type: 'SATURATION'; saturation?: number }
  | { type: 'CURVES'; gamma?: number }

export type NormalisedAdjustment =
  | { type: 'BRIGHTNESS_CONTRAST'; brightness: number; contrast: number }
  | { type: 'SATURATION'; saturation: number }
  | { type: 'CURVES'; gamma: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

export function normaliseAdjustment(adjustment: AdjustmentInput): NormalisedAdjustment {
  switch (adjustment.type) {
    case 'BRIGHTNESS_CONTRAST':
      return {
        type: adjustment.type,
        brightness: clamp(adjustment.brightness ?? 0, -100, 100),
        contrast: clamp(adjustment.contrast ?? 0, -100, 100)
      }
    case 'SATURATION':
      return { type: adjustment.type, saturation: clamp(adjustment.saturation ?? 100, 0, 200) }
    case 'CURVES':
      return { type: adjustment.type, gamma: clamp(adjustment.gamma ?? 1, 0.1, 3) }
  }
  throw new Error('Unsupported adjustment type')
}

export function applyAdjustmentRgb(
  rgb: readonly [number, number, number],
  adjustments: readonly AdjustmentInput[]
): [number, number, number] {
  let [r, g, b] = rgb
  for (const raw of adjustments) {
    const adjustment = normaliseAdjustment(raw)
    if (adjustment.type === 'BRIGHTNESS_CONTRAST') {
      const brightness = adjustment.brightness / 100
      const contrast = Math.max(0, 1 + adjustment.contrast / 100)
      r = clamp((r - 0.5) * contrast + 0.5 + brightness, 0, 1)
      g = clamp((g - 0.5) * contrast + 0.5 + brightness, 0, 1)
      b = clamp((b - 0.5) * contrast + 0.5 + brightness, 0, 1)
    } else if (adjustment.type === 'SATURATION') {
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
      const saturation = adjustment.saturation / 100
      r = clamp(luminance + (r - luminance) * saturation, 0, 1)
      g = clamp(luminance + (g - luminance) * saturation, 0, 1)
      b = clamp(luminance + (b - luminance) * saturation, 0, 1)
    } else {
      const exponent = 1 / adjustment.gamma
      r = clamp(r, 0, 1) ** exponent
      g = clamp(g, 0, 1) ** exponent
      b = clamp(b, 0, 1) ** exponent
    }
  }
  return [r, g, b]
}
