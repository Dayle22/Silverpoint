import { shallowRef, computed, triggerRef } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { dialogMessages } from '@open-pencil/vue'

import { setOpenPencilStore } from '@/app/browser-bridge'
import { addRecentProject } from '@/app/document/recent'
import { clearTabRecovery } from '@/app/document/recovery'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import { toast } from '@/app/shell/ui'

export interface Tab {
  id: string
  store: EditorStore
}

const io = new IORegistry(BUILTIN_IO_FORMATS)

let nextTabId = 1

function generateTabId(): string {
  return `tab-${nextTabId++}`
}

const tabsRef = shallowRef<Tab[]>([])
export const activeTabId = shallowRef('')
const closedTabsStack: Tab[] = []

interface TabStoreInfo {
  isDirty?: () => boolean
  getDocumentFilePath?: () => string | null
  getDocumentFileHandle?: () => FileSystemFileHandle | null
}

export const activeTab = computed(() => tabsRef.value.find((t) => t.id === activeTabId.value))

export const allTabs = computed(() =>
  tabsRef.value.map((t) => {
    const isDirtyFn = (t.store as TabStoreInfo).isDirty
    const getPathFn = (t.store as TabStoreInfo).getDocumentFilePath
    return {
      id: t.id,
      name: t.store.state.documentName,
      path: getPathFn ? getPathFn() : null,
      isActive: t.id === activeTabId.value,
      isDirty: isDirtyFn ? isDirtyFn() : false
    }
  })
)

export function getActiveStore(): EditorStore {
  const tab = tabsRef.value.find((t) => t.id === activeTabId.value)
  if (!tab) throw new Error('No active tab')
  return tab.store
}

export function getActiveTabId(): string {
  return activeTabId.value
}

export function getTabById(tabId: string): Tab | undefined {
  return tabsRef.value.find((tab) => tab.id === tabId)
}

export function getTabForStore(store: EditorStore): Tab | undefined {
  return tabsRef.value.find((tab) => tab.store === store)
}

export function getTabsSnapshot(): Tab[] {
  return [...tabsRef.value]
}

export function reorderTabs(sourceId: string, targetIndex: number) {
  const current = [...tabsRef.value]
  const sourceIndex = current.findIndex((t) => t.id === sourceId)
  if (sourceIndex === -1) return
  const [removed] = current.splice(sourceIndex, 1)
  current.splice(targetIndex, 0, removed)
  tabsRef.value = current
  triggerRef(tabsRef)
}

export function reopenClosedTab() {
  if (closedTabsStack.length === 0) return
  if (tabsRef.value.length >= 20) {
    const active = activeTab.value
    if (active?.store) {
      active.store.state.actionToast = dialogMessages.get().maxTabsReached
    }
    return
  }
  const tabToReopen = closedTabsStack.pop()
  if (!tabToReopen) return
  tabsRef.value = [...tabsRef.value, tabToReopen]
  activateTab(tabToReopen)
}

export function createTab(store?: EditorStore, initialGraph?: SceneGraph): Tab {
  if (tabsRef.value.length >= 20) {
    const active = activeTab.value
    if (active?.store) {
      active.store.state.actionToast = dialogMessages.get().maxTabsReached
    }
    if (store) store.dispose()
    return activeTab.value ?? tabsRef.value[0]
  }
  const s = store ?? createEditorStore(initialGraph)
  const tab: Tab = { id: generateTabId(), store: s }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
  return tab
}

function activateTab(tab: Tab) {
  activeTabId.value = tab.id
  setActiveEditorStore(tab.store)
  triggerRef(tabsRef)
  setOpenPencilStore(tab.store)
}

export function switchTab(tabId: string) {
  const tab = tabsRef.value.find((t) => t.id === tabId)
  if (!tab) return
  activateTab(tab)
}

export function closeTab(tabId: string) {
  const idx = tabsRef.value.findIndex((t) => t.id === tabId)
  if (idx === -1) return

  const closingTab = tabsRef.value[idx]
  const wasActive = activeTabId.value === tabId

  if (closedTabsStack.length >= 5) {
    const oldest = closedTabsStack[0]
    const isDirty = (oldest.store as TabStoreInfo).isDirty?.()
    if (isDirty && IS_TAURI) {
      void import('@tauri-apps/plugin-dialog').then(async ({ ask }) => {
        const saveFirst = await ask(
          dialogMessages
            .get()
            .saveChangesBeforeClosingTab({ name: oldest.store.state.documentName }),
          {
            title: dialogMessages.get().unsavedChangesTabTitle,
            kind: 'warning'
          }
        )
        if (saveFirst) {
          await oldest.store.saveFigFile()
        }
        const evicted = closedTabsStack.shift()
        evicted?.store.dispose()
        return undefined
      })
    }
  }

  tabsRef.value = tabsRef.value.filter((t) => t.id !== tabId)
  void clearTabRecovery(tabId)

  if (tabsRef.value.length === 0) {
    activeTabId.value = 'dashboard'
    setActiveEditorStore(undefined)
  } else if (wasActive) {
    const newIdx = Math.min(idx, tabsRef.value.length - 1)
    activateTab(tabsRef.value[newIdx])
  }

  closedTabsStack.push(closingTab)
  if (closedTabsStack.length > 5) {
    const oldest = closedTabsStack.shift()
    oldest?.store.dispose()
  }
}

