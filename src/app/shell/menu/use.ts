import { tryOnScopeDispose } from '@vueuse/core'
import { watch } from 'vue'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore, getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import { importFileDialog, openFileDialog } from '@/app/shell/menu/files'
import { useAppTheme } from '@/app/shell/theme'
import { checkForAppUpdate } from '@/app/shell/updater'
import { createTab, closeTab, activeTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'
import { saveCanvasGridSettings } from '@/app/shell/canvas-grid'
import { openPreferences } from '@/app/shell/preferences'
import { setCapability } from '@/app/shell/capability'
import { closeRegisteredPanel, openRegisteredPanel, PANEL_IDS, panelLayout, resetPanelLayout, type PanelId } from '@/app/shell/panels'

const store = useEditorStore()
const COMMAND_MENU_IDS = new Set<string>([
  'edit.undo',
  'edit.redo',
  'selection.selectAll',
  'selection.duplicate',
  'selection.delete',
  'selection.group',
  'selection.ungroup',
  'selection.createComponent',
  'selection.createComponentSet',
  'selection.detachInstance',
  'selection.wrapInAutoLayout',
  'selection.booleanUnion',
  'selection.booleanSubtract',
  'selection.booleanIntersect',
  'selection.booleanExclude',
  'selection.flatten',
  'selection.outlineText',
  'selection.outlineStroke',
  'selection.bringToFront',
  'selection.sendToBack',
  'view.zoom100',
  'view.zoomFit',
  'view.zoomSelection'
])

export { importFileDialog, openFileDialog }
export { openFileFromPath } from '@/app/shell/menu/files'

export function useMenu() {
  if (!isTauri()) return

  let unlisten: (() => void) | undefined
  const { setTheme } = useAppTheme()
  const { dialogs, menu, panels, locale } = useI18n()
  const { runCommand } = useEditorCommands()

  const actions: Partial<Record<string, () => void>> = {
    new: () => createTab(),
    open: () => void openFileDialog(),
    close: () => {
      if (activeTab.value) closeTab(activeTab.value.id)
    },
    save: () => {
      if (getActiveEditorStoreOrNull()) void store.saveFigFile()
    },
    'save-as': () => {
      if (getActiveEditorStoreOrNull()) void store.saveFigFileAs()
    },
    'export-selection': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
    },
    'export-png': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
    },
    'export-jpg': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'jpg')
    },
    'export-svg': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'svg')
    },
    'export-pdf': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'pdf')
    },
    'export-fig': () => {
      if (getActiveEditorStoreOrNull() && store.state.selectedIds.size > 0) void store.exportSelection(1, 'fig')
    },
    autosave: () => {
      const s = getActiveEditorStoreOrNull()
      if (s) s.state.autosaveEnabled = !s.state.autosaveEnabled
    },
    'canvas-grid-toggle': () => {
      const s = getActiveEditorStoreOrNull()
      if (!s) return
      s.state.canvasGrid.visible = !s.state.canvasGrid.visible
      saveCanvasGridSettings(s.state.canvasGrid)
      s.requestRepaint()
    },
    'canvas-grid-dots': () => {
      const s = getActiveEditorStoreOrNull()
      if (!s) return
      s.state.canvasGrid.mode = 'dots'
      saveCanvasGridSettings(s.state.canvasGrid)
      s.requestRepaint()
    },
    'canvas-grid-lines': () => {
      const s = getActiveEditorStoreOrNull()
      if (!s) return
      s.state.canvasGrid.mode = 'lines'
      saveCanvasGridSettings(s.state.canvasGrid)
      s.requestRepaint()
    },
    preferences: openPreferences,
    'reset-panel-layout': resetPanelLayout,
    'capability-simple': () => setCapability('simple'),
    'capability-full': () => setCapability('full'),
    copy: () => {
      const s = getActiveEditorStoreOrNull()
      if (s) void executeClipboardCommand(s, 'copy')
    },
    cut: () => {
      const s = getActiveEditorStoreOrNull()
      if (s) void executeClipboardCommand(s, 'cut')
    },
    paste: () => {
      const s = getActiveEditorStoreOrNull()
      if (s) void executeClipboardCommand(s, 'paste')
    },
    'paste-to-replace': () => {
      const s = getActiveEditorStoreOrNull()
      if (s) void pasteClipboardToReplace(s)
    },
    'check-updates': () => void checkForAppUpdate({ messages: dialogs }),
    ...createSharedEditorMenuActions(setTheme)
  }

  function panelMenuId(id: PanelId): string {
    return `window-panel-${id}`
  }

  function setPanelRequestedState(id: PanelId, checked: boolean): void {
    if (checked) openRegisteredPanel(id)
    else closeRegisteredPanel(id)
  }

  function panelIdFromMenuId(id: string): PanelId | undefined {
    const candidate = id.slice('window-panel-'.length) as PanelId
    return id.startsWith('window-panel-') && PANEL_IDS.includes(candidate) ? candidate : undefined
  }

  for (const id of PANEL_IDS) {
    actions[panelMenuId(id)] = () => {
      const panelId = panelIdFromMenuId(panelMenuId(id))
      if (panelId) setPanelRequestedState(panelId, !panelLayout.value.panels[panelId].open)
    }
  }

  const syncNativePanelMenu = async (): Promise<void> => {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sync_panel_menu', {
      windowLabel: menu.value.window,
      resetLabel: menu.value.resetPanelLayout,
      panels: PANEL_IDS.map((id) => ({
        id,
        label: panels.value[id],
        checked: panelLayout.value.panels[id].open
      }))
    })
  }

  void syncNativePanelMenu().catch(() => undefined)
  const stopNativePanelSync = watch(
    [locale, ...PANEL_IDS.map((id) => () => panelLayout.value.panels[id].open)],
    () => void syncNativePanelMenu().catch(() => undefined),
    { flush: 'post' }
  )

  void import('@tauri-apps/api/event').then(({ listen }) => {
    return listen<string>('menu-event', (event) => {
      if (COMMAND_MENU_IDS.has(event.payload)) {
        if (getActiveEditorStoreOrNull()) runCommand(event.payload as EditorCommandId)
        return
      }
      const panelId = panelIdFromMenuId(event.payload)
      if (panelId) {
        setPanelRequestedState(panelId, !panelLayout.value.panels[panelId].open)
        return
      }
      actions[event.payload]?.()
    }).then((unlistenFn) => {
      unlisten = unlistenFn
      return undefined
    })
  })

  tryOnScopeDispose(() => {
    unlisten?.()
    stopNativePanelSync()
  })
}
