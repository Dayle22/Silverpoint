import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
})

test.afterAll(async () => {
  await page.close()
})

test('toolbar flyout opens barcode popover and inserts QR code vector artwork', async () => {
  const barcodeTool = page.getByTestId(toolbarToolTestId('BARCODE'))
  await expect(barcodeTool).toBeVisible()
  await barcodeTool.click()

  const popover = page.getByTestId('barcode-generator-popover')
  await expect(popover).toBeVisible()

  const payloadInput = page.getByTestId('barcode-qr-payload')
  await payloadInput.fill('https://silverpoint.org')

  const scanStatus = page.getByTestId('barcode-scan-status')
  await expect(scanStatus).toHaveText('PASS')

  const insertBtn = page.getByTestId('barcode-insert')
  await insertBtn.click()
  await canvas.waitForRender()

  const qrData = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedIds = [...store.state.selectedIds]
    if (selectedIds.length !== 1) return null
    const frame = store.graph.getNode(selectedIds[0])
    if (!frame) return null
    const children = store.graph.getChildren(frame.id)
    return {
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height,
      pluginData: frame.pluginData ?? [],
      childRoles: children.map((c) => (c.pluginData ?? []).find((p) => p.key === 'barcodeRole')?.value),
      childTypes: children.map((c) => c.type),
      childNetworks: children.map((c) => c.vectorNetwork?.regions.length ?? 0)
    }
  })

  expect(qrData).not.toBeNull()
  expect(qrData?.name).toBe('QR Code')
  expect(qrData?.childRoles).toContain('background')
  expect(qrData?.childRoles).toContain('modules')
  expect(qrData?.childTypes.every((t) => t === 'VECTOR')).toBe(true)
  expect(qrData?.childNetworks.every((count) => count > 0)).toBe(true)

  canvas.assertNoErrors()
})

test('BarcodeSection in properties panel allows in-place regeneration preserving frame ID', async () => {
  const barcodeSection = page.getByTestId('barcode-properties-section')
  await expect(barcodeSection).toBeVisible()

  const initialFrameId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0]
  })

  const payloadInput = page.getByTestId('barcode-prop-payload')
  await payloadInput.fill('https://silverpoint.org/updated')

  const styleSelect = page.getByTestId('barcode-prop-style')
  await styleSelect.selectOption('dots')

  const regenerateBtn = page.getByTestId('barcode-prop-regenerate')
  await regenerateBtn.click()
  await canvas.waitForRender()

  const updatedData = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frameId = [...store.state.selectedIds][0]
    const frame = store.graph.getNode(frameId)
    return {
      id: frame?.id,
      pluginData: frame?.pluginData ?? []
    }
  })

  expect(updatedData.id).toBe(initialFrameId)
  const barcodeMeta = (updatedData.pluginData ?? []).find((p) => p.key === 'barcode')?.value
  expect(barcodeMeta).toContain('https://silverpoint.org/updated')
  expect(barcodeMeta).toContain('dots')

  canvas.assertNoErrors()
})

test('inserts EAN-13 barcode with 95-module pattern and text child', async () => {
  const barcodeTool = page.getByTestId(toolbarToolTestId('BARCODE'))
  await barcodeTool.click()

  const eanTab = page.getByTestId('barcode-type-ean13')
  await eanTab.click()

  const eanInput = page.getByTestId('barcode-ean-payload')
  await eanInput.fill('978020137962')

  const insertBtn = page.getByTestId('barcode-insert')
  await insertBtn.click()
  await canvas.waitForRender()

  const eanData = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frameId = [...store.state.selectedIds][0]
    const frame = store.graph.getNode(frameId)
    const children = store.graph.getChildren(frameId)
    return {
      id: frame?.id,
      name: frame?.name,
      children: children.map((c) => ({
        type: c.type,
        role: (c.pluginData ?? []).find((p) => p.key === 'barcodeRole')?.value,
        text: c.text,
        regions: c.vectorNetwork?.regions.length ?? 0
      }))
    }
  })

  expect(eanData.name).toBe('EAN-13 Barcode')
  expect(eanData.children.some((c) => c.role === 'modules' && c.type === 'VECTOR' && c.regions > 0)).toBe(true)
  expect(eanData.children.some((c) => c.role === 'background' && c.type === 'VECTOR' && c.regions > 0)).toBe(true)
  expect(eanData.children.some((c) => c.role === 'text' && c.type === 'TEXT')).toBe(true)

  canvas.assertNoErrors()
})
