import { useLocalStorage } from '@vueuse/core'

import {
  DEFAULT_CANVAS_GRID_SETTINGS,
  normalizeCanvasGridSettings,
  type CanvasGridMode,
  type CanvasGridSettings
} from '@open-pencil/core/canvas'

const CANVAS_GRID_STORAGE_KEY = 'open-pencil:canvas-grid-v2'
const canvasGridStorage = useLocalStorage<CanvasGridSettings>(
  CANVAS_GRID_STORAGE_KEY,
  DEFAULT_CANVAS_GRID_SETTINGS,
  { writeDefaults: false }
)

export function loadCanvasGridSettings(): CanvasGridSettings {
  return normalizeCanvasGridSettings(canvasGridStorage.value)
}

export function saveCanvasGridSettings(settings: CanvasGridSettings): void {
  canvasGridStorage.value = normalizeCanvasGridSettings(settings)
}

export function setCanvasGridMode(settings: CanvasGridSettings, mode: CanvasGridMode): CanvasGridSettings {
  return { ...settings, mode }
}