// Removes a tab outright: no reopen entry, unlike closeTab. Used for tabs that
// never held a document, so "reopen closed tab" doesn't resurrect an empty one.
function discardTab(tab: Tab) {
  const idx = tabsRef.value.findIndex((t) => t.id === tab.id)
  if (idx === -1) return

  const wasActive = activeTabId.value === tab.id
  tabsRef.value = tabsRef.value.filter((t) => t.id !== tab.id)
  void clearTabRecovery(tab.id)

  if (tabsRef.value.length === 0) {
    activeTabId.value = 'dashboard'
    setActiveEditorStore(undefined)
  } else if (wasActive) {
    activateTab(tabsRef.value[Math.min(idx, tabsRef.value.length - 1)])
  }

  tab.store.dispose()
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function isDOMImportFile(file: File): boolean {
  return /\.(html?|xhtml)$/i.test(file.name)
}

function isPDFImportFile(file: File): boolean {
  return /\.pdf$/i.test(file.name)
}

function isIdmlImportFile(file: File): boolean {
  return /\.idml$/i.test(file.name)
}

async function dispatchSpecialImport(
  file: File,
  store: EditorStore,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<boolean> {
  if (isDOMImportFile(file)) {
    await store.openDOMFile(file, { handle, path })
    return true
  }
  if (isPDFImportFile(file)) {
    await store.openPDFFile(file, { handle, path })
    return true
  }
  if (isIdmlImportFile(file)) {
    await store.openIDMLFile(file, { handle, path })
    return true
  }
  return false
}

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  const existing = findTabForSource(handle, path)
  if (existing) {
    switchTab(existing.id)
    return
  }

  const current = activeTab.value
  const isUntouched =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo

  if (!isUntouched && tabsRef.value.length >= 20) {
    if (current?.store) {
      current.store.state.actionToast = dialogMessages.get().maxTabsReached
    }
    return
  }

  let openedTab: Tab | null = null
  let store: EditorStore
  if (isUntouched) {
    store = current.store
  } else {
    openedTab = createTab()
    store = openedTab.store
  }
  if (await dispatchSpecialImport(file, store, handle, path)) {
    return
  }


  const documentName = file.name.replace(/\.[^.]+$/i, '')

  store.state.documentName = documentName
  store.state.loading = true
  await yieldToUI()

  let failure: unknown = null

  try {
    const isFig = file.name.toLowerCase().endsWith('.fig')
    const { graph: imported, sourceFormat } = isFig
      ? { graph: await readFigFile(file, { populate: 'first-page' }), sourceFormat: 'fig' }
      : await io.readDocument({
          name: file.name,
          mimeType: file.type || undefined,
          data: new Uint8Array(await file.arrayBuffer())
        })

    const firstPageId = imported.getPages()[0]?.id
    if (firstPageId) computeAllLayouts(imported, firstPageId)
    store.replaceGraph(imported)
    store.undo.clear()
    store.setDocumentSource(file.name, sourceFormat, handle, path)
    store.clearSelection()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    await store.fitCurrentPageToViewport()
    // switchPage above requests a render, which advances sceneVersion past the
    // baseline setDocumentSource recorded. Re-baseline so a freshly opened
    // document is not reported as modified before any edit.
    store.markDocumentClean()

    if (path) {
      void addRecentProject(path, store.state.documentName, store)
    }
  } catch (e) {
    failure = e
  } finally {
    store.state.loading = false
  }

  if (failure) reportOpenFailure(failure, store, openedTab)
}

function findTabForSource(handle?: FileSystemFileHandle, path?: string): Tab | undefined {
  if (!path && !handle) return undefined
  return tabsRef.value.find((t) => {
    const s = t.store as TabStoreInfo
    const p = s.getDocumentFilePath?.()
    const h = s.getDocumentFileHandle?.()
    if (path && p && path === p) return true
    if (handle && h && handle === h) return true
    return false
  })
}

function reportOpenFailure(failure: unknown, store: EditorStore, openedTab: Tab | null) {
  console.error('Failed to open file:', failure)
  const detail = failure instanceof Error ? failure.message : String(failure)
  // Don't strand a tab named after a file we never managed to load.
  if (openedTab) discardTab(openedTab)
  else store.state.documentName = 'Untitled'
  toast.error(dialogMessages.get().openFileFailed({ detail }))
}

export function tabCount(): number {
  return tabsRef.value.length
}

export function useTabsStore() {
  return {
    tabs: allTabs,
    activeTabId,
    createTab,
    switchTab,
    closeTab,
    reorderTabs,
    reopenClosedTab,
    getActiveTabId,
    getTabById,
    getTabForStore,
    getTabsSnapshot,
    openFileInNewTab,
    getActiveStore,
    tabCount
  }
}
