// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { CANVAS_BG_COLOR, CANVAS_BG_COLOR_DARK } from '@open-pencil/core/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import {
  applyNativeTheme,
  APP_THEME_SETTINGS,
  colorsEqual,
  markCanvasThemeCustom,
  normalizeThemeSetting,
  resolveTheme,
  resolveThemeCanvasColor
} from '@/app/shell/theme'

interface CapabilityConfig {
  permissions: unknown[]
}

describe('app theme contract', () => {
  test('contains the four explicit themes plus Auto', () => {
    expect(APP_THEME_SETTINGS).toEqual(['light', 'grey', 'dark', 'midnight'])
    expect(normalizeThemeSetting('auto')).toBe('auto')
    expect(normalizeThemeSetting('unknown')).toBe('dark')
  })

  test('resolves Auto from the operating-system preference only', () => {
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('grey', false)).toBe('grey')
    expect(resolveTheme('midnight', true)).toBe('midnight')
  })

  test('applies the resolved theme to native window chrome', async () => {
    const applied: string[] = []
    const setNativeTheme = async (theme: 'light' | 'dark') => {
      applied.push(theme)
    }

    await applyNativeTheme('light', setNativeTheme)
    await applyNativeTheme('grey', setNativeTheme)
    await applyNativeTheme('dark', setNativeTheme)
    await applyNativeTheme('midnight', setNativeTheme)

    expect(applied).toEqual(['light', 'dark', 'dark', 'dark'])
  })

  test('grants the native app-theme permission', async () => {
    const capabilityURL = new URL('../../../../desktop/capabilities/default.json', import.meta.url)
    const capability = (await Bun.file(capabilityURL).json()) as CapabilityConfig

    expect(capability.permissions).toContain('core:app:allow-set-app-theme')
  })

  test('compares colors with 1/255 tolerance and handles alpha', () => {
    const c1: Color = { r: 0.5, g: 0.5, b: 0.5, a: 1 }
    const c2: Color = { r: 0.5, g: 0.5, b: 0.5, a: 1 }
    const cClose: Color = { r: 0.5 + 0.002, g: 0.5, b: 0.5, a: 1 }
    const cFar: Color = { r: 0.5 + 0.01, g: 0.5, b: 0.5, a: 1 }
    const cAlphaDiff: Color = { r: 0.5, g: 0.5, b: 0.5, a: 0.8 }

    expect(colorsEqual(c1, c2)).toBe(true)
    expect(colorsEqual(c1, cClose)).toBe(true)
    expect(colorsEqual(c1, cFar)).toBe(false)
    expect(colorsEqual(c1, cAlphaDiff)).toBe(false)
  })

  test('resolves theme canvas color for initial light and dark defaults', () => {
    const nextDark: Color = { r: 0.173, g: 0.173, b: 0.173, a: 1 }
    const nextLight: Color = { r: 0.96, g: 0.96, b: 0.96, a: 1 }

    const fromLight = resolveThemeCanvasColor(CANVAS_BG_COLOR, undefined, nextDark)
    expect(fromLight.linked).toBe(true)
    expect(fromLight.color).toEqual(nextDark)

    const fromDark = resolveThemeCanvasColor(CANVAS_BG_COLOR_DARK, undefined, nextLight)
    expect(fromDark.linked).toBe(true)
    expect(fromDark.color).toEqual(nextLight)
  })

  test('resolves theme canvas color across linked theme transitions', () => {
    const prevApplied: Color = { r: 0.2, g: 0.2, b: 0.2, a: 1 }
    const nextTheme: Color = { r: 0.02, g: 0.02, b: 0.02, a: 1 }

    const linked = resolveThemeCanvasColor(prevApplied, prevApplied, nextTheme)
    expect(linked.linked).toBe(true)
    expect(linked.color).toEqual(nextTheme)
    expect(linked.color).not.toBe(nextTheme)
  })

  test('preserves custom canvas RGB and alpha edits as unlinked overrides', () => {
    const customRGB: Color = { r: 1, g: 0.2, b: 0.3, a: 1 }
    const customAlpha: Color = { ...CANVAS_BG_COLOR, a: 0.4 }
    const nextTheme: Color = { r: 0.1, g: 0.1, b: 0.1, a: 1 }

    const customRes = resolveThemeCanvasColor(customRGB, undefined, nextTheme)
    expect(customRes.linked).toBe(false)
    expect(customRes.color).toEqual(customRGB)

    const alphaRes = resolveThemeCanvasColor(customAlpha, undefined, nextTheme)
    expect(alphaRes.linked).toBe(false)
    expect(alphaRes.color).toEqual(customAlpha)
  })

  test('allows marking a page custom to clear recorded theme linkage', () => {
    const store = {}
    expect(() => markCanvasThemeCustom(store, 'page-1')).not.toThrow()
  })
})
