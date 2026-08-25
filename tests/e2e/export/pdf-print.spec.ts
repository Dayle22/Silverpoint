import { test, expect, type Page } from '@playwright/test'

import { ensurePanelOpen } from '#tests/e2e/panels/helpers'
import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItems, propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  // The Export panel is not in DEFAULT_OPEN, so it must be opened explicitly
  // before its section can be located.
  await ensurePanelOpen(page, canvas, 'export', 'right', 0)
  await canvas.clearCanvas()
})

test.afterAll(async () => {
  await page.close()
})

function exportItems() {
  return propertyItems(page, 'exportSettings')
}

function exportButton() {
  return page.getByTestId('export-button')
}

async function forceBlobDownload() {
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined
  })
}

async function createFrames(count: number, withBlur = false) {
  const ids = await page.evaluate(
    ({ frameCount, hasBlur }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      for (const node of store.graph.getChildren(store.state.currentPageId)) {
        store.graph.deleteNode(node.id)
      }
      store.undo.clear()
      const frameIds: string[] = []
      for (let i = 0; i < frameCount; i++) {
        const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
          name: `Print Frame ${i + 1}`,
          x: 100 + i * 250,
          y: 100,
          width: 200,
          height: 200
        })
        store.graph.createNode('RECTANGLE', frame.id, {
          name: `Card ${i + 1}`,
          x: 20,
          y: 20,
          width: 100,
          height: 100,
          fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
          effects: hasBlur
            ? [
                {
                  type: 'BACKGROUND_BLUR',
                  radius: 8,
                  visible: true,
                  color: { r: 0, g: 0, b: 0, a: 0 },
                  offset: { x: 0, y: 0 },
                  spread: 0
                }
              ]
            : []
        })
        frameIds.push(frame.id)
      }
      store.select(frameIds)
      store.requestRender()
      return frameIds
    },
    { frameCount: count, hasBlur: withBlur }
  )
  await canvas.waitForRender()
  return ids
}

test('PDF (print) appears in format selector for a single-frame selection', async () => {
  await createFrames(1)

  await propertySection(page, 'Export').getByRole('button', { name: 'Add export' }).click()
  await canvas.waitForRender()

  const formatTrigger = exportItems().first().getByRole('combobox', { name: 'Export format' })
  await formatTrigger.click()

  const printOption = page.locator('[role="option"]').filter({ hasText: 'PDF (print)' })
  await expect(printOption).toBeVisible()

  await printOption.click()
  await canvas.waitForRender()

  await expect(formatTrigger).toHaveText('PDF (print)')
  canvas.assertNoErrors()
})

test('PDF (print) does not appear for a multi-frame selection', async () => {
  await createFrames(2)

  await propertySection(page, 'Export').getByRole('button', { name: 'Add export' }).click()
  await canvas.waitForRender()

  const formatTrigger = exportItems().first().getByRole('combobox', { name: 'Export format' })
  await formatTrigger.click()

  const printOption = page.locator('[role="option"]').filter({ hasText: 'PDF (print)' })
  await expect(printOption).toHaveCount(0)

  await page.locator('[role="option"]').filter({ hasText: 'PNG' }).click()
  canvas.assertNoErrors()
})

test('preflight warning renders when raster fallback is triggered by background blur', async () => {
  await createFrames(1, true)

  await propertySection(page, 'Export').getByRole('button', { name: 'Add export' }).click()
  await canvas.waitForRender()

  const formatTrigger = exportItems().first().getByRole('combobox', { name: 'Export format' })
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'PDF (print)' }).click()
  await canvas.waitForRender()

  const warnings = page.getByTestId('export-preflight-warnings')
  await expect(warnings).toBeVisible()
  await expect(warnings).toContainText('Rasterised because:')
  await expect(warnings).toContainText('Background blur on')
  canvas.assertNoErrors()
})

test('single frame production PDF export downloads directly', async () => {
  await createFrames(1, false)
  await forceBlobDownload()

  await propertySection(page, 'Export').getByRole('button', { name: 'Add export' }).click()
  await canvas.waitForRender()

  const formatTrigger = exportItems().first().getByRole('combobox', { name: 'Export format' })
  await formatTrigger.click()
  await page.locator('[role="option"]').filter({ hasText: 'PDF (print)' }).click()
  await canvas.waitForRender()

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton().click()])
  expect(download.suggestedFilename()).toBe('Print Frame 1.pdf')
  canvas.assertNoErrors()
})
