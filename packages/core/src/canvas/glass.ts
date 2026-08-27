import type { Effect } from '@open-pencil/scene-graph'
import {
  clampDispersion,
  clampFrosting,
  clampRefraction,
  isGlassEffect
} from '@open-pencil/scene-graph/node-defaults'

export { clampDispersion, clampFrosting, clampRefraction, isGlassEffect }

export const GLASS_SKSL_HELPERS = `
float glassHash21(vec2 p, float seed) {
  p = fract(p * vec2(123.34, 456.21) + vec2(seed * 0.1337, seed * 0.7123));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`

export function generateGlassSkSL(index: number): string {
  return `
  {
    float refr = u_glass_refr_${index} / 100.0;
    float frost = u_glass_frost_${index} / 100.0;
    float disp = u_glass_disp_${index} / 100.0;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float highlight = pow(1.0 - abs(luma - 0.5) * 2.0, 3.0) * refr * 0.25;
    float frostGrain = (glassHash21(col.rb * 800.0, 99.0) - 0.5) * frost * 0.15;
    vec3 dispTint = vec3(disp * 0.05, 0.0, -disp * 0.05);
    col = clamp(col + vec3(highlight + frostGrain) + dispTint, 0.0, 1.0);
  }
`
}

export function getGlassUniformDeclarations(index: number): string {
  return `uniform float u_glass_refr_${index};
uniform float u_glass_frost_${index};
uniform float u_glass_disp_${index};
`
}

export function getGlassUniformValues(effect: Effect): number[] {
  const refr = clampRefraction(effect.refraction ?? 20)
  const frost = clampFrosting(effect.frosting ?? 10)
  const disp = clampDispersion(effect.dispersion ?? 0)
  return [refr, frost, disp]
}
