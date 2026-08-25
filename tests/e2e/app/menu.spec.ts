import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

async function closeMenu() {
  const rootMenu = editor.page.locator('[role="menu"]').first()
  for (let i = 0; i < 5; i++) {
    if (!(await rootMenu.isVisible())) break
    await editor.page.keyboard.press('Escape')
    await editor.page.waitForTimeout(50)
  }
}

async function openAppMenu() {
  const rootMenu = editor.page.locator('[role="menu"]').first()
  if (!(await rootMenu.isVisible())) {
    const trigger = editor.page.getByTestId('app-icon-menu-trigger')
    await trigger.click()
    await expect(rootMenu).toBeVisible()
  }
  return rootMenu
}

async function openGroup(groupName: string) {
  await openAppMenu()
  const group = editor.page.getByTestId(`app-menu-group-${groupName.toLowerCase()}`)
  await expect(group).toBeVisible()
  await group.hover()
  await editor.page.waitForTimeout(300)
  return editor.page.locator('[role="menu"]').last()
}

test.beforeEach(async () => {
  await closeMenu()
})

function getStoreStateNumber(key: 'selectedIds' | 'zoom') {
  return editor.page.evaluate((stateKey) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    if (stateKey === 'selectedIds') return store.state.selectedIds.size
    return store.state.zoom
  }, key)
}

test('app icon menu trigger is visible in browser mode', async () => {
  const trigger = editor.page.getByTestId('app-icon-menu-trigger')
  await expect(trigger).toBeVisible()
})

test('app icon menu has all top-level group menus', async () => {
  const rootMenu = await openAppMenu()
  const groups = rootMenu.locator('[role="menuitem"]')
  const labels = await groups.allTextContents()
  expect(labels).toEqual(['File', 'Edit', 'View', 'Object', 'Text', 'Arrange', 'Window'])
  await closeMenu()
})

test('File menu opens and shows items', async () => {
  const menu = await openGroup('File')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"], [role="menuitemcheckbox"]').allTextContents()
  expect(items.some((t) => t.toLowerCase().includes('open'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('save'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('save as'))).toBe(true)

  await closeMenu()
})

test('Edit menu shows Undo/Redo/Delete', async () => {
  const menu = await openGroup('Edit')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.toLowerCase().includes('undo'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('redo'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('delete'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('select all'))).toBe(true)

  await closeMenu()
})

test('View menu shows zoom options', async () => {
  const menu = await openGroup('View')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.toLowerCase().includes('zoom to fit'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('zoom in'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('zoom out'))).toBe(true)

  await closeMenu()
})

test('Object menu shows Group/Ungroup/Component', async () => {
  const menu = await openGroup('Object')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.toLowerCase().includes('group'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('ungroup'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('component'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('front'))).toBe(true)
  expect(items.some((t) => t.toLowerCase().includes('back'))).toBe(true)

  await closeMenu()
})

test('subitem submenu opens (View -> Theme)', async () => {
  const viewMenu = await openGroup('View')
  await expect(viewMenu).toBeVisible()

  const themeTrigger = viewMenu.locator('[role="menuitem"]', { hasText: /Theme/i })
  await expect(themeTrigger).toBeVisible()
  await themeTrigger.hover()
  await editor.page.waitForTimeout(300)

  const subMenu = editor.page.locator('[role="menu"]').last()
  await expect(subMenu).toBeVisible()
  const themeItems = await subMenu.locator('[role="menuitemcheckbox"]').allTextContents()
  expect(themeItems.some((t) => t.toLowerCase().includes('light'))).toBe(true)
  expect(themeItems.some((t) => t.toLowerCase().includes('dark'))).toBe(true)

  await closeMenu()
})

test('Undo via Edit menu works', async () => {
  await editor.canvas.drawRect(200, 200, 100, 100)
  const beforeUndo = await getStoreStateNumber('selectedIds')
  expect(beforeUndo).toBe(1)

  const menu = await openGroup('Edit')
  await menu.locator('[role="menuitem"]', { hasText: /Undo/i }).click()
  await editor.canvas.waitForRender()

  const afterUndo = await getStoreStateNumber('selectedIds')
  expect(afterUndo).toBe(0)
})

test('Duplicate via Edit menu works', async () => {
  await editor.canvas.drawRect(300, 300, 80, 80)

  const countBefore = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  const menu = await openGroup('Edit')
  await menu.locator('[role="menuitem"]', { hasText: /Duplicate/i }).click()
  await editor.canvas.waitForRender()

  const countAfter = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  expect(countAfter).toBe(countBefore + 1)
})

test('Zoom to fit via View menu works', async () => {
  let menu = await openGroup('View')
  await menu.locator('[role="menuitem"]', { hasText: /Zoom In/i }).click()
  await editor.canvas.waitForRender()

  const zoomBefore = await getStoreStateNumber('zoom')
  expect(zoomBefore).toBeGreaterThan(1)

  menu = await openGroup('View')
  await menu.locator('[role="menuitem"]', { hasText: /Zoom to Fit/i }).click()
  await editor.canvas.waitForRender()

  const zoomAfter = await getStoreStateNumber('zoom')
  expect(zoomAfter).not.toBe(zoomBefore)
})

// T-042 regression coverage: the app-icon menu button must render only in
// the desktop-browser chrome case (!isMobile && showChrome && showUI). Each
// of these opens its own isolated page rather than reusing `editor` above,
// since `?no-chrome` must be set before the page ever loads and toggling
// showUI here must not leak into the serial suite above.
test.describe('app icon menu trigger absence outside desktop-browser chrome', () => {
  test.describe('?no-chrome', () => {
    const chromelessEditor = useEditorSetup('/?no-chrome')

    test('app icon menu trigger is absent', async () => {
      await expect(chromelessEditor.page.getByTestId('app-icon-menu-trigger')).toHaveCount(0)
    })
  })

  test.describe('showUI=false', () => {
    const collapsedEditor = useEditorSetup()

    test('app icon menu trigger is absent once UI is collapsed', async () => {
      await expect(collapsedEditor.page.getByTestId('app-icon-menu-trigger')).toBeVisible()
      await collapsedEditor.page.getByTestId('app-toggle-ui').click()
      await expect(collapsedEditor.page.getByTestId('app-icon-menu-trigger')).toHaveCount(0)
      // Restore state in case Playwright reuses this page for later specs.
      await collapsedEditor.page.getByTestId('editor-show-ui').click()
      await expect(collapsedEditor.page.getByTestId('app-icon-menu-trigger')).toBeVisible()
    })
  })
})

// Mobile is intentionally NOT covered here: no e2e spec in tests/e2e
// establishes a harness for tripping the app's `useViewportKind().isMobile`
// (a @vueuse `breakpoints.smaller('mobile')` at 768px) via
// `page.setViewportSize`; every existing `setViewportSize` call in the
// suite targets desktop-sized viewports for other purposes. Inventing a new
// mobile e2e harness here would exceed this fix's scope.
