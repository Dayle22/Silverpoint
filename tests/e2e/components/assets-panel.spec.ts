// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

async function ensureAssetsOpen(page: Page, canvas: CanvasHelper): Promise<void> {
  await page.evaluate(() => {
    const key = 'silverpoint:panel-layout'
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup seeds the persisted panel layout.
    const stored = localStorage.getItem(key)
    const layout = stored
      ? (JSON.parse(stored) as { docks: { left: string[]; right: string[] }; panels: Record<string, Record<string, unknown>> })
      : {
          version: 2,
          dockWidths: { left: 240, right: 280 },
          docks: { left: ['pages', 'layers'], right: ['transform', 'appearance'] },
          panels: {}
        }
    layout.docks.left = ['assets']
    layout.docks.right = ['component']
    layout.panels.pages = { ...layout.panels.pages, open: false }
    layout.panels.layers = { ...layout.panels.layers, open: false }
    layout.panels.transform = { ...layout.panels.transform, open: false }
    layout.panels.appearance = { ...layout.panels.appearance, open: false }
    layout.panels.component = {
      ...layout.panels.component,
      open: true,
      placement: 'docked',
      lastDock: { side: 'right', index: 0 },
      collapsed: false
    }
    layout.panels.assets = {
      ...layout.panels.assets,
      open: true,
      placement: 'docked',
      lastDock: { side: 'left', index: 1 },
      collapsed: false
    }
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup writes the persisted panel layout.
    localStorage.setItem(key, JSON.stringify(layout))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
}

async function selectedNodeSnapshot(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    const selected = selectedId ? store.graph.getNode(selectedId) : null
    return selected
      ? {
          id: selected.id,
          type: selected.type,
          parentId: selected.parentId,
          componentId: selected.componentId,
          pageId: store.state.currentPageId,
          width: selected.width,
          childTexts: store.graph
            .getChildren(selected.id)
            .filter((child) => child.type === 'TEXT')
            .map((child) => child.text)
        }
      : null
  })
}

test('assets panel groups component sets and inserts the default variant', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  await ensureAssetsOpen(page, canvas)

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')

    const set = store.graph.createNode('COMPONENT_SET', pageNode.id, {
      name: 'Button',
      x: 80,
      y: 80,
      width: 260,
      height: 100,
      sourceLibraryKey: 'lk-test-library',
      symbolDescription: 'Reusable button component',
      symbolLinks: [{ uri: 'https://example.com/button', displayName: 'Button docs' }],
      componentPropertyDefinitions: [
        {
          id: 'prop:type',
          name: 'Type',
          type: 'VARIANT',
          defaultValue: 'Secondary',
          variantOptions: ['Primary', 'Secondary']
        }
      ]
    })
    const primary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Primary',
      x: 0,
      y: 0,
      width: 96,
      height: 40,
      componentPropertyValues: { Type: 'Primary' }
    })
    store.graph.createNode('TEXT', primary.id, {
      name: 'Label',
      text: 'Primary',
      width: 72,
      height: 20
    })
    const secondary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Secondary',
      x: 120,
      y: 0,
      width: 132,
      height: 40,
      componentPropertyValues: { Type: 'Secondary' }
    })
    store.graph.createNode('TEXT', secondary.id, {
      name: 'Label',
      text: 'Secondary',
      width: 96,
      height: 20
    })
    const duplicateSecondary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Secondary duplicate',
      x: 280,
      y: 0,
      width: 132,
      height: 40,
      componentPropertyValues: { Type: 'Secondary' }
    })
    const card = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Card',
      x: 80,
      y: 240,
      width: 160,
      height: 100
    })
    store.requestRender()
    return {
      setId: set.id,
      primaryId: primary.id,
      secondaryId: secondary.id,
      duplicateSecondaryId: duplicateSecondary.id,
      cardId: card.id
    }
  })
  await canvas.waitForRender()

  const assetsPanel = page.getByTestId('assets-panel')
  const assetItems = page.getByTestId('asset-item')
  await expect(assetItems).toHaveCount(2)
  await expect(assetsPanel).toContainText('Button')
  await expect(assetsPanel).toContainText('Card')
  await expect(assetsPanel).not.toContainText('Type=Primary')
  await expect(assetsPanel).not.toContainText('Type=Secondary')
  const buttonAsset = page.locator(`[data-asset-id="${ids.setId}"]`)
  await expect(buttonAsset.getByTestId('asset-variant-summary')).toContainText('Type')
  await expect(buttonAsset.getByTestId('asset-library-badge')).toContainText('Library')
  await expect(buttonAsset.getByTestId('asset-description')).toContainText(
    'Reusable button component'
  )
  await expect(buttonAsset.getByTestId('asset-docs')).toBeVisible()
  await expect(buttonAsset.getByTestId('asset-variant-conflict')).toContainText(
    'Duplicate variant values'
  )

  await buttonAsset.click()
  const details = page.getByTestId('asset-details-dialog')
  await expect(details).toBeVisible()
  await expect(details).toContainText('Button')
  await expect(details.getByTestId('asset-details-preview')).toBeVisible()
  await expect(details.getByTestId('asset-details-preview-image')).toBeVisible()
  await expect(details.getByTestId('asset-details-description')).toContainText(
    'Reusable button component'
  )
  await expect(details.getByTestId('asset-details-library')).toContainText('lk-test-library')
  await expect(details.getByTestId('asset-details-docs')).toBeVisible()
  await expect(details.getByTestId('asset-details-property')).toContainText('Type')
  await page.getByTestId('asset-details-close').click()
  await expect(details).toBeHidden()

  await page.getByTestId('assets-search').fill('card')
  await expect(assetItems).toHaveCount(1)
  await expect(assetsPanel).toContainText('Card')
  await page.locator(`[data-asset-id="${ids.cardId}"]`).getByTestId('asset-insert').click()
  await canvas.waitForRender()

  const cardInstance = await selectedNodeSnapshot(page)
  expect(cardInstance?.type).toBe('INSTANCE')
  expect(cardInstance?.componentId).toBe(ids.cardId)

  await page.getByTestId('assets-search').fill('missing asset')
  await expect(page.getByTestId('assets-empty')).toBeVisible()
  await expect(assetItems).toHaveCount(0)

  await page.getByTestId('assets-search').fill('button')
  await expect(assetItems).toHaveCount(1)
  await page.locator(`[data-asset-id="${ids.setId}"]`).getByTestId('asset-insert').click()
  await canvas.waitForRender()

  const inserted = await selectedNodeSnapshot(page)

  expect(inserted?.type).toBe('INSTANCE')
  expect(inserted?.componentId).toBe(ids.secondaryId)
  expect(inserted?.parentId).toBe(inserted?.pageId)
  expect(inserted?.width).toBe(132)
  expect(inserted?.childTexts).toEqual(['Secondary'])

  const variantSection = page.getByRole('region', { name: 'Variants' })
  await expect(variantSection).toBeVisible()

  await variantSection.getByRole('combobox', { name: 'Type' }).click()
  await page.getByRole('option', { name: 'Primary' }).click()

  expectDefined(inserted?.id, 'inserted instance id')
  const switched = await selectedNodeSnapshot(page)
  expect(switched?.componentId).toBe(ids.primaryId)
  expect(switched?.width).toBe(96)
  expect(switched?.childTexts).toEqual(['Primary'])

  canvas.assertNoErrors()
})

