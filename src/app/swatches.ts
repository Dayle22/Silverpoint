import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import {
  clearNodeFillOkHCL,
  colorToFill,
  colorToHex,
  getFillOkHCL,
  okhclToRGBA,
  parseColor
} from '@open-pencil/core/color'
import type { Editor } from '@open-pencil/core/editor'
import type { Fill } from '@open-pencil/scene-graph'

export const SWATCH_STORE_VERSION = 1 as const
export const SWATCH_STORAGE_KEY = 'silverpoint:swatches:v1'

export interface Swatch {
  id: string
  name: string
  hex: `#${string}`
}

export interface SwatchStoreV1 {
  version: typeof SWATCH_STORE_VERSION
  items: Swatch[]
  recent: Array<`#${string}`>
}

export const DEFAULT_SWATCHES: readonly Swatch[] = [
  { id: 'default-red', name: 'Red', hex: '#F0002D' },
  { id: 'default-orange', name: 'Orange', hex: '#F38500' },
  { id: 'default-yellow', name: 'Yellow', hex: '#F9C900' },
  { id: 'default-green', name: 'Green', hex: '#5CCA53' },
  { id: 'default-mint', name: 'Mint', hex: '#4FCCB4' },
  { id: 'default-teal', name: 'Teal', hex: '#4DC7D2' },
  { id: 'default-sky', name: 'Sky', hex: '#4CC4EB' },
  { id: 'default-blue', name: 'Blue', hex: '#338BFF' },
  { id: 'default-indigo', name: 'Indigo', hex: '#5F54FA' },
  { id: 'default-purple', name: 'Purple', hex: '#BF11E3' },
  { id: 'default-pink', name: 'Pink', hex: '#EF004D' },
  { id: 'default-brown', name: 'Brown', hex: '#A77D5A' },
  { id: 'default-white', name: 'White', hex: '#FFFFFF' },
  { id: 'default-light-grey', name: 'Light Grey', hex: '#D1D1D6' },
  { id: 'default-grey', name: 'Grey', hex: '#8E8E93' },
  { id: 'default-dark-grey', name: 'Dark Grey', hex: '#3A3A3C' },
  { id: 'default-black', name: 'Black', hex: '#000000' }
]

export function createDefaultSwatchStore(): SwatchStoreV1 {
  return {
    version: SWATCH_STORE_VERSION,
    items: DEFAULT_SWATCHES.map((s) => ({ ...s })),
    recent: []
  }
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

function normaliseSwatchItems(rawItems: unknown[]): Swatch[] {
  const items: Swatch[] = []
  const seenIds = new Set<string>()
  const seenHexes = new Set<string>()

  for (const item of rawItems) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'name' in item &&
      'hex' in item &&
      typeof item.id === 'string' &&
      item.id.trim() !== '' &&
      typeof item.name === 'string' &&
      item.name.trim() !== '' &&
      typeof item.hex === 'string' &&
      HEX_REGEX.test(item.hex)
    ) {
      const canonicalHex = colorToHex(parseColor(item.hex)) as `#${string}`
      if (!seenIds.has(item.id) && !seenHexes.has(canonicalHex)) {
        seenIds.add(item.id)
        seenHexes.add(canonicalHex)
        items.push({
          id: item.id,
          name: item.name,
          hex: canonicalHex
        })
      }
    }
  }
  return items
}

function normaliseRecentColours(rawRecent: unknown[]): Array<`#${string}`> {
  const recent: Array<`#${string}`> = []
  const seenRecent = new Set<string>()

  for (const r of rawRecent) {
    if (typeof r === 'string' && HEX_REGEX.test(r)) {
      const canonical = colorToHex(parseColor(r)) as `#${string}`
      if (!seenRecent.has(canonical)) {
        seenRecent.add(canonical)
        recent.push(canonical)
        if (recent.length >= 10) break
      }
    }
  }
  return recent
}

export function normaliseSwatchStore(value: unknown): SwatchStoreV1 {
  if (!value || typeof value !== 'object') {
    return createDefaultSwatchStore()
  }
  const candidate = value as Partial<SwatchStoreV1>
  if (candidate.version !== SWATCH_STORE_VERSION || !Array.isArray(candidate.items)) {
    return createDefaultSwatchStore()
  }

  const items = normaliseSwatchItems(candidate.items)
  const recent = Array.isArray(candidate.recent) ? normaliseRecentColours(candidate.recent) : []

  return {
    version: SWATCH_STORE_VERSION,
    items,
    recent
  }
}

