import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

async function getSelectedNodeFlags() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      type: n.type,
      independentCorners: n.independentCorners,
      independentStrokeWeights: n.independentStrokeWeights
    }
  })
}

async function drawFrame(x: number, y: number, w: number, h: number) {
  await canvas.pressKey('f')
  await canvas.drag(x, y, x + w, y + h)
  await canvas.waitForRender()
}

test('independent corners toggle shows per-corner inputs', async () => {
  await drawFrame(120, 120, 120, 80)
  await canvas.waitForRender()

  const flags = await getSelectedNodeFlags()
  expect(flags?.type).toBe('FRAME')
  expect(flags?.independentCorners).toBe(false)

  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await expect(toggle).toBeVisible()

  await toggle.click()
  await canvas.waitForRender()

  expect((await getSelectedNodeFlags())?.independentCorners).toBe(true)
  const grid = page.locator('[data-corner-grid]')
  await expect(grid).toBeVisible()
  const cornerInputs = grid.getByRole('spinbutton')
  expect(await cornerInputs.count()).toBe(4)

  await toggle.click()
  await canvas.waitForRender()
  await expect(grid).not.toBeVisible()
})

test('multi-selection independent corners toggle is one undo step', async () => {
  await canvas.clearCanvas()
  await drawFrame(80, 80, 100, 70)
  await drawFrame(240, 80, 100, 70)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  const independentStates = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return [...store.state.selectedIds].map(
        (id) => store.graph.getNode(id)?.independentCorners ?? null
      )
    })

  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await toggle.click()
  await canvas.waitForRender()
  expect(await independentStates()).toEqual([true, true])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await independentStates()).toEqual([false, false])
})

test('editing individual corner inputs updates node corner radii and supports undo', async () => {
  await canvas.clearCanvas()
  await drawFrame(100, 100, 150, 100)
  await canvas.waitForRender()

  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await toggle.click()
  await canvas.waitForRender()

  const grid = page.locator('[data-corner-grid]')
  await expect(grid).toBeVisible()

  const tl = grid.getByRole('spinbutton', { name: 'TL' })
  await tl.focus()
  await tl.fill('12')
  await tl.press('Enter')
  await canvas.waitForRender()

  const tr = grid.getByRole('spinbutton', { name: 'TR' })
  await tr.focus()
  await tr.fill('16')
  await tr.press('Enter')
  await canvas.waitForRender()

  const bl = grid.getByRole('spinbutton', { name: 'BL' })
  await bl.focus()
  await bl.fill('20')
  await bl.press('Enter')
  await canvas.waitForRender()

  const br = grid.getByRole('spinbutton', { name: 'BR' })
  await br.focus()
  await br.fill('24')
  await br.press('Enter')
  await canvas.waitForRender()

  const corners = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      tl: n.topLeftRadius,
      tr: n.topRightRadius,
      bl: n.bottomLeftRadius,
      br: n.bottomRightRadius
    }
  })

  expect(corners).toEqual({ tl: 12, tr: 16, bl: 20, br: 24 })

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()

  const cornersAfterUndo = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const n = id ? store.graph.getNode(id) : null
    return n?.bottomRightRadius ?? null
  })

  expect(cornersAfterUndo).toBe(0)
})

test('stroke sides toggle shows per-side weight inputs', async () => {
  await drawFrame(300, 50, 120, 80)
  await canvas.waitForRender()

  const addStroke = propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' })
  await expect(addStroke).toBeVisible()
  await addStroke.click()
  await canvas.waitForRender()

  const toggle = page.locator('[data-property="stroke-sides"]')
  await expect(toggle).toBeVisible({ timeout: 5000 })

  const sectionInputsBefore = await propertySection(page, 'Stroke').getByRole('spinbutton').count()

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsAfter = await propertySection(page, 'Stroke').getByRole('spinbutton').count()
  expect(sectionInputsAfter).toBeGreaterThan(sectionInputsBefore)

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsFinal = await propertySection(page, 'Stroke').getByRole('spinbutton').count()
  expect(sectionInputsFinal).toBe(sectionInputsBefore)
})
