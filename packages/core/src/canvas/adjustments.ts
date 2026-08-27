import type { Canvas, RuntimeEffect } from 'canvaskit-wasm'

import type { Effect } from '@open-pencil/scene-graph'
import {
  clamp,
  clampExposure,
  clampHue,
  clampVibrance,
  isAdjustmentEffect as isSceneGraphAdjustmentEffect,
  isGlassEffect,
  isNoiseEffect,
  isTextureEffect
} from '@open-pencil/scene-graph/node-defaults'

import {
  generateGlassSkSL,
  getGlassUniformDeclarations,
  getGlassUniformValues,
  GLASS_SKSL_HELPERS
} from './glass'
import {
  generateNoiseSkSL,
  getNoiseUniformDeclarations,
  getNoiseUniformValues,
  NOISE_SKSL_HELPERS
} from './noise'
import type { SkiaRenderer } from './renderer'
import {
  generateTextureSkSL,
  getTextureUniformDeclarations,
  getTextureUniformValues,
  TEXTURE_SKSL_HELPERS
} from './texture'

export const MAX_PROGRAMS = 32

export type ExtendedEffectType =
  | 'BRIGHTNESS_CONTRAST'
  | 'HUE_SATURATION'
  | 'EXPOSURE'
  | 'VIBRANCE'
  | 'SATURATION'
  | 'CURVES'
  | 'NOISE'
  | 'TEXTURE'
  | 'GLASS'

export function isExtendedEffect(effect: Effect): boolean {
  return (
    isSceneGraphAdjustmentEffect(effect) ||
    isNoiseEffect(effect) ||
    isTextureEffect(effect) ||
    isGlassEffect(effect)
  )
}

export function hasVisibleExtendedEffects(effects?: Effect[]): boolean {
  if (!effects || effects.length === 0) return false
  return effects.some((e) => e.visible && isExtendedEffect(e))
}

const COMMON_SKSL_HELPERS = `
vec3 color2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2color(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`

export function buildAdjustmentSkSL(effects: Effect[]): string {
  let uniforms = ''
  let body = ''
  let hasNoise = false
  let hasTexture = false
  let hasGlass = false

  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index]
    switch (effect.type) {
      case 'BRIGHTNESS_CONTRAST':
        uniforms += `uniform float u_brightness_${index};\nuniform float u_contrast_${index};\n`
        body += `
  {
    float b = u_brightness_${index} / 100.0;
    float c = u_contrast_${index} / 100.0;
    float s = max(0.0, 1.0 + c);
    col = clamp((col - 0.5) * s + 0.5 + b, 0.0, 1.0);
  }
`
        break

      case 'HUE_SATURATION':
        uniforms += `uniform float u_hue_${index};\nuniform float u_sat_${index};\n`
        body += `
  {
    vec3 hsv = color2hsv(col);
    hsv.x = fract(hsv.x + (u_hue_${index} / 360.0));
    if (hsv.x < 0.0) { hsv.x += 1.0; }
    hsv.y = clamp(hsv.y * u_sat_${index}, 0.0, 1.0);
    col = hsv2color(hsv);
  }
`
        break

      case 'EXPOSURE':
        uniforms += `uniform float u_exposure_${index};\n`
        body += `
  {
    float expFactor = pow(2.0, u_exposure_${index} / 25.0);
    col = clamp(col * expFactor, 0.0, 1.0);
  }
`
        break

      case 'VIBRANCE':
        uniforms += `uniform float u_vibrance_${index};\n`
        body += `
  {
    float maxV = max(col.r, max(col.g, col.b));
    float minV = min(col.r, min(col.g, col.b));
    float sat = maxV - minV;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float v = u_vibrance_${index} / 100.0;
    float amt = v * (1.0 - sat);
    col = clamp(mix(vec3(luma), col, max(0.0, 1.0 + amt)), 0.0, 1.0);
  }
`
        break

      case 'SATURATION':
        uniforms += `uniform float u_saturation_${index};\n`
        body += `
  {
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(luma), col, max(0.0, u_saturation_${index} / 100.0)), 0.0, 1.0);
  }
`
        break

      case 'CURVES':
        uniforms += `uniform float u_gamma_${index};\n`
        body += `
  {
    float g = max(0.001, u_gamma_${index});
    col = clamp(pow(clamp(col, 0.0, 1.0), vec3(1.0 / g)), 0.0, 1.0);
  }
`
        break

      case 'NOISE':
        hasNoise = true
        uniforms += getNoiseUniformDeclarations(index)
        body += generateNoiseSkSL(index)
        break

      case 'TEXTURE':
        hasTexture = true
        uniforms += getTextureUniformDeclarations(index)
        body += generateTextureSkSL(index)
        break

      case 'GLASS':
        hasGlass = true
        uniforms += getGlassUniformDeclarations(index)
        body += generateGlassSkSL(index)
        break
    }
  }

  let helperCode = COMMON_SKSL_HELPERS
  if (hasNoise) helperCode += NOISE_SKSL_HELPERS
  if (hasTexture) helperCode += TEXTURE_SKSL_HELPERS
  if (hasGlass) helperCode += GLASS_SKSL_HELPERS

  return `
${helperCode}
${uniforms}

vec4 main(vec4 src, vec4 dst) {
  if (src.a <= 0.0) {
    return dst;
  }
  vec3 col = src.rgb / src.a;
${body}
  col = clamp(col, 0.0, 1.0);
  vec4 adjustedSrc = vec4(col * src.a, src.a);
  return adjustedSrc + dst * (1.0 - adjustedSrc.a);
}
`
}

