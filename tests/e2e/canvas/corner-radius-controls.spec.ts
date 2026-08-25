import { test, expect, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

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

test('dragging a rotated rectangle radius control updates uniform and independent corners', async () => {
  await canvas.clearCanvas()

  const nodeId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1.5
    store.state.panX = 80
    store.state.panY = 50
    const id = store.createShape('RECTANGLE', 180, 150, 200, 100)
    if (!id) throw new Error('Unable to create rectangle')
    store.updateNode(id, { rotation: 25 })
    store.select([id])
    store.requestRender()
    return id
  })
  await canvas.waitForRender()

  const getControl = async (corner: 'nw' | 'ne' | 'se' | 'sw', localInset: number) =>
    page.evaluate(
      ({ id, corner: selectedCorner, inset }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const node = store.graph.getNode(id)
        if (!node) throw new Error('Rectangle not found')
        const x = selectedCorner.includes('w') ? inset : node.width - inset
        const y = selectedCorner.includes('n') ? inset : node.height - inset
        const radians = (node.rotation * Math.PI) / 180
        const cx = node.width / 2
        const cy = node.height / 2
        const dx = x - cx
        const dy = y - cy
        const worldX = node.x + cx + dx * Math.cos(radians) - dy * Math.sin(radians)
        const worldY = node.y + cy + dx * Math.sin(radians) + dy * Math.cos(radians)
        return {
          x: worldX * store.state.zoom + store.state.panX,
          y: worldY * store.state.zoom + store.state.panY
        }
      },
      { id: nodeId, corner, inset: localInset }
    )

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')
  const inset = 12 / 1.5
  const control = await getControl('nw', inset)
  const startX = box.x + control.x
  const startY = box.y + control.y

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 30, startY + 30, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const uniform = await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(id)
    if (!node) return null
    return {
      cornerRadius: node.cornerRadius,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius,
      independentCorners: node.independentCorners
    }
  }, nodeId)
  expect(uniform).not.toBeNull()
  expect(expectDefined(uniform, 'uniform result').cornerRadius).toBeGreaterThan(8)
  expect(expectDefined(uniform, 'uniform result').topLeftRadius).toBe(
    expectDefined(uniform, 'uniform result').cornerRadius
  )
  expect(expectDefined(uniform, 'uniform result').independentCorners).toBe(false)

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.updateNode(id, {
      independentCorners: true,
      topLeftRadius: 4,
      topRightRadius: 12,
      bottomRightRadius: 16,
      bottomLeftRadius: 20
    })
    store.requestRender()
  }, nodeId)
  await canvas.waitForRender()

  const independentControl = await getControl('se', inset)
  const ix = box.x + independentControl.x
  const iy = box.y + independentControl.y
  await page.mouse.move(ix, iy)
  await page.mouse.down()
  await page.mouse.move(ix - 24, iy - 24, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const independent = await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(id)
    if (!node) return null
    return {
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius,
      independentCorners: node.independentCorners
    }
  }, nodeId)
  expect(independent).toEqual({
    topLeftRadius: 4,
    topRightRadius: 12,
    bottomRightRadius: expect.any(Number),
    bottomLeftRadius: 20,
    independentCorners: true
  })
  expect(expectDefined(independent, 'independent result').bottomRightRadius).toBeGreaterThan(16)
  canvas.assertNoErrors()
})
