// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, mock, test } from 'bun:test'
import { ref } from 'vue'

const PANEL_IDS = [
  'pages',
  'history',
  'assets',
  'layers',
  'swatches',
  'export',
  'variables',
  'ai',
  'code',
  'appearance',
  'transform',
  'text',
  'page',
  'guides',
  'mask',
  'component'
] as const

const layout = {
  value: {
    panels: Object.fromEntries(PANEL_IDS.map((id) => [id, { open: id === 'pages' }]))
  }
}
const requested: Array<[string, boolean]> = []
const reset = mock(() => {
  layout.value.panels = Object.fromEntries(PANEL_IDS.map((id) => [id, { open: id === 'pages' || id === 'layers' || id === 'transform' || id === 'appearance' }]))
})

mock.module('@open-pencil/vue', () => ({
  editorCommandMetadata: () => ({ shortcut: undefined }),
  formatShortcut: (shortcut: string | undefined) => shortcut,
  useEditorCommands: () => ({ menuItem: (id: string) => ({ label: id }) }),
  useI18n: () => ({
    menu: ref({ arrange: 'Arrange', resetPanelLayout: 'Reset Panel Layout', window: 'Window' }),
    panels: ref(Object.fromEntries(PANEL_IDS.map((id) => [id, id])),),
    locale: ref('en'),
    availableLocales: [],
    localeLabels: {},
    setLocale: () => undefined
  })
}))
mock.module('@/app/editor/active-store', () => ({
  useEditorStore: () => ({
    state: { selectedIds: new Set(), autosaveEnabled: false, canvasGrid: { visible: false, mode: 'dots' } },
    renderer: undefined
  })
}))
mock.module('@/app/shell/menu/use', () => ({ openFileDialog: () => undefined }))
mock.module('@/app/shell/theme', () => ({ useAppTheme: () => ({ theme: ref('dark'), setTheme: () => undefined }) }))
mock.module('@/app/shell/panels', () => ({
  PANEL_IDS,
  panelLayout: layout,
  openRegisteredPanel: (id: string) => requested.push([id, true]),
  closeRegisteredPanel: (id: string) => requested.push([id, false]),
  resetPanelLayout: reset
}))
mock.module('@/app/editor/clipboard/system', () => ({ executeClipboardCommand: () => undefined }))
mock.module('@/app/shell/canvas-grid', () => ({ saveCanvasGridSettings: () => undefined }))
mock.module('@/app/shell/preferences', () => ({ openPreferences: () => undefined }))

const { useAppMenu } = await import('@/app/shell/menu/app-menu')

function menuByLabel(label: string) {
  return useAppMenu().topMenus.value.find((menu) => menu.label === label)
}

describe('Window panel menu', () => {
  test('contains every registry panel as a checked Window item after Arrange', () => {
    const menus = useAppMenu().topMenus.value
    const arrangeIndex = menus.findIndex((menu) => menu.label === 'Arrange')
    const windowMenu = menuByLabel('Window')

    expect(windowMenu).toBeDefined()
    expect(menus[arrangeIndex + 1]?.label).toBe('Window')
    expect(windowMenu.items.slice(0, PANEL_IDS.length).map((item) => item.label)).toEqual([...PANEL_IDS])
    expect(windowMenu.items.slice(0, PANEL_IDS.length).every((item) => !('separator' in item) && typeof item.onCheckedChange === 'function')).toBe(true)
    expect(windowMenu.items[PANEL_IDS.length]).toEqual({ separator: true })
    expect(windowMenu.items[PANEL_IDS.length + 1].label).toBe('Reset Panel Layout')
  })

  test('checked state and checkbox commands honour the requested state', () => {
    const windowMenu = menuByLabel('Window')
    const pages = windowMenu.items[0]
    const assets = windowMenu.items[2]

    expect(pages.checked).toBe(true)
    expect(assets.checked).toBe(false)

    pages.onCheckedChange?.(false)
    assets.onCheckedChange?.(true)

    expect(requested).toEqual([
      ['pages', false],
      ['assets', true]
    ])
  })

  test('View and Window reset entries invoke the same reset behaviour', () => {
    const viewReset = menuByLabel('View').items.find((item) => item.label === 'Reset Panel Layout')
    const windowReset = menuByLabel('Window').items.at(-1)

    layout.value.panels.pages.open = false
    viewReset.action()
    expect(layout.value.panels).toMatchObject({ pages: { open: true }, layers: { open: true } })

    layout.value.panels.layers.open = false
    windowReset.action()
    expect(layout.value.panels).toMatchObject({ pages: { open: true }, layers: { open: true }, transform: { open: true }, appearance: { open: true } })
    expect(reset).toHaveBeenCalledTimes(2)
  })
})
