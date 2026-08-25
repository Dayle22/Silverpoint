import { computed, ref } from 'vue'

import type { CanvasSurfaceInfo } from '@open-pencil/vue'

import { appPreferences } from '@/app/shell/preferences'

/**
 * Capability reported by the live scene surface, or `null` before the first
 * surface is built.
 *
 * Only the renderer writes here, so capability UI can never claim GPU support
 * the surface does not actually have.
 */
const surfaceInfo = ref<CanvasSurfaceInfo | null>(null)

export const canvasSurfaceInfo = computed(() => surfaceInfo.value)

export function setCanvasSurfaceInfo(info: CanvasSurfaceInfo): void {
  surfaceInfo.value = info
}

/**
 * True when the preference no longer matches the backend the live surface was
 * built with.
 *
 * A canvas element keeps its first context type for life, so switching
 * backends needs a restart rather than a surface rebuild.
 */
export const hardwareAccelerationNeedsRestart = computed(() => {
  const info = surfaceInfo.value
  if (!info || info.backend === 'none') return false
  return appPreferences.value.hardwareAcceleration !== (info.backend === 'gpu')
})
