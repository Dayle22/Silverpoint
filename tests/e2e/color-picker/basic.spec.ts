import { expect, test, type Page } from '@playwright/test'

import type { OkHCLPayload } from '@open-pencil/core/color'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItem, propertySection } from '#tests/helpers/properties'

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

async function getSelectedFill() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.graph.getNode(id)
    return node?.fills?.[0] ?? null
  })
}

async function getSelectedFillOkHCL() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const node = store.graph.getNode(id)
    const entry = node?.pluginData.find(
      (value) => value.pluginId === 'open-pencil' && value.key === 'okhcl'
    )
    if (!entry) return null
    const payload = JSON.parse(entry.value) as Partial<OkHCLPayload>
    return payload.kind === 'fill' && payload.index === 0 ? (payload.color ?? null) : null
  })
}

async function openFillPicker() {
  const solidTab = page.getByTestId('fill-picker-tab-solid')
  if (await solidTab.isVisible().catch(() => false)) return
  const swatch = page.getByTestId('fill-picker-swatch').first()
  await swatch.click()
  await expect(solidTab).toBeVisible()
}

async function chooseFormat(label: 'RGB' | 'HSL' | 'HSB' | 'OkHCL') {
  await page.getByTestId('color-format-select').click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function selectedNodeId() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0] ?? null
  })
}

async function nodePaint(nodeId: string, key: 'fills' | 'strokes') {
  return page.evaluate(
    ({ id, prop }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const node = store.graph.getNode(id)
      return node?.[prop][0] ?? null
    },
    { id: nodeId, prop: key }
  )
}

function rgbaOf(paint: Awaited<ReturnType<typeof nodePaint>>) {
  if (!paint) return null
  const { r, g, b, a } = paint.color
  return [r, g, b, a]
}

/**
 * reka-ui's `ColorAreaArea` renders a bare `<div>` with no data attribute, so
 * this targets the crosshair area `ColorAreaControl.vue` gives it rather than
 * adding a test-only hook to the picker.
 */
async function dragColorArea(toRatioX: number, toRatioY: number) {
  const area = page.locator('[data-picker-content] .cursor-crosshair')
  const box = await area.boundingBox()
  if (!box) throw new Error('Missing color area')
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.9)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * toRatioX, box.y + box.height * toRatioY, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()
}

async function closePicker() {
  const content = page.locator('[data-picker-content]')
  if (!(await content.isVisible().catch(() => false))) return
  await canvas.pressKey('Escape')
  await expect(content).toBeHidden()
}

/**
 * One click on empty canvas both dismisses the picker and clears the selection.
 * Stay well left of the properties panel — the picker opens to the *left* of its
 * swatch, so a mid-canvas point lands inside the popover and dismisses nothing.
 */
async function clickEmptyCanvas() {
  await canvas.click(120, 420)
  await canvas.waitForRender()
}

async function dragSlider(testId: string, ratio: number) {
  const slider = page.getByTestId(testId).locator(':scope > [data-orientation="horizontal"]')
  const box = await slider.boundingBox()
  if (!box) throw new Error(`Missing slider: ${testId}`)
  await slider.click({
    position: {
      x: Math.max(2, Math.min(box.width - 2, box.width * ratio)),
      y: box.height / 2
    }
  })
  await canvas.waitForRender()
}

test('rgb hue slider updates selected fill color', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()

  await openFillPicker()
  const before = await getSelectedFill()
  await dragSlider('color-slider-hue', 0.65)
  const after = await getSelectedFill()

  expect(after).not.toBeNull()
  expect(
    before?.color.r !== after?.color.r ||
      before?.color.g !== after?.color.g ||
      before?.color.b !== after?.color.b
  ).toBe(true)
})

test('rgb alpha slider updates fill opacity and alpha', async () => {
  await openFillPicker()
  await dragSlider('color-slider-alpha', 0.3)
  const after = await getSelectedFill()

  expect(after).not.toBeNull()
  expect(after?.opacity).toBeLessThan(1)
  expect(after?.color.a).toBeCloseTo(after?.opacity ?? 0, 3)
})

test('hsl saturation slider changes saturation', async () => {
  await openFillPicker()
  await chooseFormat('HSL')
  const before = await getSelectedFill()
  await dragSlider('color-slider-hsl-s', 0.2)
  const after = await getSelectedFill()

  expect(after).not.toBeNull()
  expect(
    before?.color.r !== after?.color.r ||
      before?.color.g !== after?.color.g ||
      before?.color.b !== after?.color.b
  ).toBe(true)
})

test('hsl lightness slider changes color independently', async () => {
  await openFillPicker()
  await chooseFormat('HSL')
  const before = await getSelectedFill()
  await dragSlider('color-slider-hsl-l', 0.8)
  const after = await getSelectedFill()

  expect(after).not.toBeNull()
  expect(
    before?.color.r !== after?.color.r ||
      before?.color.g !== after?.color.g ||
      before?.color.b !== after?.color.b
  ).toBe(true)
})

