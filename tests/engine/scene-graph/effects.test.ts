import { describe, expect, test } from 'bun:test'

import {
  clamp,
  clampDispersion,
  clampExposure,
  clampFrosting,
  clampHue,
  clampNoiseDensity,
  clampRefraction,
  clampVibrance,
  createBrightnessContrastEffect,
  createCurvesEffect,
  createExposureEffect,
  createGlassEffect,
  createHueSaturationEffect,
  createInnerGlowEffect,
  createNoiseEffect,
  createSaturationEffect,
  createTextureEffect,
  createVibranceEffect,
  isAdjustmentEffect,
  isFigmaNativeEffect,
  isGlassEffect,
  isInnerGlowEffect,
  isNoiseEffect,
  isTextureEffect,
  SceneGraph,
  type Effect,
  type EffectTextureType,
  type EffectType
} from '@open-pencil/scene-graph'

describe('Scene-Graph Effect Constructor Factories', () => {
  test('createBrightnessContrastEffect returns default values', () => {
    const effect = createBrightnessContrastEffect()
    expect(effect.type).toBe('BRIGHTNESS_CONTRAST')
    expect(effect.brightness).toBe(0)
    expect(effect.contrast).toBe(0)
    expect(effect.visible).toBe(true)
    expect(effect.radius).toBe(0)
    expect(effect.spread).toBe(0)
    expect(effect.offset).toEqual({ x: 0, y: 0 })
  })

  test('createBrightnessContrastEffect accepts custom values', () => {
    const effect = createBrightnessContrastEffect(25, -15)
    expect(effect.type).toBe('BRIGHTNESS_CONTRAST')
    expect(effect.brightness).toBe(25)
    expect(effect.contrast).toBe(-15)
  })

  test('createHueSaturationEffect returns default values', () => {
    const effect = createHueSaturationEffect()
    expect(effect.type).toBe('HUE_SATURATION')
    expect(effect.hue).toBe(0)
    expect(effect.saturation).toBe(0)
    expect(effect.visible).toBe(true)
    expect(effect.radius).toBe(0)
    expect(effect.spread).toBe(0)
    expect(effect.offset).toEqual({ x: 0, y: 0 })
  })

  test('createHueSaturationEffect accepts custom values', () => {
    const effect = createHueSaturationEffect(45, -30)
    expect(effect.type).toBe('HUE_SATURATION')
    expect(effect.hue).toBe(45)
    expect(effect.saturation).toBe(-30)
  })

  test('createExposureEffect returns default values', () => {
    const effect = createExposureEffect()
    expect(effect.type).toBe('EXPOSURE')
    expect(effect.exposure).toBe(0)
    expect(effect.visible).toBe(true)
    expect(effect.radius).toBe(0)
    expect(effect.spread).toBe(0)
    expect(effect.offset).toEqual({ x: 0, y: 0 })
  })

  test('createExposureEffect accepts custom values', () => {
    const effect = createExposureEffect(1.5)
    expect(effect.type).toBe('EXPOSURE')
    expect(effect.exposure).toBe(1.5)
  })

  test('createVibranceEffect returns default values', () => {
    const effect = createVibranceEffect()
    expect(effect.type).toBe('VIBRANCE')
    expect(effect.vibrance).toBe(0)
    expect(effect.visible).toBe(true)
    expect(effect.radius).toBe(0)
    expect(effect.spread).toBe(0)
    expect(effect.offset).toEqual({ x: 0, y: 0 })
  })

  test('createVibranceEffect accepts custom values', () => {
    const effect = createVibranceEffect(50)
    expect(effect.type).toBe('VIBRANCE')
    expect(effect.vibrance).toBe(50)
  })

  test('createNoiseEffect returns default values', () => {
    const effect = createNoiseEffect()
    expect(effect.type).toBe('NOISE')
    expect(effect.noiseDensity).toBe(20)
    expect(effect.noiseSeed).toBe(1)
    expect(effect.radius).toBe(1)
    expect(effect.visible).toBe(true)
  })

  test('createNoiseEffect accepts custom density and seed', () => {
    const effect = createNoiseEffect(65, 42)
    expect(effect.type).toBe('NOISE')
    expect(effect.noiseDensity).toBe(65)
    expect(effect.noiseSeed).toBe(42)
  })

  test('createTextureEffect returns default values', () => {
    const effect = createTextureEffect()
    expect(effect.type).toBe('TEXTURE')
    expect(effect.textureType).toBe('GRAIN')
    expect(effect.textureScale).toBe(100)
    expect(effect.visible).toBe(true)
  })

  test('createTextureEffect accepts custom texture types and scale', () => {
    const types: EffectTextureType[] = ['CANVAS', 'PAPER', 'CROSSHATCH', 'GRAIN']
    for (const t of types) {
      const effect = createTextureEffect(t, 200)
      expect(effect.type).toBe('TEXTURE')
      expect(effect.textureType).toBe(t)
      expect(effect.textureScale).toBe(200)
    }
  })

  test('createGlassEffect returns default values', () => {
    const effect = createGlassEffect()
    expect(effect.type).toBe('GLASS')
    expect(effect.refraction).toBe(20)
    expect(effect.frosting).toBe(10)
    expect(effect.dispersion).toBe(0)
    expect(effect.visible).toBe(true)
  })

  test('createGlassEffect accepts custom values', () => {
    const effect = createGlassEffect(45, 80, 15)
    expect(effect.type).toBe('GLASS')
    expect(effect.refraction).toBe(45)
    expect(effect.frosting).toBe(80)
    expect(effect.dispersion).toBe(15)
  })

  test('createSaturationEffect and createCurvesEffect', () => {
    const sat = createSaturationEffect(120)
    expect(sat.type).toBe('SATURATION')
    expect(sat.saturation).toBe(120)

    const curves = createCurvesEffect(1.2)
    expect(curves.type).toBe('CURVES')
    expect(curves.gamma).toBe(1.2)

    const glow = createInnerGlowEffect()
    expect(glow.type).toBe('INNER_SHADOW')
    expect(isInnerGlowEffect(glow)).toBe(true)
  })
})

