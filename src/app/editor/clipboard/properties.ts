import { computed, readonly, shallowRef } from 'vue'

import {
  applicablePropertiesFor,
  extractTransferableProperties,
  type CopiedProperties
} from '@open-pencil/core/editor'

import type { EditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'

const copiedRef = shallowRef<CopiedProperties | null>(null)

export const copiedProperties = readonly(copiedRef)

export const hasCopiedProperties = computed(() => copiedRef.value !== null)

export function clearPropertyClipboard(): void {
  copiedRef.value = null
}

export function copySelectionProperties(store: EditorStore): boolean {
  const nodes = store.selectedNodes.value
  if (nodes.length === 0) {
    toast.warning('Select a layer to copy properties')
    return false
  }

  const sourceNode = nodes[0]
  const payload = extractTransferableProperties(sourceNode)

  const images = new Map<string, Uint8Array>()
  if (payload.properties.fills) {
    for (const fill of payload.properties.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        const bytes = store.graph.images.get(fill.imageHash)
        if (bytes) {
          images.set(fill.imageHash, bytes.slice())
        }
      }
    }
  }

  copiedRef.value = {
    ...payload,
    images: images.size > 0 ? images : undefined
  }

  toast.info('Properties copied')
  return true
}

export function pastePropertiesToSelection(store: EditorStore): boolean {
  const payload = copiedRef.value
  if (!payload) {
    toast.warning('No properties to paste')
    return false
  }

  const nodes = store.selectedNodes.value
  if (nodes.length === 0) {
    toast.warning('Select a layer to paste properties')
    return false
  }

  const targets = nodes.filter((node) => !node.locked)
  if (targets.length === 0) {
    return false
  }

  if (payload.images && payload.images.size > 0) {
    for (const [hash, bytes] of payload.images) {
      if (!store.graph.images.has(hash)) {
        store.graph.images.set(hash, bytes.slice())
      }
    }
  }

  store.undo.runBatch('Paste properties', () => {
    for (const target of targets) {
      const changes = applicablePropertiesFor(payload.sourceType, target.type, payload)
      if (Object.keys(changes).length > 0) {
        store.updateNodeWithUndo(target.id, changes, 'Paste properties')
      }
    }
  })

  return true
}
