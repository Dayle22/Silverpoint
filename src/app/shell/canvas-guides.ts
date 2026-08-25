import { useLocalStorage } from '@vueuse/core'

import {
  DEFAULT_CANVAS_GUIDE_APPEARANCE,
  normalizeCanvasGuideAppearance,
  type CanvasGuideAppearance
} from '@open-pencil/core/canvas'

const storage = useLocalStorage<CanvasGuideAppearance>(
  'silverpoint:canvas-guide-appearance',
  DEFAULT_CANVAS_GUIDE_APPEARANCE,
  { writeDefaults: false }
)

export function loadCanvasGuideAppearance(): CanvasGuideAppearance {
  return normalizeCanvasGuideAppearance(storage.value)
}

export function saveCanvasGuideAppearance(value: CanvasGuideAppearance): void {
  storage.value = normalizeCanvasGuideAppearance(value)
}
