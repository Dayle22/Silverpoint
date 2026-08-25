import type { Blender, Canvas, RuntimeEffect } from 'canvaskit-wasm'
import { normaliseAdjustment, type Effect, type NormalisedAdjustment } from '@open-pencil/scene-graph'
import type { SkiaRenderer } from './renderer'

const MAX_PROGRAMS = 32

export function hasVisibleAdjustments(effects: readonly Effect[] | undefined | null): boolean {
  if (!effects) return false
  return effects.some(
    (e) =>
      e.visible &&
      (e.type === 'BRIGHTNESS_CONTRAST' || e.type === 'SATURATION' || e.type === 'CURVES')
  )
}

export function visibleAdjustments(effects: readonly Effect[] | undefined | null): NormalisedAdjustment[] {
  if (!effects) return []
  return effects.flatMap((effect) => {
    if (!effect.visible) return []
    if (effect.type === 'BRIGHTNESS_CONTRAST') return [normaliseAdjustment({ type: effect.type, brightness: effect.brightness, contrast: effect.contrast })]
    if (effect.type === 'SATURATION') return [normaliseAdjustment({ type: effect.type, saturation: effect.saturation })]
    if (effect.type === 'CURVES') return [normaliseAdjustment({ type: effect.type, gamma: effect.gamma })]
    return []
  })
}

function programKey(adjustments: readonly NormalisedAdjustment[]): string {
  return adjustments.map((adjustment) => adjustment.type).join('|')
}

function makeSkSL(adjustments: readonly NormalisedAdjustment[]): string {
  const uniforms: string[] = []
  const steps: string[] = []
  adjustments.forEach((adjustment, index) => {
    if (adjustment.type === 'BRIGHTNESS_CONTRAST') {
      uniforms.push(`uniform half brightness${index};`, `uniform half contrast${index};`)
      steps.push(`rgb = clamp((rgb - 0.5) * max(0.0, 1.0 + contrast${index} / 100.0) + 0.5 + brightness${index} / 100.0, 0.0, 1.0);`)
    } else if (adjustment.type === 'SATURATION') {
      uniforms.push(`uniform half saturation${index};`)
      steps.push(`half luma${index} = dot(rgb, half3(0.2126, 0.7152, 0.0722)); rgb = clamp(mix(half3(luma${index}), rgb, saturation${index} / 100.0), 0.0, 1.0);`)
    } else {
      uniforms.push(`uniform half gamma${index};`)
      steps.push(`rgb = pow(clamp(rgb, 0.0, 1.0), half3(1.0 / gamma${index}));`)
    }
  })
  return `${uniforms.join('\n')}\nhalf4 main(half4 src, half4 dst) {\n  half alpha = src.a;\n  half3 rgb = alpha > 0.0001 ? src.rgb / alpha : half3(0.0);\n  ${steps.join('\n  ')}\n  half3 outRgb = rgb * alpha + dst.rgb * (1.0 - alpha);\n  return half4(outRgb, alpha + dst.a * (1.0 - alpha));\n}`
}

function uniforms(adjustments: readonly NormalisedAdjustment[]): Float32Array {
  const values: number[] = []
  adjustments.forEach((adjustment) => {
    if (adjustment.type === 'BRIGHTNESS_CONTRAST') values.push(adjustment.brightness, adjustment.contrast)
    else if (adjustment.type === 'SATURATION') values.push(adjustment.saturation)
    else values.push(adjustment.gamma)
  })
  return new Float32Array(values)
}

export function prepareAdjustmentLayer(
  renderer: SkiaRenderer,
  canvas: Canvas,
  bounds: Float32Array,
  effects: readonly Effect[]
): (() => void) | null {
  const adjustments = visibleAdjustments(effects)
  if (adjustments.length === 0) return null
  const key = programKey(adjustments)
  let effect: RuntimeEffect | null = renderer.adjustmentRuntimeEffects.get(key) ?? null
  if (!effect) {
    effect = renderer.ck.RuntimeEffect.MakeForBlender(makeSkSL(adjustments))
    if (!effect) {
      console.error(`Unable to compile adjustment blender: ${key}`)
      return null
    }
    renderer.adjustmentRuntimeEffects.set(key, effect)
    while (renderer.adjustmentRuntimeEffects.size > MAX_PROGRAMS) {
      const oldest = renderer.adjustmentRuntimeEffects.keys().next().value
      if (!oldest) break
      renderer.adjustmentRuntimeEffects.get(oldest)?.delete()
      renderer.adjustmentRuntimeEffects.delete(oldest)
    }
  }
  const blender: Blender = effect.makeBlender(uniforms(adjustments))
  const paint = new renderer.ck.Paint()
  paint.setBlender(blender)
  canvas.saveLayer(paint, bounds)
  return () => {
    canvas.restore()
    blender.delete()
    paint.delete()
  }
}