describe('Scene-Graph Effect Type Guards', () => {
  const allTypes: EffectType[] = [
    'DROP_SHADOW',
    'INNER_SHADOW',
    'LAYER_BLUR',
    'BACKGROUND_BLUR',
    'FOREGROUND_BLUR',
    'BRIGHTNESS_CONTRAST',
    'HUE_SATURATION',
    'EXPOSURE',
    'VIBRANCE',
    'NOISE',
    'TEXTURE',
    'GLASS',
    'SATURATION',
    'CURVES'
  ]

  function makeSampleEffect(type: EffectType): Effect {
    return {
      type,
      color: { r: 0, g: 0, b: 0, a: 1 },
      offset: { x: 0, y: 0 },
      radius: 0,
      spread: 0,
      visible: true
    }
  }

  test('isAdjustmentEffect correctly identifies adjustment types', () => {
    const adjustmentTypes: EffectType[] = [
      'BRIGHTNESS_CONTRAST',
      'HUE_SATURATION',
      'EXPOSURE',
      'VIBRANCE',
      'SATURATION',
      'CURVES'
    ]

    for (const type of allTypes) {
      const effect = makeSampleEffect(type)
      const expected = adjustmentTypes.includes(type)
      expect(isAdjustmentEffect(effect)).toBe(expected)
    }
  })

  test('isNoiseEffect correctly identifies NOISE', () => {
    for (const type of allTypes) {
      const effect = makeSampleEffect(type)
      expect(isNoiseEffect(effect)).toBe(type === 'NOISE')
    }
  })

  test('isTextureEffect correctly identifies TEXTURE', () => {
    for (const type of allTypes) {
      const effect = makeSampleEffect(type)
      expect(isTextureEffect(effect)).toBe(type === 'TEXTURE')
    }
  })

  test('isGlassEffect correctly identifies GLASS', () => {
    for (const type of allTypes) {
      const effect = makeSampleEffect(type)
      expect(isGlassEffect(effect)).toBe(type === 'GLASS')
    }
  })

  test('isFigmaNativeEffect identifies native Figma effects only', () => {
    const nativeTypes: EffectType[] = [
      'DROP_SHADOW',
      'INNER_SHADOW',
      'LAYER_BLUR',
      'BACKGROUND_BLUR',
      'FOREGROUND_BLUR'
    ]

    for (const type of allTypes) {
      const effect = makeSampleEffect(type)
      const expected = nativeTypes.includes(type)
      expect(isFigmaNativeEffect(effect)).toBe(expected)
    }
  })

  test('isInnerGlowEffect checks offset is (0, 0)', () => {
    const glow = createInnerGlowEffect()
    expect(isInnerGlowEffect(glow)).toBe(true)

    const offsetShadow: Effect = {
      ...glow,
      offset: { x: 2, y: 2 }
    }
    expect(isInnerGlowEffect(offsetShadow)).toBe(false)
  })
})