function getHueSaturationMultiplier(sat?: number): number {
  if (sat === undefined) return 1.0
  if (sat > 100) return Math.max(0, sat / 100)
  if (sat < 0) return Math.max(0, 1 + sat / 100)
  return Math.max(0, 1 + sat / 100)
}

export function buildUniformsForEffects(effects: Effect[]): Float32Array {
  const values: number[] = []

  for (const effect of effects) {
    switch (effect.type) {
      case 'BRIGHTNESS_CONTRAST':
        values.push(
          clamp(effect.brightness ?? 0, -100, 100),
          clamp(effect.contrast ?? 0, -100, 100)
        )
        break

      case 'HUE_SATURATION':
        values.push(clampHue(effect.hue ?? 0), getHueSaturationMultiplier(effect.saturation))
        break

      case 'EXPOSURE':
        values.push(clampExposure(effect.exposure ?? 0))
        break

      case 'VIBRANCE':
        values.push(clampVibrance(effect.vibrance ?? 0))
        break

      case 'SATURATION':
        values.push(clamp(effect.saturation ?? 100, 0, 200))
        break

      case 'CURVES':
        values.push(clamp(effect.gamma ?? 1, 0.1, 3))
        break

      case 'NOISE':
        values.push(...getNoiseUniformValues(effect))
        break

      case 'TEXTURE':
        values.push(...getTextureUniformValues(effect))
        break

      case 'GLASS':
        values.push(...getGlassUniformValues(effect))
        break
    }
  }

  return new Float32Array(values)
}

export function getOrCompileAdjustmentEffect(
  r: SkiaRenderer,
  effects: Effect[]
): RuntimeEffect | null {
  const activeEffects = effects.filter((e) => e.visible && isExtendedEffect(e))
  if (activeEffects.length === 0) return null

  const key = activeEffects.map((e) => e.type).join('+')
  let program = r.adjustmentRuntimeEffects.get(key)
  if (program) return program

  const sksl = buildAdjustmentSkSL(activeEffects)
  const ck = r.ck

  if (typeof ck.RuntimeEffect.MakeForBlender === 'function') {
    program = ck.RuntimeEffect.MakeForBlender(sksl)
  } else if (typeof ck.RuntimeEffect.Make === 'function') {
    program = ck.RuntimeEffect.Make(sksl)
  }

  if (!program) {
    return null
  }

  // Enforce bounded cache size with LRU eviction and deletion
  if (r.adjustmentRuntimeEffects.size >= MAX_PROGRAMS) {
    const oldestKey = r.adjustmentRuntimeEffects.keys().next().value
    if (oldestKey !== undefined) {
      const oldestProgram = r.adjustmentRuntimeEffects.get(oldestKey)
      oldestProgram?.delete()
      r.adjustmentRuntimeEffects.delete(oldestKey)
    }
  }

  r.adjustmentRuntimeEffects.set(key, program)
  return program
}

export function prepareAdjustmentLayer(
  r: SkiaRenderer,
  canvas: Canvas,
  bounds: Float32Array,
  effects: Effect[]
): (() => void) | null {
  const activeEffects = effects.filter((e) => e.visible && isExtendedEffect(e))
  if (activeEffects.length === 0) return null

  const program = getOrCompileAdjustmentEffect(r, activeEffects)
  if (!program) return null

  const uniforms = buildUniformsForEffects(activeEffects)
  const blender = program.makeBlender(uniforms)

  r.adjustmentLayerPaint.setBlender(blender)
  canvas.saveLayer(r.adjustmentLayerPaint, bounds)

  return () => {
    canvas.restore()
    blender.delete()
    r.adjustmentLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}
