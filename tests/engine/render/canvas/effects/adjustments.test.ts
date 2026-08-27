import { describe, expect, it } from 'bun:test'
import {
  buildAdjustmentSkSL,
  buildUniformsForEffects,
  hasVisibleExtendedEffects,
  isExtendedEffect,
  MAX_PROGRAMS
} from '@open-pencil/core/canvas/adjustments'
import {
  createBrightnessContrastEffect,
  createCurvesEffect,
  createExposureEffect,
  createGlassEffect,
  createHueSaturationEffect,
  createNoiseEffect,
  createSaturationEffect,
  createTextureEffect,
  createVibranceEffect
} from '@open-pencil/scene-graph/node-defaults'

describe('CanvasKit Extended Effects & Adjustments Pipeline', () => {
  it('identifies extended effects correctly', () => {
    expect(isExtendedEffect(createBrightnessContrastEffect())).toBe(true)
    expect(isExtendedEffect(createHueSaturationEffect())).toBe(true)
    expect(isExtendedEffect(createExposureEffect())).toBe(true)
    expect(isExtendedEffect(createVibranceEffect())).toBe(true)
    expect(isExtendedEffect(createSaturationEffect())).toBe(true)
    expect(isExtendedEffect(createCurvesEffect())).toBe(true)
    expect(isExtendedEffect(createNoiseEffect())).toBe(true)
    expect(isExtendedEffect(createTextureEffect())).toBe(true)
    expect(isExtendedEffect(createGlassEffect())).toBe(true)
  })

  it('detects visible extended effects in a stack', () => {
    const effects = [
      { ...createBrightnessContrastEffect(), visible: false },
      { ...createNoiseEffect(), visible: true }
    ]
    expect(hasVisibleExtendedEffects(effects)).toBe(true)

    const hiddenEffects = [
      { ...createBrightnessContrastEffect(), visible: false },
      { ...createNoiseEffect(), visible: false }
    ]
    expect(hasVisibleExtendedEffects(hiddenEffects)).toBe(false)
  })

  it('generates valid SkSL containing all active effect blocks', () => {
    const active = [
      createBrightnessContrastEffect(10, 20),
      createHueSaturationEffect(45, 20),
      createExposureEffect(15),
      createVibranceEffect(30),
      createCurvesEffect(1.2),
      createNoiseEffect(25, 42),
      createTextureEffect('CANVAS', 150),
      createGlassEffect(35, 15, 10)
    ]
    const sksl = buildAdjustmentSkSL(active)

    expect(sksl).toContain('u_brightness_0')
    expect(sksl).toContain('u_contrast_0')
    expect(sksl).toContain('u_hue_1')
    expect(sksl).toContain('u_exposure_2')
    expect(sksl).toContain('u_vibrance_3')
    expect(sksl).toContain('u_gamma_4')
    expect(sksl).toContain('u_noise_density_5')
    expect(sksl).toContain('u_tex_type_6')
    expect(sksl).toContain('u_glass_refr_7')
    expect(sksl).toContain('vec4 main(vec4 src, vec4 dst)')
  })

  it('builds correct uniforms buffer for mixed adjustments', () => {
    const effects = [
      createBrightnessContrastEffect(20, -10),
      createExposureEffect(50),
      createGlassEffect(30, 20, 10)
    ]
    const uniforms = buildUniformsForEffects(effects)
    expect(uniforms).toBeInstanceOf(Float32Array)
    expect(uniforms.length).toBeGreaterThan(0)
    expect(uniforms[0]).toBe(20)
    expect(uniforms[1]).toBe(-10)
    expect(uniforms[2]).toBe(50)
  })

  it('maintains maximum cache limit configuration', () => {
    expect(MAX_PROGRAMS).toBe(32)
  })
})