describe('Scene-Graph Clamping and Normalisation Helpers', () => {
  test('clamp restricts number to range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  test('clampHue restricts between -180 and 180', () => {
    expect(clampHue(-200)).toBe(-180)
    expect(clampHue(200)).toBe(180)
    expect(clampHue(45)).toBe(45)
    expect(clampHue(0)).toBe(0)
  })

  test('clampExposure restricts between -100 and 100', () => {
    expect(clampExposure(-120)).toBe(-100)
    expect(clampExposure(150)).toBe(100)
    expect(clampExposure(3.5)).toBe(3.5)
  })

  test('clampVibrance restricts between -100 and 100', () => {
    expect(clampVibrance(-150)).toBe(-100)
    expect(clampVibrance(120)).toBe(100)
    expect(clampVibrance(25)).toBe(25)
  })

  test('clampNoiseDensity restricts between 0 and 100', () => {
    expect(clampNoiseDensity(-10)).toBe(0)
    expect(clampNoiseDensity(110)).toBe(100)
    expect(clampNoiseDensity(50)).toBe(50)
  })

  test('clampRefraction, clampFrosting, clampDispersion restrict between 0 and 100', () => {
    expect(clampRefraction(-5)).toBe(0)
    expect(clampRefraction(105)).toBe(100)
    expect(clampRefraction(40)).toBe(40)

    expect(clampFrosting(-15)).toBe(0)
    expect(clampFrosting(150)).toBe(100)
    expect(clampFrosting(75)).toBe(75)

    expect(clampDispersion(-1)).toBe(0)
    expect(clampDispersion(101)).toBe(100)
    expect(clampDispersion(15)).toBe(15)
  })
})

describe('SceneGraph Node Effects Integration', () => {
  test('updates node with expanded effect types', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('FRAME', page.id, { name: 'EffectTestCard', width: 400, height: 300 })

    const effects: Effect[] = [
      createBrightnessContrastEffect(10, 20),
      createHueSaturationEffect(30, 40),
      createExposureEffect(0.5),
      createVibranceEffect(25),
      createNoiseEffect(35, 7),
      createTextureEffect('CANVAS', 150),
      createGlassEffect(30, 50, 10)
    ]

    graph.updateNode(node.id, { effects })

    const updated = graph.getNode(node.id)
    expect(updated).toBeDefined()
    expect(updated?.effects).toHaveLength(7)
    expect(updated?.effects[0].type).toBe('BRIGHTNESS_CONTRAST')
    expect(updated?.effects[0].brightness).toBe(10)
    expect(updated?.effects[1].type).toBe('HUE_SATURATION')
    expect(updated?.effects[1].hue).toBe(30)
    expect(updated?.effects[2].type).toBe('EXPOSURE')
    expect(updated?.effects[2].exposure).toBe(0.5)
    expect(updated?.effects[3].type).toBe('VIBRANCE')
    expect(updated?.effects[3].vibrance).toBe(25)
    expect(updated?.effects[4].type).toBe('NOISE')
    expect(updated?.effects[4].noiseDensity).toBe(35)
    expect(updated?.effects[4].noiseSeed).toBe(7)
    expect(updated?.effects[5].type).toBe('TEXTURE')
    expect(updated?.effects[5].textureType).toBe('CANVAS')
    expect(updated?.effects[5].textureScale).toBe(150)
    expect(updated?.effects[6].type).toBe('GLASS')
    expect(updated?.effects[6].refraction).toBe(30)
    expect(updated?.effects[6].frosting).toBe(50)
    expect(updated?.effects[6].dispersion).toBe(10)
  })

  test('clones node preserving all expanded effect fields', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Original',
      effects: [
        createNoiseEffect(45, 99),
        createTextureEffect('PAPER', 120),
        createGlassEffect(60, 40, 20)
      ]
    })

    const cloned = graph.cloneTree(node.id, page.id)
    expect(cloned).toBeDefined()
    expect(cloned?.effects).toHaveLength(3)

    // Verify deep copy / fields
    expect(cloned?.effects[0].noiseDensity).toBe(45)
    expect(cloned?.effects[0].noiseSeed).toBe(99)
    expect(cloned?.effects[1].textureType).toBe('PAPER')
    expect(cloned?.effects[1].textureScale).toBe(120)
    expect(cloned?.effects[2].refraction).toBe(60)
    expect(cloned?.effects[2].frosting).toBe(40)
    expect(cloned?.effects[2].dispersion).toBe(20)

    // Verify mutating clone does not mutate original
    if (cloned) {
      cloned.effects[0].noiseDensity = 10
      expect(node.effects[0].noiseDensity).toBe(45)
    }
  })
})
