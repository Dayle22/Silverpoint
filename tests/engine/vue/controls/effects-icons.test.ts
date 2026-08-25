import { describe, expect, test } from 'bun:test'

import {
  EFFECT_ICONS,
  EFFECT_TYPES,
  createInnerGlowEffect,
  effectControlType,
  effectIcon
} from '#vue/controls/effects/helpers'
import type { EffectControlType } from '#vue/controls/effects/helpers'

const ALL_EFFECT_TYPES: EffectControlType[] = [
  'DROP_SHADOW',
  'INNER_SHADOW',
  'INNER_GLOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR',
  'FOREGROUND_BLUR',
  'NOISE',
  'BRIGHTNESS_CONTRAST',
  'SATURATION',
  'CURVES'
]

describe('effect-type icons', () => {
  test('covers all 10 EffectControlType members exhaustively', () => {
    const keys = Object.keys(EFFECT_ICONS) as EffectControlType[]
    expect(keys.length).toBe(10)
    for (const type of ALL_EFFECT_TYPES) {
      expect(EFFECT_ICONS[type]).toBeDefined()
      expect(effectIcon(type)).toBeDefined()
      expect(EFFECT_TYPES).toContain(type)
    }
  })

  test('each effect type resolves to a unique icon component', () => {
    const icons = ALL_EFFECT_TYPES.map((type) => effectIcon(type))
    const uniqueIcons = new Set(icons)
    expect(uniqueIcons.size).toBe(ALL_EFFECT_TYPES.length)
  })

  test('drop shadow and inner shadow resolve to distinct components', () => {
    const dropShadowIcon = effectIcon('DROP_SHADOW')
    const innerShadowIcon = effectIcon('INNER_SHADOW')
    expect(dropShadowIcon).toBeDefined()
    expect(innerShadowIcon).toBeDefined()
    expect(dropShadowIcon).not.toBe(innerShadowIcon)
  })

  test('offset-based inner glow resolves to INNER_GLOW icon, distinct from INNER_SHADOW', () => {
    const innerGlowEffect = createInnerGlowEffect()
    const resolvedType = effectControlType(innerGlowEffect)
    expect(resolvedType).toBe('INNER_GLOW')

    const glowIcon = effectIcon(resolvedType)
    const shadowIcon = effectIcon('INNER_SHADOW')
    expect(glowIcon).toBe(EFFECT_ICONS.INNER_GLOW)
    expect(glowIcon).not.toBe(shadowIcon)
  })
})
