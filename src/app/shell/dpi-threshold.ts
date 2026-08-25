import { useLocalStorage } from '@vueuse/core'

export const DEFAULT_DPI_THRESHOLD = 300

export function normalizeDpiThreshold(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(2400, Math.round(raw)))
  }
  return DEFAULT_DPI_THRESHOLD
}

const DPI_THRESHOLD_STORAGE_KEY = 'open-pencil:dpi-threshold-v1'
export const dpiThresholdStorage = useLocalStorage<number>(
  DPI_THRESHOLD_STORAGE_KEY,
  DEFAULT_DPI_THRESHOLD,
  { writeDefaults: false }
)

export function loadDpiThreshold(): number {
  return normalizeDpiThreshold(dpiThresholdStorage.value)
}

export function saveDpiThreshold(threshold: number): void {
  dpiThresholdStorage.value = normalizeDpiThreshold(threshold)
}
