// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const EXPECTED_DEFAULTS = [
  { id: 'default-red', hex: '#F0002D' },
  { id: 'default-orange', hex: '#F38500' },
  { id: 'default-yellow', hex: '#F9C900' },
  { id: 'default-green', hex: '#5CCA53' },
  { id: 'default-mint', hex: '#4FCCB4' },
  { id: 'default-teal', hex: '#4DC7D2' },
  { id: 'default-sky', hex: '#4CC4EB' },
  { id: 'default-blue', hex: '#338BFF' },
  { id: 'default-indigo', hex: '#5F54FA' },
  { id: 'default-purple', hex: '#BF11E3' },
  { id: 'default-pink', hex: '#EF004D' },
  { id: 'default-brown', hex: '#A77D5A' },
  { id: 'default-white', hex: '#FFFFFF' },
  { id: 'default-light-grey', hex: '#D1D1D6' },
  { id: 'default-grey', hex: '#8E8E93' },
  { id: 'default-dark-grey', hex: '#3A3A3C' },
  { id: 'default-black', hex: '#000000' }
]

async function ensureSwatchesOpen(page: Page, canvas: CanvasHelper, clearSwatches = false): Promise<void> {
  await page.evaluate((shouldClear) => {
    if (shouldClear) {
      // oxlint-disable-next-line open-pencil/no-direct-storage-access
      localStorage.removeItem('silverpoint:swatches:v1')
    }
    const key = 'silverpoint:panel-layout'
    // oxlint-disable-next-line open-pencil/no-direct-storage-access
    const stored = localStorage.getItem(key)
    const layout = stored
      ? JSON.parse(stored)
      : {
          version: 4,
          dockWidths: { left: 240, right: 280 },
          docks: { left: ['pages', 'layers', 'swatches'], right: ['transform', 'appearance'] },
          floats: [],
          panels: {}
        }
    if (!layout.docks.left.includes('swatches')) {
      layout.docks.left.push('swatches')
    }
    layout.panels.swatches = {
      open: true,
      container: 'left',
      index: layout.docks.left.indexOf('swatches'),
      lastDock: { side: 'left', index: layout.docks.left.indexOf('swatches') },
      height: 280,
      collapsed: false,
      floatFallback: { x: 304, y: 160, width: 280, height: 560 }
    }
    // oxlint-disable-next-line open-pencil/no-direct-storage-access
    localStorage.setItem(key, JSON.stringify(layout))
  }, clearSwatches)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
}

