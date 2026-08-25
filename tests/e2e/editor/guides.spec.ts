import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('creates, moves, removes, and undoes page guides from visible rulers', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const bounds = await page.getByTestId('canvas-area').boundingBox()
  if (!bounds) throw new Error('Canvas area has no bounding box')

  await page.mouse.move(bounds.x + 160, bounds.y + 10)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 220, bounds.y + 180, { steps: 6 })
  await page.mouse.up()
  await page.mouse.move(bounds.x + 10, bounds.y + 160)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 260, bounds.y + 220, { steps: 6 })
  await page.mouse.up()

  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.() ?? []))
    .toEqual([
      { axis: 'Y', offset: expect.any(Number) },
      { axis: 'X', offset: expect.any(Number) }
    ])

  const horizontalScreenY = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const guide = store?.getPageGuides?.()[0]
    if (!store || !guide) throw new Error('Expected horizontal guide')
    return guide.offset * store.state.zoom + store.state.panY
  })
  await page.mouse.move(bounds.x + 240, bounds.y + horizontalScreenY)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 240, bounds.y + horizontalScreenY + 40, { steps: 5 })
  await page.mouse.up()
  const movedOffset = await page.evaluate(
    () => window.openPencil?.getStore?.()?.getPageGuides?.()[0]?.offset
  )
  expect(movedOffset).toEqual(expect.any(Number))

  await page.mouse.move(bounds.x + 240, bounds.y + horizontalScreenY + 40)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 240, bounds.y + 10, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.().length))
    .toBe(1)

  await page.keyboard.press('Control+z')
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.().length))
    .toBe(2)

  await page.keyboard.press('Control+Shift+z')
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.().length))
    .toBe(1)

  await page.keyboard.press('Control+z')
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.().length))
    .toBe(2)

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (store) store.state.showRulers = false
  })
  await page.mouse.move(bounds.x + 180, bounds.y + 10)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 200, bounds.y + 200)
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.getPageGuides?.().length))
    .toBe(2)
  canvas.assertNoErrors()
})

test('visual frame margins bleed and page guides remain crisp', async ({ page }) => {
  await page.goto('/?test&no-chrome')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Store not ready')
    const frameId = store.createShape('FRAME', 180, 130, 360, 240)
    store.createShape('RECTANGLE', 70, 60, 140, 90, frameId)
    const frame = store.graph.getNode(frameId)
    if (!frame) throw new Error('Frame not ready')
    store.updateNode(frameId, {
      pluginData: [
        {
          pluginId: 'open-pencil',
          key: 'frameGuides',
          value: JSON.stringify({
            version: 1,
            margins: {
              enabled: true,
              linked: false,
              top: 24,
              right: 32,
              bottom: 40,
              left: 48
            },
            bleed: {
              enabled: true,
              linked: true,
              top: 16,
              right: 16,
              bottom: 16,
              left: 16
            }
          })
        }
      ]
    })
    store.addPageGuide('X', 260)
    store.addPageGuide('Y', 210)
    store.clearSelection()
    store.requestRender()
  })
  await canvas.waitForRender()

  await expect(page.getByTestId('canvas-area')).toHaveScreenshot('guides-frame-overlays.png')
  canvas.assertNoErrors()
})

test('edits linked and independent frame margins and bleed in the Guides section', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Store not ready')
    const id = store.createShape('FRAME', 120, 100, 320, 240)
    store.select([id])
    store.requestRender()
  })

  await expect(page.getByRole('heading', { name: 'Guides' })).toBeVisible()
  const margins = page.locator('[data-property="frame-guides-margins"]')
  const bleed = page.locator('[data-property="frame-guides-bleed"]')
  await expect(margins).toBeVisible()
  await expect(bleed).toBeVisible()

  await margins.getByRole('button', { name: 'Show' }).click()
  await margins.getByRole('button', { name: 'Unlink sides' }).click()
  await expect(margins.getByRole('spinbutton', { name: 'Top' })).toBeVisible()
  const topMargin = margins.getByRole('spinbutton', { name: 'Top' })
  await topMargin.click()
  await topMargin.press('Control+A')
  await topMargin.pressSequentially('24')
  await topMargin.press('Enter')
  await bleed.getByRole('button', { name: 'Show' }).click()

  const stored = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = [...(store?.state.selectedIds ?? [])][0]
    return id ? store?.graph.getNode(id)?.pluginData : []
  })
  const frameGuides = stored?.find(
    (entry) => entry.pluginId === 'open-pencil' && entry.key === 'frameGuides'
  )
  expect(frameGuides).toBeDefined()
  const value = JSON.parse(frameGuides?.value ?? '{}')
  expect(value).toMatchObject({
    version: 1,
    margins: { enabled: true, linked: false, top: 24 },
    bleed: { enabled: true, linked: true }
  })
  canvas.assertNoErrors()
})
