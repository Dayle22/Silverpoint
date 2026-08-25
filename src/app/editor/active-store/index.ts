import { readonly, shallowRef, triggerRef } from 'vue'

import type { EditorStore } from '@/app/editor/session'

export type { EditorStore }

const storeRef = shallowRef<EditorStore>()

export const activeEditorStore = readonly(storeRef)

export function setActiveEditorStore(store?: EditorStore) {
  storeRef.value = store
  triggerRef(storeRef)
}

export function getActiveEditorStore(): EditorStore {
  if (!storeRef.value) throw new Error('Editor store not provided')
  return storeRef.value
}

export function getActiveEditorStoreOrNull(): EditorStore | null {
  return storeRef.value ?? null
}

const dummyState = {
  showUI: true,
  documentName: 'Dashboard',
  selectedIds: new Set<string>(),
  sceneVersion: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  autosaveEnabled: false,
  editingTextId: null,
  numberFieldFocused: false,
  actionToast: null,
  loading: false,
  currentPageId: ''
}

const dummyGraph = {
  documentColorSpace: 'srgb',
  getPages: () => [],
  getNodes: () => [],
  rootId: ''
}

const dummyUndo = {
  canUndo: false,
  canRedo: false,
  clear: () => undefined
}

const storeProxy = new Proxy({} as EditorStore, {
  get(_, prop) {
    const store = getActiveEditorStoreOrNull()
    if (!store) {
      if (prop === 'state') return dummyState
      if (prop === 'graph') return dummyGraph
      if (prop === 'undo') return dummyUndo
      if (prop === 'renderer') return undefined
      if (prop === 'selectedNodes') return []
      if (prop === 'selectedNode') return undefined
      if (prop === 'layerTree') return []
      if (typeof prop === 'string' && prop.startsWith('is')) return () => false
      return () => undefined
    }
    return Reflect.get(store, prop)
  }
})

export function useEditorStore(): EditorStore {
  return storeProxy
}

