import { useLocalStorage } from '@vueuse/core'
import { computed, type ComputedRef } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

export const CAPABILITY_VERSION = 2
export const CAPABILITY_STORAGE_KEY = 'silverpoint:capability'

export const CAPABILITY_VALUES = ['essential', 'advanced', 'dev'] as const
export type Capability = (typeof CAPABILITY_VALUES)[number]

export interface AppCapability {
  version: typeof CAPABILITY_VERSION
  capability: Capability
}

export function getDefaultCapability(): Capability {
  if (IS_BROWSER && globalThis.window !== undefined) {
    const width = globalThis.window.innerWidth
    if (typeof width === 'number' && width < 1024) {
      return 'essential'
    }
  }
  return 'essential'
}

export const DEFAULT_CAPABILITY: AppCapability = {
  version: CAPABILITY_VERSION,
  capability: 'essential'
}

interface CapabilityRecord {
  version?: unknown
  capability?: unknown
}

function isCapabilityRecord(value: unknown): value is CapabilityRecord {
  return value !== null && typeof value === 'object'
}

export function normalise(value: unknown): AppCapability {
  if (!isCapabilityRecord(value)) {
    return { version: CAPABILITY_VERSION, capability: getDefaultCapability() }
  }

  // Direct v2 capability check
  if (value.version === CAPABILITY_VERSION && typeof value.capability === 'string') {
    if (CAPABILITY_VALUES.includes(value.capability as Capability)) {
      return {
        version: CAPABILITY_VERSION,
        capability: value.capability as Capability
      }
    }
  }

  // Legacy v1 migration: simple -> essential, full -> advanced
  if (value.capability === 'simple') {
    return { version: CAPABILITY_VERSION, capability: 'essential' }
  }
  if (value.capability === 'full') {
    return { version: CAPABILITY_VERSION, capability: 'advanced' }
  }

  return { version: CAPABILITY_VERSION, capability: getDefaultCapability() }
}

const serializer = {
  read(raw: string): AppCapability {
    try {
      return normalise(JSON.parse(raw))
    } catch {
      return { version: CAPABILITY_VERSION, capability: getDefaultCapability() }
    }
  },
  write(value: AppCapability): string {
    return JSON.stringify(normalise(value))
  }
}

export const storedCapability = useLocalStorage<AppCapability>(
  CAPABILITY_STORAGE_KEY,
  DEFAULT_CAPABILITY,
  {
    writeDefaults: false,
    serializer
  }
)

export const capability: ComputedRef<Capability> = computed(() => storedCapability.value.capability)
export const isEssential: ComputedRef<boolean> = computed(() => capability.value === 'essential')
export const isAdvanced: ComputedRef<boolean> = computed(() => capability.value === 'advanced')
export const isDev: ComputedRef<boolean> = computed(() => capability.value === 'dev')

/** @deprecated Use isEssential */
export const isSimple: ComputedRef<boolean> = isEssential

export function setCapability(value: Capability): void {
  if (CAPABILITY_VALUES.includes(value)) {
    storedCapability.value = {
      version: CAPABILITY_VERSION,
      capability: value
    }
  }
}

