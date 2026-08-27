import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { RulerTheme } from '@open-pencil/core/canvas'
import { parseColor } from '@open-pencil/core/color'
import { CANVAS_BG_COLOR, CANVAS_BG_COLOR_DARK, IS_BROWSER } from '@open-pencil/core/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getActiveEditorStoreOrNull, useActiveEditorStoreRef } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

export const APP_THEME_SETTINGS = ['light', 'grey', 'dark', 'midnight'] as const
export type ExplicitAppTheme = (typeof APP_THEME_SETTINGS)[number]
export type AppTheme = ExplicitAppTheme | 'auto'
export type ResolvedAppTheme = ExplicitAppTheme
type NativeAppTheme = 'light' | 'dark'
type SetNativeTheme = (theme: NativeAppTheme) => Promise<void>

const THEME_STORAGE_KEY = 'open-pencil:theme'
const DEFAULT_THEME: AppTheme = 'dark'

export function normalizeThemeSetting(value: unknown): AppTheme {
  if (value === 'auto' || APP_THEME_SETTINGS.includes(value as ExplicitAppTheme)) {
    return value as AppTheme
  }
  return DEFAULT_THEME
}

export function resolveTheme(value: AppTheme, prefersDark: boolean): ResolvedAppTheme {
  if (value === 'auto') return prefersDark ? 'dark' : 'light'
  return value
}

export function applyNativeTheme(
  value: ResolvedAppTheme,
  setNativeTheme: SetNativeTheme
): Promise<void> {
  return setNativeTheme(value === 'light' ? 'light' : 'dark')
}

export function colorsEqual(left: Color, right: Color, epsilon: number = 1 / 255): boolean {
  return (
    Math.abs(left.r - right.r) <= epsilon &&
    Math.abs(left.g - right.g) <= epsilon &&
    Math.abs(left.b - right.b) <= epsilon &&
    Math.abs(left.a - right.a) <= epsilon
  )
}

export function resolveThemeCanvasColor(
  current: Color,
  previouslyApplied: Color | undefined,
  nextThemeColor: Color
): { color: Color; linked: boolean } {
  let linked = false
  if (!previouslyApplied) {
    linked = colorsEqual(current, CANVAS_BG_COLOR) || colorsEqual(current, CANVAS_BG_COLOR_DARK)
  } else {
    linked = colorsEqual(current, previouslyApplied)
  }

  if (linked) {
    return {
      color: { ...nextThemeColor },
      linked: true
    }
  }
  return {
    color: { ...current },
    linked: false
  }
}

const appliedPageThemeColors = new WeakMap<object, Map<string, Color>>()

export function markCanvasThemeCustom(store: object, pageId: string): void {
  appliedPageThemeColors.get(store)?.delete(pageId)
}

const theme = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_THEME)
const prefersDark = usePreferredDark()
export const resolvedAppTheme = computed<ResolvedAppTheme>(() =>
  resolveTheme(normalizeThemeSetting(theme.value), prefersDark.value)
)
let nativeThemeQueue: Promise<void> = Promise.resolve()

function updateNativeTheme(value: ResolvedAppTheme): void {
  if (!isTauri()) return
  nativeThemeQueue = nativeThemeQueue
    .catch(() => undefined)
    .then(async () => {
      const { setTheme } = await import('@tauri-apps/api/app')
      return applyNativeTheme(value, setTheme)
    })
  void nativeThemeQueue.catch((error: unknown) => {
    console.error('[theme] Failed to update native window theme', error)
  })
}

function readRulerTheme(): RulerTheme | null {
  if (!IS_BROWSER || !('document' in globalThis)) return null
  const style = getComputedStyle(document.documentElement)
  return {
    background: parseColor(style.getPropertyValue('--color-ruler-bg')),
    tick: parseColor(style.getPropertyValue('--color-ruler-tick')),
    text: parseColor(style.getPropertyValue('--color-ruler-text')),
    label: parseColor(style.getPropertyValue('--color-ruler-label'))
  }
}

function readCanvasThemeColor(): Color | null {
  if (!IS_BROWSER || !('document' in globalThis)) return null
  const style = getComputedStyle(document.documentElement)
  const canvasVal = style.getPropertyValue('--color-canvas')
  if (!canvasVal) return null
  return parseColor(canvasVal)
}

function updateCanvasTheme(): void {
  if (!IS_BROWSER) return
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  store.state.rulerTheme = readRulerTheme() ?? undefined

  const nextCanvasColor = readCanvasThemeColor()
  if (nextCanvasColor) {
    let pageMap = appliedPageThemeColors.get(store)
    if (!pageMap) {
      pageMap = new Map<string, Color>()
      appliedPageThemeColors.set(store, pageMap)
    }
    const pageId = store.state.currentPageId || ''
    const previouslyApplied = pageMap.get(pageId)
    const resolved = resolveThemeCanvasColor(
      store.state.pageColor,
      previouslyApplied,
      nextCanvasColor
    )
    if (resolved.linked) {
      store.state.pageColor = resolved.color
      pageMap.set(pageId, resolved.color)
    }
  }

  store.requestRepaint()
}

function applyTheme(value: ResolvedAppTheme, setting: AppTheme): void {
  if (!IS_BROWSER || !('document' in globalThis)) return
  document.documentElement.dataset.theme = value
  document.documentElement.dataset.themeSetting = setting
  document.documentElement.style.colorScheme = value === 'light' ? 'light' : 'dark'
  updateNativeTheme(value)
  updateCanvasTheme()
}

export function useAppTheme() {
  watch([resolvedAppTheme, theme], ([value, setting]) => applyTheme(value, setting), {
    immediate: true
  })

  // Editors may mount after the theme was applied; push the canvas (ruler)
  // theme whenever the active editor changes so rulers always match.
  const activeStoreRef = useActiveEditorStoreRef()
  const activePageId = computed(() => activeStoreRef.value?.state.currentPageId)
  if (IS_BROWSER) {
    watch([activeStoreRef, activePageId], () => updateCanvasTheme(), { flush: 'post' })
  }

  const isLight = computed(() => resolvedAppTheme.value === 'light')

  function setTheme(value: AppTheme): void {
    theme.value = normalizeThemeSetting(value)
  }

  function toggleTheme(): void {
    theme.value = isLight.value ? 'dark' : 'light'
  }

  return { theme, resolvedTheme: resolvedAppTheme, isLight, setTheme, toggleTheme }
}

export function createThemeMenuActions(setTheme: (theme: AppTheme) => void): Record<string, () => void> {
  return {
    'theme-light': () => setTheme('light'),
    'theme-grey': () => setTheme('grey'),
    'theme-dark': () => setTheme('dark'),
    'theme-midnight': () => setTheme('midnight'),
    'theme-auto': () => setTheme('auto')
  }
}

applyTheme(resolvedAppTheme.value, normalizeThemeSetting(theme.value))
