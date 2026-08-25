import { computed } from 'vue'

import type { MenuEntry } from '@open-pencil/vue'
import { useEditorCommands, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { openFileDialog } from '@/app/shell/menu/use'
import { useAppTheme } from '@/app/shell/theme'
import { saveCanvasGridSettings } from '@/app/shell/canvas-grid'
import { openPreferences } from '@/app/shell/preferences'
import { capability, setCapability } from '@/app/shell/capability'
import { closeRegisteredPanel, openRegisteredPanel, panelLayout, PANEL_IDS, resetPanelLayout, type PanelId } from '@/app/shell/panels'

export interface AppMenuGroup {
  label: string
  items: MenuEntry[]
}

function isVisible(entry: { target?: string }): boolean {
  return entry.target !== 'native'
}

function isSeparator(entry: AppMenuEntry): entry is Extract<AppMenuEntry, { type: 'separator' }> {
  return entry.type === 'separator'
}

export function useAppMenu() {
  const store = useEditorStore()
  const { menuItem: commandMenuItem } = useEditorCommands()
  const { menu, panels } = useI18n()
  const { theme, setTheme } = useAppTheme()

  const translatedMenuItemLabels: Partial<Record<string, keyof typeof menu.value>> = {
    new: 'new',
    open: 'open',
    save: 'save',
    'save-as': 'saveAs',
    'export-selection': 'exportSelection',
    autosave: 'autosave',
    close: 'closeTab',
    copy: 'copy',
    cut: 'cut',
    paste: 'paste',
    'paste-to-replace': 'pasteToReplace',
    profiler: 'profiler',
    'toggle-ui': 'toggleUI',
    'reset-panel-layout': 'resetPanelLayout',
    'capability-simple': 'capabilitySimple',
    'capability-full': 'capabilityFull',
    theme: 'theme',
    'theme-light': 'themeLight',
    'theme-grey': 'themeGrey',
    'theme-dark': 'themeDark',
    'theme-midnight': 'themeMidnight',
    'theme-auto': 'themeAuto',
    'zoom-in': 'zoomIn',
    'zoom-out': 'zoomOut',
    'text.bold': 'bold',
    'text.italic': 'italic',
    'text.underline': 'underline',
    'arrange.align-left': 'arrangeAlignLeft',
    'arrange.align-center': 'arrangeAlignCenter',
    'arrange.align-right': 'arrangeAlignRight',
    'arrange.align-top': 'arrangeAlignTop',
    'arrange.align-middle': 'arrangeAlignMiddle',
    'arrange.align-bottom': 'arrangeAlignBottom'
  }

  function exportSelection(format: 'png' | 'jpg' | 'svg' | 'pdf' | 'fig') {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, format)
  }

  const actions: Partial<Record<string, () => void>> = {
    new: () => {
      void import('@/app/tabs').then((m) => m.createTab())
    },
    open: () => void openFileDialog(),
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'export-selection': () => exportSelection('png'),
    copy: () => void executeClipboardCommand(store, 'copy'),
    cut: () => void executeClipboardCommand(store, 'cut'),
    paste: () => void executeClipboardCommand(store, 'paste'),
    'export-png': () => exportSelection('png'),
    'export-jpg': () => exportSelection('jpg'),
    'export-svg': () => exportSelection('svg'),
    'export-pdf': () => exportSelection('pdf'),
    'export-fig': () => exportSelection('fig'),
    'canvas-grid-toggle': () => {
      store.state.canvasGrid.visible = !store.state.canvasGrid.visible
      saveCanvasGridSettings(store.state.canvasGrid)
      store.requestRepaint()
    },
    'canvas-grid-dots': () => {
      store.state.canvasGrid.mode = 'dots'
      saveCanvasGridSettings(store.state.canvasGrid)
      store.requestRepaint()
    },
    'canvas-grid-lines': () => {
      store.state.canvasGrid.mode = 'lines'
      saveCanvasGridSettings(store.state.canvasGrid)
      store.requestRepaint()
    },
    preferences: openPreferences,
    'reset-panel-layout': resetPanelLayout,
    'capability-simple': () => setCapability('simple'),
    'capability-full': () => setCapability('full'),
    ...createSharedEditorMenuActions(setTheme)
  }

  function itemAction(item: AppMenuActionItem): (() => void) | undefined {
    return actions[item.id]
  }

  function checked(item: AppMenuActionItem): boolean | undefined {
    if (item.id.startsWith('window-panel-')) {
      const id = item.id.slice('window-panel-'.length) as PanelId
      return PANEL_IDS.includes(id) ? panelLayout.value.panels[id].open : undefined
    }
    switch (item.id) {
      case 'autosave':
        return store.state.autosaveEnabled
      case 'profiler':
        return store.renderer?.profiler.hudVisible ?? false
      case 'capability-simple':
        return capability.value === 'simple'
      case 'capability-full':
        return capability.value === 'full'
      case 'theme-light':
        return theme.value === 'light'
      case 'theme-grey':
        return theme.value === 'grey'
      case 'theme-dark':
        return theme.value === 'dark'
      case 'theme-midnight':
        return theme.value === 'midnight'
      case 'theme-auto':
        return theme.value === 'auto'
      case 'canvas-grid-toggle':
        return store.state.canvasGrid.visible
      case 'canvas-grid-dots':
        return store.state.canvasGrid.mode === 'dots'
      case 'canvas-grid-lines':
        return store.state.canvasGrid.mode === 'lines'
      default:
        return undefined
    }
  }

  function onCheckedChange(item: AppMenuActionItem): ((checked: boolean) => void) | undefined {
    if (item.id.startsWith('window-panel-')) {
      const id = item.id.slice('window-panel-'.length) as PanelId
      if (!PANEL_IDS.includes(id)) return undefined
      return (value: boolean) => {
        if (value) openRegisteredPanel(id)
        else closeRegisteredPanel(id)
      }
    }
    switch (item.id) {
      case 'autosave':
        return (value: boolean) => {
          store.state.autosaveEnabled = value
        }
      case 'profiler':
        return () => store.toggleProfiler()
      case 'capability-simple':
        return (value: boolean) => {
          if (value) setCapability('simple')
        }
      case 'capability-full':
        return (value: boolean) => {
          if (value) setCapability('full')
        }
      case 'theme-light':
      case 'theme-grey':
      case 'theme-dark':
      case 'theme-midnight':
      case 'theme-auto':
        return (value: boolean) => {
          if (value) itemAction(item)?.()
        }
      case 'canvas-grid-toggle':
      case 'canvas-grid-dots':
      case 'canvas-grid-lines':
        return (value: boolean) => {
          if (value) itemAction(item)?.()
          else if (item.id === 'canvas-grid-toggle') {
            store.state.canvasGrid.visible = false
            saveCanvasGridSettings(store.state.canvasGrid)
            store.requestRepaint()
          }
        }
      default:
        return undefined
    }
  }

  function menuLabel(entry: AppMenuActionItem): string {
    if (entry.id.startsWith('window-panel-')) {
      const id = entry.id.slice('window-panel-'.length) as PanelId
      return panels.value[id]
    }
    const key = translatedMenuItemLabels[entry.id]
    return key ? menu.value[key] : entry.label
  }

  function buildEntry(entry: AppMenuEntry): MenuEntry | null {
    if (!isVisible(entry)) return null
    if (isSeparator(entry)) return { separator: true }

    if (entry.command) {
      return commandMenuItem(entry.command, appMenuShortcutLabel(entry.id))
    }

    return {
      label: menuLabel(entry),
      shortcut: appMenuShortcutLabel(entry.id),
      action: itemAction(entry),
      checked: checked(entry),
      onCheckedChange: onCheckedChange(entry),
      sub: entry.sub?.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  function groupLabel(group: AppMenuGroupSchema): string {
    const key = group.label.toLowerCase() as keyof typeof menu.value
    return menu.value[key] ?? group.label
  }

  function buildGroup(group: AppMenuGroupSchema): AppMenuGroup | null {
    if (!isVisible(group)) return null
    return {
      label: groupLabel(group),
      items: group.items.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  const topMenus = computed<AppMenuGroup[]>(() =>
    APP_MENU_SCHEMA.map(buildGroup).filter((group): group is AppMenuGroup => group !== null)
  )

  return { topMenus }
}