test('hsb saturation and brightness sliders both affect fill color', async () => {
  await openFillPicker()
  await chooseFormat('HSB')

  const beforeS = await getSelectedFill()
  await dragSlider('color-slider-hsb-s', 0.75)
  const afterS = await getSelectedFill()
  expect(afterS).not.toBeNull()
  expect(
    beforeS?.color.r !== afterS?.color.r ||
      beforeS?.color.g !== afterS?.color.g ||
      beforeS?.color.b !== afterS?.color.b
  ).toBe(true)

  const beforeB = await getSelectedFill()
  await dragSlider('color-slider-hsb-b', 0.9)
  const afterB = await getSelectedFill()
  expect(afterB).not.toBeNull()
  expect(
    beforeB?.color.r !== afterB?.color.r ||
      beforeB?.color.g !== afterB?.color.g ||
      beforeB?.color.b !== afterB?.color.b
  ).toBe(true)
})

test('gradient stops support keyboard nudging and removal', async () => {
  await openFillPicker()
  await page.getByTestId('fill-picker-tab-gradient').click()
  await page.getByTestId('fill-picker-add-stop').click()

  const stops = page.getByTestId('fill-picker-gradient-bar').getByRole('slider')
  await expect(stops).toHaveCount(3)
  const first = stops.first()
  await first.focus()
  const before = Number(await first.getAttribute('aria-valuenow'))
  await first.press('ArrowRight')
  await expect(first).toHaveAttribute('aria-valuenow', String(Math.min(100, before + 1)))
  await first.press('Delete')
  await expect(stops).toHaveCount(2)
})

test('okhcl channels preserve intent metadata while updating the fill', async () => {
  await openFillPicker()
  await page.getByTestId('fill-picker-tab-solid').click()
  await chooseFormat('OkHCL')

  await dragSlider('color-slider-okhcl-c', 0.6)
  const afterChroma = await getSelectedFill()
  const chromaIntent = await getSelectedFillOkHCL()
  expect(afterChroma).not.toBeNull()
  expect(chromaIntent?.c).toBeGreaterThan(0)

  await dragSlider('color-slider-okhcl-l', 0.75)
  const lightnessIntent = await getSelectedFillOkHCL()
  expect(lightnessIntent?.l).toBeCloseTo(0.75, 1)
  expect(lightnessIntent?.c).toBeCloseTo(chromaIntent?.c ?? 0, 3)
})

// T-038: clicking empty canvas clears the selection before the picker reports
// that it closed, unmounting the fill row mid-edit. That unmount used to roll
// the whole picker session back and silently discard the colour.
test('fill survives dismissing the picker by clicking empty canvas', async () => {
  await closePicker()
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()
  const nodeId = await selectedNodeId()
  expect(nodeId).not.toBeNull()
  if (!nodeId) return

  await openFillPicker()
  await chooseFormat('RGB')
  const before = rgbaOf(await nodePaint(nodeId, 'fills'))
  await dragColorArea(0.85, 0.15)
  const dragged = rgbaOf(await nodePaint(nodeId, 'fills'))
  expect(dragged).not.toEqual(before)

  await clickEmptyCanvas()
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeHidden()
  expect(await selectedNodeId()).toBeNull()
  expect(rgbaOf(await nodePaint(nodeId, 'fills'))).toEqual(dragged)

  // The whole picker session stays one undo step. `edit.undo` binds `$mod+KeyZ`,
  // which tinykeys resolves to Control off Apple platforms — `CanvasHelper.undo()`
  // only ever sends Meta+z, so press the platform's own modifier here.
  await canvas.pressKey(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await canvas.waitForRender()
  expect(rgbaOf(await nodePaint(nodeId, 'fills'))).toEqual(before)
  canvas.assertNoErrors()
})

test('escape during a picker drag still cancels the edit', async () => {
  await closePicker()
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()
  const nodeId = await selectedNodeId()
  expect(nodeId).not.toBeNull()
  if (!nodeId) return

  await openFillPicker()
  const before = rgbaOf(await nodePaint(nodeId, 'fills'))
  await dragColorArea(0.85, 0.15)
  expect(rgbaOf(await nodePaint(nodeId, 'fills'))).not.toEqual(before)

  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeHidden()
  expect(rgbaOf(await nodePaint(nodeId, 'fills'))).toEqual(before)
  canvas.assertNoErrors()
})

test('stroke survives dismissing the picker by clicking empty canvas', async () => {
  await closePicker()
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 160, 120)
  await canvas.waitForRender()
  const nodeId = await selectedNodeId()
  expect(nodeId).not.toBeNull()
  if (!nodeId) return

  const strokes = propertySection(page, 'Stroke')
  await strokes.getByRole('button', { name: 'Add stroke', exact: true }).click()
  const strokeRow = propertyItem(page, 'strokes', 0)
  await expect(strokeRow).toBeVisible()
  await strokeRow.getByRole('button', { name: 'Stroke', exact: true }).click()
  await expect(page.locator('[data-picker-content]')).toBeVisible()

  const before = rgbaOf(await nodePaint(nodeId, 'strokes'))
  await dragColorArea(0.85, 0.15)
  const dragged = rgbaOf(await nodePaint(nodeId, 'strokes'))
  expect(dragged).not.toEqual(before)

  await clickEmptyCanvas()
  await expect(page.locator('[data-picker-content]')).toBeHidden()
  expect(await selectedNodeId()).toBeNull()
  expect(rgbaOf(await nodePaint(nodeId, 'strokes'))).toEqual(dragged)
  canvas.assertNoErrors()
})
