export interface RendererCacheBudgets {
  /** Total ceiling across all renderer caches. */
  totalBytes: number
  images: { maxBytes: number; maxEntries: number }
  paths: { maxBytes: number; maxEntries: number }
  geometry: { maxBytes: number; maxEntries: number }
  pictures: { maxBytes: number; maxEntries: number }
  filters: { maxBytes: number; maxEntries: number }
  text: { maxBytes: number; maxEntries: number }
}

export const DEFAULT_CACHE_BUDGETS: RendererCacheBudgets = {
  totalBytes: 512 * 1024 * 1024,
  images: { maxBytes: 256 * 1024 * 1024, maxEntries: 512 },
  paths: { maxBytes: 48 * 1024 * 1024, maxEntries: 8_192 },
  geometry: { maxBytes: 48 * 1024 * 1024, maxEntries: 8_192 },
  pictures: { maxBytes: 128 * 1024 * 1024, maxEntries: 2_048 },
  filters: { maxBytes: 16 * 1024 * 1024, maxEntries: 512 },
  text: { maxBytes: 16 * 1024 * 1024, maxEntries: 4_096 }
}

/**
 * Scale budgets to the device. Returns a copy — never mutate DEFAULT_CACHE_BUDGETS.
 * deviceMemoryGb comes from navigator.deviceMemory when available; pass 4 when unknown.
 */
export function scaleBudgets(
  base: RendererCacheBudgets,
  deviceMemoryGb: number
): RendererCacheBudgets {
  const factor = Math.min(Math.max(deviceMemoryGb / 8, 0.25), 1.5)
  return {
    totalBytes: Math.floor(base.totalBytes * factor),
    images: {
      maxBytes: Math.floor(base.images.maxBytes * factor),
      maxEntries: base.images.maxEntries
    },
    paths: {
      maxBytes: Math.floor(base.paths.maxBytes * factor),
      maxEntries: base.paths.maxEntries
    },
    geometry: {
      maxBytes: Math.floor(base.geometry.maxBytes * factor),
      maxEntries: base.geometry.maxEntries
    },
    pictures: {
      maxBytes: Math.floor(base.pictures.maxBytes * factor),
      maxEntries: base.pictures.maxEntries
    },
    filters: {
      maxBytes: Math.floor(base.filters.maxBytes * factor),
      maxEntries: base.filters.maxEntries
    },
    text: {
      maxBytes: Math.floor(base.text.maxBytes * factor),
      maxEntries: base.text.maxEntries
    }
  }
}