test('assets insertion accounts for entered container coordinates', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  await ensureAssetsOpen(page, canvas)

  const setup = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')
    const frame = store.graph.createNode('FRAME', pageNode.id, {
      name: 'Target Frame',
      x: 200,
      y: 150,
      width: 300,
      height: 240
    })
    const component = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Panel Card',
      x: 40,
      y: 40,
      width: 120,
      height: 60
    })
    store.state.enteredContainerId = frame.id
    store.requestRender()
    return { frameId: frame.id, componentId: component.id }
  })
  await canvas.waitForRender()

  await page.locator(`[data-asset-id="${setup.componentId}"]`).getByTestId('asset-insert').click()
  await canvas.waitForRender()

  const inserted = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    const selected = selectedId ? store.graph.getNode(selectedId) : null
    if (!selected) return null
    const abs = store.graph.getAbsolutePosition(selected.id)
    const center = store.screenToCanvas(
      ...(Object.values(store.viewportCanvasCenter()) as [number, number])
    )
    return {
      parentId: selected.parentId,
      centerX: abs.x + selected.width / 2,
      centerY: abs.y + selected.height / 2,
      expectedCenterX: center.x,
      expectedCenterY: center.y
    }
  })

  expect(inserted?.parentId).toBe(setup.frameId)
  expect(inserted?.centerX).toBeCloseTo(inserted?.expectedCenterX ?? 0, 1)
  expect(inserted?.centerY).toBeCloseTo(inserted?.expectedCenterY ?? 0, 1)
  canvas.assertNoErrors()
})

test('demo exposes component set assets', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo')
  await canvas.waitForInit()
  await ensureAssetsOpen(page, canvas)

  const assetsPanel = page.getByTestId('assets-panel')

  await expect(assetsPanel).toContainText('Button')
  await expect(assetsPanel).toContainText('2 variants · Variant')
  await expect(assetsPanel).toContainText('Avatar')
  await expect(assetsPanel).not.toContainText('Button/Primary')

  canvas.assertNoErrors()
})
