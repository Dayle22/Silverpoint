import type { Effect } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { clampNoiseDensity, isNoiseEffect } from '@open-pencil/scene-graph/node-defaults'

export { clampNoiseDensity, isNoiseEffect }

export const NOISE_SKSL_HELPERS = `
float noiseHash21(vec2 p, float seed) {
  p = fract(p * vec2(123.34, 456.21) + vec2(seed * 0.1337, seed * 0.7123));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`

export function generateNoiseSkSL(index: number): string {
  return `
  {
    float density = u_noise_density_${index} / 100.0;
    float seed = u_noise_seed_${index};
    vec4 tint = u_noise_color_${index};
    float n = (noiseHash21(col.rg * 1000.0 + col.b * 100.0, seed) - 0.5) * 2.0;
    vec3 grain = tint.rgb * (n * density);
    col = clamp(col + grain * tint.a, 0.0, 1.0);
  }
`
}

export function getNoiseUniformDeclarations(index: number): string {
  return `uniform float u_noise_density_${index};
uniform float u_noise_seed_${index};
uniform vec4 u_noise_color_${index};
`
}

export function getNoiseUniformValues(effect: Effect): number[] {
  const density = clampNoiseDensity(effect.noiseDensity ?? 20)
  const seed = effect.noiseSeed ?? 1
  const color = effect.color ?? BLACK
  return [density, seed, color.r, color.g, color.b, color.a]
}
