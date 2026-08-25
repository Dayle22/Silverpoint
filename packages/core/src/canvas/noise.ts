import type { Canvas, RuntimeEffect, Shader } from 'canvaskit-wasm'
import type { Effect } from '@open-pencil/scene-graph'

import { figmaBlendModeToSkia } from './blend'
import type { SkiaRenderer } from './renderer'

const MAX_PROGRAMS = 32

export function hasVisibleNoise(effects: readonly Effect[] | undefined | null): boolean {
  if (!effects) return false
  return effects.some((e) => e.visible && e.type === 'NOISE')
}

export function visibleNoise(effects: readonly Effect[] | undefined | null): Effect[] {
  if (!effects) return []
  return effects.filter((e) => e.visible && e.type === 'NOISE')
}

const NOISE_SKSL = `
uniform half4 u_color;
uniform half u_density;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

half4 main(float2 coords) {
  float scale = max(1.0, u_density);
  float n = hash(floor(coords / scale));
  return half4(u_color.rgb * n, u_color.a * n);
}
`

function uniforms(effect: Effect): Float32Array {
  return new Float32Array([
    effect.color.r,
    effect.color.g,
    effect.color.b,
    effect.color.a,
    Math.max(0.5, effect.radius || 1)
  ])
}

export function prepareNoiseLayer(
  renderer: SkiaRenderer,
  canvas: Canvas,
  bounds: Float32Array,
  effects: readonly Effect[]
): (() => void) | null {
  const noiseEffects = visibleNoise(effects)
  if (noiseEffects.length === 0) return null

  const key = 'NOISE_V1'
  let runtimeEffect: RuntimeEffect | null = renderer.noiseRuntimeEffects.get(key) ?? null
  if (!runtimeEffect) {
    runtimeEffect = renderer.ck.RuntimeEffect.Make(NOISE_SKSL)
    if (!runtimeEffect) {
      console.error('Unable to compile noise runtime effect')
      return null
    }
    renderer.noiseRuntimeEffects.set(key, runtimeEffect)
    while (renderer.noiseRuntimeEffects.size > MAX_PROGRAMS) {
      const oldest = renderer.noiseRuntimeEffects.keys().next().value
      if (!oldest) break
      renderer.noiseRuntimeEffects.get(oldest)?.delete()
      renderer.noiseRuntimeEffects.delete(oldest)
    }
  }

  canvas.saveLayer(undefined, bounds)

  return () => {
    for (const noiseEffect of noiseEffects) {
      const shader: Shader = runtimeEffect.makeShader(uniforms(noiseEffect))
      const paint = new renderer.ck.Paint()
      paint.setShader(shader)
      paint.setBlendMode(figmaBlendModeToSkia(renderer.ck, noiseEffect.blendMode))
      canvas.drawRect(bounds, paint)
      shader.delete()
      paint.delete()
    }
    canvas.restore()
  }
}
