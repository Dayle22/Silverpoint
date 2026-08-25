import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const CAPABILITY_VERSION = 1
export type Capability = 'simple' | 'full'

export interface AppCapability {
  version: typeof CAPABILITY_VERSION
  capability: Capability
}

export const DEFAULT_CAPABILITY: AppCapability = {
  version: CAPABILITY_VERSION,
  capability: 'full'
}

export function normalise(value: unknown): AppCapability {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CAPABILITY }
  const version = (value as Partial<AppCapability>).version
  const capability = (value as Partial<AppCapability>).capability
  if (version !== CAPABILITY_VERSION || (capability !== 'simple' && capability !== 'full')) {
    return { ...DEFAULT_CAPABILITY }
  }
  return {
    version: CAPABILITY_VERSION,
    capability
  }
}

const stored = useLocalStorage<AppCapability>('silverpoint:capability', DEFAULT_CAPABILITY, {
  writeDefaults: false,
  serializer: {
    read: (value) => {
      try {
        return normalise(JSON.parse(value))
      } catch {
        return { ...DEFAULT_CAPABILITY }
      }
    },
    write: (value) => JSON.stringify(normalise(value))
  }
})

export const appCapability = computed(() => normalise(stored.value))
export const capability = computed(() => appCapability.value.capability)
export const isSimple = computed(() => capability.value === 'simple')

export function setCapability(value: Capability): void {
  stored.value = normalise({
    version: CAPABILITY_VERSION,
    capability: value
  })
}
