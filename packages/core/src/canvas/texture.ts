import type { Effect, EffectTextureType } from '@open-pencil/scene-graph'
import { isTextureEffect } from '@open-pencil/scene-graph/node-defaults'

export { isTextureEffect }

export const TEXTURE_SKSL_HELPERS = `
float textureHash21(vec2 p, float seed) {
  p = fract(p * vec2(123.34, 456.21) + vec2(seed * 0.1337, seed * 0.7123));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`

export function textureTypeToIndex(type?: EffectTextureType): number {
  switch (type) {
    case 'CANVAS':
      return 1
    case 'PAPER':
      return 2
    case 'CROSSHATCH':
      return 3
    default:
      return 0
  }
}

export function generateTextureSkSL(index: number): string {
  return `
  {
    float scale = max(1.0, u_tex_scale_${index});
    float tType = u_tex_type_${index};
    float pattern = 0.0;
    if (tType < 0.5) {
      pattern = (textureHash21(col.rg * (1000.0 / scale), 42.0) - 0.5) * 0.3;
    } else if (tType < 1.5) {
      pattern = (sin(col.r * (200.0 / scale) * 3.14159) * cos(col.g * (200.0 / scale) * 3.14159)) * 0.15;
    } else if (tType < 2.5) {
      float f1 = textureHash21(col.gb * (500.0 / scale), 17.0);
      float f2 = textureHash21(col.rg * (250.0 / scale), 29.0);
      pattern = ((f1 + f2) * 0.5 - 0.5) * 0.2;
    } else {
      float angle1 = sin((col.r + col.g) * (150.0 / scale) * 3.14159);
      float angle2 = cos((col.r - col.g) * (150.0 / scale) * 3.14159);
      pattern = (angle1 * angle2) * 0.18;
    }
    col = clamp(col + vec3(pattern), 0.0, 1.0);
  }
`
}

export function getTextureUniformDeclarations(index: number): string {
  return `uniform float u_tex_type_${index};
uniform float u_tex_scale_${index};
`
}

export function getTextureUniformValues(effect: Effect): number[] {
  const typeIndex = textureTypeToIndex(effect.textureType)
  const scale = effect.textureScale ?? 100
  return [typeIndex, scale]
}
