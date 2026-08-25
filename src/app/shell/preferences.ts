import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

import {
  DEFAULT_PREFERENCES_SECTION,
  normalisePreferencesSection,
  type PreferencesSectionId
} from '@/app/shell/preferences-sections'

export const PREFERENCES_VERSION = 1
const DEFAULT_UI_SCALE = 100
const DEFAULT_HARDWARE_ACCELERATION = true

export interface AppPreferences {
  version: typeof PREFERENCES_VERSION
  uiScale: number
  /**
   * Requests a GPU-backed canvas surface.
   *
   * Read when the canvas surface is built, so a change only takes effect after
   * the app restarts.
   */
  hardwareAcceleration: boolean
}

const DEFAULT_PREFERENCES: AppPreferences = {
  version: PREFERENCES_VERSION,
  uiScale: DEFAULT_UI_SCALE,
  hardwareAcceleration: DEFAULT_HARDWARE_ACCELERATION
}

function normalise(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES }
  const uiScale = Number((value as Partial<AppPreferences>).uiScale)
  const accelerated = (value as Partial<AppPreferences>).hardwareAcceleration
  return {
    version: PREFERENCES_VERSION,
    uiScale: Number.isFinite(uiScale) ? Math.min(150, Math.max(80, Math.round(uiScale))) : DEFAULT_UI_SCALE,
    hardwareAcceleration: typeof accelerated === 'boolean' ? accelerated : DEFAULT_HARDWARE_ACCELERATION
  }
}

const stored = useLocalStorage<AppPreferences>('silverpoint:preferences', DEFAULT_PREFERENCES, {
  writeDefaults: false,
  serializer: {
    read: (value) => {
      try { return normalise(JSON.parse(value)) } catch { return { ...DEFAULT_PREFERENCES } }
    },
    write: (value) => JSON.stringify(normalise(value))
  }
})

export const preferencesOpen = ref(false)
export const preferencesSection = ref<PreferencesSectionId>(DEFAULT_PREFERENCES_SECTION)
export const appPreferences = computed(() => normalise(stored.value))

export function openPreferences(): void { preferencesOpen.value = true }

export function setPreferencesSection(value: unknown): void {
  preferencesSection.value = normalisePreferencesSection(value)
}

export function setUiScale(value: number): void {
  stored.value = normalise({ ...appPreferences.value, uiScale: value })
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--silverpoint-ui-scale', String(appPreferences.value.uiScale / 100))
  }
}

export function setHardwareAcceleration(value: boolean): void {
  stored.value = normalise({ ...appPreferences.value, hardwareAcceleration: value })
}

/**
 * Reads the acceleration preference without a Vue reactive dependency.
 *
 * The canvas surface manager calls this once per surface build.
 */
export function prefersHardwareAcceleration(): boolean {
  return appPreferences.value.hardwareAcceleration
}

export function resetAppPreferences(): void {
  setUiScale(DEFAULT_UI_SCALE)
  setHardwareAcceleration(DEFAULT_HARDWARE_ACCELERATION)
}

setUiScale(appPreferences.value.uiScale)