test.describe('Swatches Panel', () => {
  test.beforeEach(async () => {
    test.setTimeout(90_000)
  })

  test('renders 17 defaults in binding order with no initial recents', async ({ page }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test')
    await canvas.waitForInit()
    await ensureSwatchesOpen(page, canvas, true)

    const panel = page.getByTestId('swatches-panel')
    await expect(panel).toBeVisible()

    const recentGrid = page.getByTestId('swatches-recent-grid')
    await expect(recentGrid).toHaveCount(0)

    const savedGrid = page.getByTestId('swatches-saved-grid')
    await expect(savedGrid).toBeVisible()

    const savedItems = savedGrid.getByTestId('swatch-item')
    await expect(savedItems).toHaveCount(17)

    for (let i = 0; i < EXPECTED_DEFAULTS.length; i++) {
      const expected = EXPECTED_DEFAULTS[i]
      const item = savedItems.nth(i)
      await expect(item).toHaveAttribute('data-swatch-id', expected.id)
      await expect(item).toHaveAttribute('data-swatch-hex', expected.hex)
    }

    canvas.assertNoErrors()
  })

  test('add current colour captures solid selection and updates recents without duplication', async ({ page }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test')
    await canvas.waitForInit()
    await ensureSwatchesOpen(page, canvas, true)

    const addBtn = page.getByTestId('swatches-add-current')
    await expect(addBtn).toBeDisabled()

    // Create a node with custom fill #1A334D
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('store missing')
      const pageNode = store.graph.getNode(store.state.currentPageId)
      const rect = store.graph.createNode('RECTANGLE', pageNode.id, {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3, a: 1 }, opacity: 1, visible: true }]
      })
      store.select([rect.id])
      store.requestRender()
    })
    await canvas.waitForRender()

    await expect(addBtn).toBeEnabled()
    await addBtn.click()

    const savedGrid = page.getByTestId('swatches-saved-grid')
    const savedItems = savedGrid.getByTestId('swatch-item')
    await expect(savedItems).toHaveCount(18)

    const recentGrid = page.getByTestId('swatches-recent-grid')
    await expect(recentGrid).toBeVisible()
    const recentItems = recentGrid.getByTestId('swatch-item')
    await expect(recentItems).toHaveCount(1)

    // Second click should be a no-op deduplication
    await addBtn.click()
    await expect(savedGrid.getByTestId('swatch-item')).toHaveCount(18)
    await expect(recentGrid.getByTestId('swatch-item')).toHaveCount(1)

    canvas.assertNoErrors()
  })

  test('applies swatch across multiple selections with single-step undo', async ({ page }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test')
    await canvas.waitForInit()
    await ensureSwatchesOpen(page, canvas, true)

    const ids = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('store missing')
      const pageNode = store.graph.getNode(store.state.currentPageId)
      const r1 = store.graph.createNode('RECTANGLE', pageNode.id, {
        x: 50,
        y: 50,
        width: 80,
        height: 80,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
      const r2 = store.graph.createNode('RECTANGLE', pageNode.id, {
        x: 150,
        y: 50,
        width: 80,
        height: 80,
        fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
      store.select([r1.id, r2.id])
      store.requestRender()
      return [r1.id, r2.id]
    })
    await canvas.waitForRender()

    // Click Blue swatch (#338BFF)
    const blueSwatch = page.locator('[data-swatch-id="default-blue"]').getByTestId('swatch-apply')
    await blueSwatch.click()
    await canvas.waitForRender()

    const fillsAfter = await page.evaluate((nodeIds) => {
      const store = window.openPencil?.getStore?.()
      return nodeIds.map((id) => store.graph.getNode(id)?.fills[0])
    }, ids)

    expect(fillsAfter[0]?.type).toBe('SOLID')
    expect(fillsAfter[0]?.color.r).toBeCloseTo(0.2, 1)
    expect(fillsAfter[1]?.type).toBe('SOLID')
    expect(fillsAfter[1]?.color.r).toBeCloseTo(0.2, 1)

    // Check recent colours now contains #338BFF as first
    const recentGrid = page.getByTestId('swatches-recent-grid')
    await expect(recentGrid.getByTestId('swatch-item').first()).toHaveAttribute('data-swatch-hex', '#338BFF')

    // Undo once
    await canvas.undo()

    const fillsAfterUndo = await page.evaluate((nodeIds) => {
      const store = window.openPencil?.getStore?.()
      return nodeIds.map((id) => store.graph.getNode(id)?.fills[0])
    }, ids)

    expect(fillsAfterUndo[0]?.color.r).toBe(1)
    expect(fillsAfterUndo[1]?.color.g).toBe(1)

    canvas.assertNoErrors()
  })

  test('deleting saved swatch persists through reload and leaves recents intact', async ({ page }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test')
    await canvas.waitForInit()
    await ensureSwatchesOpen(page, canvas, true)

    const redTile = page.locator('[data-swatch-id="default-red"]')
    await redTile.hover()
    await redTile.getByTestId('swatch-delete').click({ force: true })

    const savedGrid = page.getByTestId('swatches-saved-grid')
    await expect(savedGrid.getByTestId('swatch-item')).toHaveCount(16)
    await expect(page.locator('[data-swatch-id="default-red"]')).toHaveCount(0)

    // Reload without clearing swatches and verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' })
    await canvas.waitForInit()

    await expect(page.getByTestId('swatches-saved-grid').getByTestId('swatch-item')).toHaveCount(16)
    await expect(page.locator('[data-swatch-id="default-red"]')).toHaveCount(0)

    canvas.assertNoErrors()
  })

  test('recovers default palette from corrupt storage', async ({ page }) => {
    const canvas = new CanvasHelper(page)
    await page.goto('/?test')
    await canvas.waitForInit()

    await page.evaluate(() => {
      // oxlint-disable-next-line open-pencil/no-direct-storage-access
      localStorage.setItem('silverpoint:swatches:v1', '{ "invalid": true }')
    })
    await ensureSwatchesOpen(page, canvas, false)

    const savedItems = page.getByTestId('swatches-saved-grid').getByTestId('swatch-item')
    await expect(savedItems).toHaveCount(17)

    canvas.assertNoErrors()
  })
})
