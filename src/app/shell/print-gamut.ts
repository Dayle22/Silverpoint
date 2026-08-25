import { useLocalStorage } from '@vueuse/core'

import {
  DEFAULT_PRINT_GAMUT_SETTINGS,
  normalizePrintGamutSettings,
  type PrintGamutProfile,
  type PrintGamutSettings
} from '@open-pencil/core/color'

const PRINT_GAMUT_STORAGE_KEY = 'open-pencil:print-gamut-v1'

export const printGamutStorage = useLocalStorage<PrintGamutSettings>(
  PRINT_GAMUT_STORAGE_KEY,
  DEFAULT_PRINT_GAMUT_SETTINGS,
  { writeDefaults: false }
)

export function loadPrintGamutSettings(): PrintGamutSettings {
  return normalizePrintGamutSettings(printGamutStorage.value)
}

export function savePrintGamutSettings(settings: PrintGamutSettings): void {
  printGamutStorage.value = normalizePrintGamutSettings(settings)
}

export function setPrintGamutEnabled(
  settings: PrintGamutSettings,
  enabled: boolean
): PrintGamutSettings {
  return { ...settings, enabled }
}

export function setPrintGamutProfile(
  settings: PrintGamutSettings,
  profile: PrintGamutProfile
): PrintGamutSettings {
  return { ...settings, profile }
}
