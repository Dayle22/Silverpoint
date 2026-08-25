import { expect, test } from '@playwright/test'

// Cold start (CanvasKit WASM + Yoga WASM + font loading) can exceed the
// global 15s Playwright test timeout (playwright.config.ts) before
// 'editor-root' appears. This file bootstraps inline rather than through
// tests/e2e/fixtures.ts's useEditorSetup, so it needs its own headroom.
test.beforeEach(() => {
  test.setTimeout(60_000)
})

test('canvas grid toggles without changing document content and persists its mode', async ({ page }) => {
  await page.goto('/?test')
  await page.getByTestId('editor-root').waitFor()

  const before = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return JSON.stringify([...store.graph.nodes.values()])
  })

  // DEFAULT_CANVAS_GRID_SETTINGS.visible is true (packages/core/src/canvas/grid.ts),
  // and that default-visible behaviour is already user-verified (T-029/RECEIPT-105).
  // Only exercise the mode toggle here; do not also click 'Show Grid', which would
  // flip visibility to false and contradict the visible:true assertion below.
  const appMenuTrigger = page.getByTestId('app-icon-menu-trigger')
  await expect(appMenuTrigger).toBeVisible()
  await appMenuTrigger.click()
  const viewGroup = page.getByTestId('app-menu-group-view')
  await expect(viewGroup).toBeVisible()
  await viewGroup.hover()
  const gridItem = page.getByRole('menuitem', { name: 'Canvas Grid' })
  await expect(gridItem).toBeVisible()
  await gridItem.hover()
  await page.getByRole('menuitemcheckbox', { name: 'Lines' }).click()

  const state = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      grid: store.state.canvasGrid,
      graph: JSON.stringify([...store.graph.nodes.values()])
    }
  })

  expect(state.grid).toEqual({ visible: true, mode: 'lines', spacing: 16, dotSize: 1.5, opacity: 0.2, color: '#808080' })
  expect(state.graph).toBe(before)

  await page.reload()
  await page.getByTestId('editor-root').waitFor()
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.canvasGrid))
    .toEqual({ visible: true, mode: 'lines', spacing: 16, dotSize: 1.5, opacity: 0.2, color: '#808080' })
})

test('preferences composes theme and grid settings without exposing credentials', async ({ page }) => {
  await page.goto('/?test')
  await page.getByTestId('editor-root').waitFor()

  const openPreferences = async () => {
    const trigger = page.getByTestId('app-icon-menu-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    const editGroup = page.getByTestId('app-menu-group-edit')
    await expect(editGroup).toBeVisible()
    await editGroup.hover()
    const preferencesItem = page.getByRole('menuitem', { name: 'Preferences' })
    await expect(preferencesItem).toBeVisible()
    await preferencesItem.click()
  }

  await openPreferences()

  const dialog = page.getByRole('dialog', { name: 'Preferences' })
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('preferences-tab-ai').click()
  await expect(dialog.getByRole('region', { name: 'AI' })).not.toContainText('API key')

  await dialog.getByTestId('preferences-tab-appearance').click()
  await dialog.getByRole('combobox', { name: 'UI scale' }).click()
  await page.getByRole('option', { name: '120%' }).click()

  await dialog.getByTestId('preferences-tab-canvas').click()
  await dialog.getByRole('checkbox', { name: 'Background grid' }).check()
  await dialog.getByRole('combobox', { name: 'Grid style' }).click()
  await page.getByRole('option', { name: 'Dots' }).click()
  await dialog.getByRole('spinbutton', { name: 'Grid spacing' }).fill('24')
  await dialog.getByRole('spinbutton', { name: 'Dot size' }).fill('3')
  await dialog.getByRole('spinbutton', { name: 'Grid opacity' }).fill('40')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()

  await page.reload()
  await page.getByTestId('editor-root').waitFor()
  await openPreferences()
  await dialog.getByTestId('preferences-tab-appearance').click()
  await expect(page.getByRole('combobox', { name: 'UI scale' })).toContainText('120%')
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.canvasGrid))
    .toEqual({ visible: true, mode: 'dots', spacing: 24, dotSize: 3, opacity: 0.4, color: '#808080' })
})