const stored = useLocalStorage<SwatchStoreV1>(SWATCH_STORAGE_KEY, createDefaultSwatchStore(), {
  writeDefaults: false,
  serializer: {
    read: (value) => {
      try {
        return normaliseSwatchStore(JSON.parse(value))
      } catch {
        return createDefaultSwatchStore()
      }
    },
    write: (value) => JSON.stringify(normaliseSwatchStore(value))
  }
})

export const swatchStore = stored
export const swatches = computed(() => normaliseSwatchStore(stored.value).items)
export const recentColours = computed(() => normaliseSwatchStore(stored.value).recent)

export function recordRecentColour(hex: string): void {
  const parsed = parseColor(hex)
  const canonical = colorToHex(parsed) as `#${string}`
  const current = normaliseSwatchStore(stored.value)
  const filtered = current.recent.filter((r) => r !== canonical)
  const nextRecent = [canonical, ...filtered].slice(0, 10)
  stored.value = {
    ...current,
    recent: nextRecent
  }
}

export function addSwatch(hex: string, name?: string): boolean {
  const parsed = parseColor(hex)
  const canonical = colorToHex(parsed) as `#${string}`
  const current = normaliseSwatchStore(stored.value)
  if (current.items.some((item) => item.hex === canonical)) {
    return false
  }
  const id = crypto.randomUUID()
  const swatchName = name?.trim() ? name.trim() : `Custom ${canonical}`
  const nextItems = [...current.items, { id, name: swatchName, hex: canonical }]
  const nextRecent = [canonical, ...current.recent.filter((r) => r !== canonical)].slice(0, 10)

  stored.value = {
    version: SWATCH_STORE_VERSION,
    items: nextItems,
    recent: nextRecent
  }
  return true
}

export function deleteSwatch(id: string): boolean {
  const current = normaliseSwatchStore(stored.value)
  const nextItems = current.items.filter((item) => item.id !== id)
  if (nextItems.length === current.items.length) {
    return false
  }
  stored.value = {
    ...current,
    items: nextItems
  }
  return true
}

export function currentSelectionSolidHex(editor: Editor): `#${string}` | null {
  const nodes = editor.getSelectedNodes()
  if (!nodes.length) return null
  const node = nodes[0]
  if (!Array.isArray(node.fills)) return null

  for (let i = 0; i < node.fills.length; i++) {
    const fill = node.fills[i]
    if (fill.type === 'SOLID' && fill.visible) {
      const bindingPath = `fills/${i}/color`
      const boundVarId = node.boundVariables[bindingPath]
      if (boundVarId) {
        const resolved = editor.resolveColorVariable(boundVarId)
        if (resolved) {
          return colorToHex(resolved) as `#${string}`
        }
      }
      const okhclPayload = getFillOkHCL(node, i)
      if (okhclPayload) {
        const rgba = okhclToRGBA(okhclPayload.color)
        return colorToHex(rgba) as `#${string}`
      }
      return colorToHex(fill.color) as `#${string}`
    }
  }
  return null
}

export function applySwatchToSelection(editor: Editor, hex: string): boolean {
  const nodes = editor.getSelectedNodes()
  if (!nodes.length) return false

  const color = parseColor(hex)
  const canonicalHex = colorToHex(color) as `#${string}`

  editor.undo.runBatch('Apply swatch', () => {
    for (const node of nodes) {
      const fills = Array.isArray(node.fills) ? [...node.fills] : []
      let targetIndex = -1

      for (let i = 0; i < fills.length; i++) {
        if (fills[i].visible) {
          targetIndex = i
          break
        }
      }

      if (targetIndex === -1 && fills.length > 0) {
        targetIndex = 0
      }

      if (targetIndex === -1) {
        const newFill = colorToFill(canonicalHex)
        editor.updateNodeWithUndo(node.id, {
          fills: [newFill]
        }, 'Apply swatch')
      } else {
        const existing = fills[targetIndex]
        const newFill: Fill = {
          type: 'SOLID',
          color: { r: color.r, g: color.g, b: color.b, a: 1 },
          opacity: existing.opacity,
          visible: existing.visible
        }
        fills[targetIndex] = newFill

        editor.unbindVariable(node.id, `fills/${targetIndex}/color`)
        const okhclPatch = clearNodeFillOkHCL(node, targetIndex)

        editor.updateNodeWithUndo(node.id, {
          fills,
          ...okhclPatch
        }, 'Apply swatch')
      }
    }
  })

  recordRecentColour(canonicalHex)
  return true
}
