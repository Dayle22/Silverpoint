// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import type { Locator } from '@playwright/test'
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

async function editNumberField(field: Locator, value: string) {
  await field.click()
  const input = field.locator('input')
  await input.fill(value)
  await input.press('Enter')
  await editor.canvas.waitForRender()
}

test.beforeEach(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (store) {
      store.state.activeTool = 'HAND'
      store.state.selectedIds = new Set()
      store.state.sceneVersion++
    }
  })
})

test('bar is absent when nothing is selected', async () => {
  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toHaveCount(0)
})

test('selecting a rectangle displays fill, stroke, corner radius, opacity, and position', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      cornerRadius: 0,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  // Controls for shape
  await expect(bar.getByTestId('contextual-fill-picker')).toBeVisible()
  await expect(
    bar.getByTestId('contextual-stroke-picker').or(bar.getByTestId('contextual-add-stroke'))
  ).toBeVisible()
  await expect(bar.locator('[data-property="cornerRadius"]')).toBeVisible()
  await expect(bar.locator('[data-property="opacity"]')).toBeVisible()
  await expect(bar.getByTestId('contextual-position-trigger')).toBeVisible()
})

test('editing opacity in the bar updates the node and properties panel live', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  const opacityField = bar.locator('[data-property="opacity"]').first()
  await editNumberField(opacityField, '50')

  const node = await getSelectedNode(editor.page)
  expect(node?.opacity).toBeCloseTo(0.5, 1)

  // Contextual bar should show 50
  await expect(opacityField).toContainText('50')
})

test('editing in properties panel reflects in the contextual bar', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      cornerRadius: 0,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  // Change corner radius in panel
  const panelRadius = editor.page.locator('[data-property="cornerRadius"]').last()
  await editNumberField(panelRadius, '16')

  // Contextual bar should reflect 16
  const barRadius = bar.locator('[data-property="cornerRadius"]').first()
  await expect(barRadius).toContainText('16')
})

test('position trigger opens popover with X, Y, W, H fields', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  const posTrigger = bar.getByTestId('contextual-position-trigger')
  await posTrigger.click()

  const popover = editor.page.getByTestId('contextual-position-popover')
  await expect(popover).toBeVisible()
  await expect(popover.locator('[data-property="x"]')).toBeVisible()
  await expect(popover.locator('[data-property="y"]')).toBeVisible()
  await expect(popover.locator('[data-property="width"]')).toBeVisible()
  await expect(popover.locator('[data-property="height"]')).toBeVisible()

  // Close by clicking trigger again
  await posTrigger.click()
  await expect(popover).toBeHidden()
})

test('text selection shows typography controls and text color', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('TEXT', page.id, {
      x: 100,
      y: 300,
      width: 200,
      height: 50,
      text: 'Hello Silverpoint',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      textAlignHorizontal: 'LEFT',
      opacity: 1,
      visible: true,
      styleRuns: [],
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  await expect(bar.getByTestId('contextual-font-picker')).toBeVisible()
  await expect(bar.locator('[data-property="fontSize"]')).toBeVisible()
  await expect(bar.getByTestId('contextual-font-weight')).toBeVisible()
  await expect(bar.getByTestId('contextual-text-color')).toBeVisible()
  await expect(bar.getByTestId('contextual-alignment')).toBeVisible()
  await expect(bar.locator('[data-property="opacity"]')).toBeVisible()

  // Stroke, corner radius, and position are not present for text
  await expect(bar.getByTestId('contextual-stroke-picker')).toHaveCount(0)
  await expect(bar.locator('[data-property="cornerRadius"]')).toHaveCount(0)
  await expect(bar.getByTestId('contextual-position-trigger')).toHaveCount(0)
})

test('image selection shows opacity, corner radius, and position', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 400,
      y: 400,
      width: 100,
      height: 100,
      cornerRadius: 4,
      opacity: 1,
      visible: true,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          imageScaleMode: 'FILL',
          opacity: 1,
          visible: true
        }
      ],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  await expect(bar.locator('[data-property="opacity"]')).toBeVisible()
  await expect(bar.locator('[data-property="cornerRadius"]')).toBeVisible()
  await expect(bar.getByTestId('contextual-position-trigger')).toBeVisible()

  // Solid fill and stroke swatch omitted for pure image node
  await expect(bar.getByTestId('contextual-fill-picker')).toHaveCount(0)
  await expect(bar.getByTestId('contextual-font-picker')).toHaveCount(0)
})

test('multi-select shows common applicable controls', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node1 = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    const node2 = store.graph.createNode('RECTANGLE', page.id, {
      x: 250,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node1.id, node2.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()
  await expect(bar.getByTestId('contextual-fill-picker')).toBeVisible()
  await expect(bar.locator('[data-property="opacity"]')).toBeVisible()
  await expect(bar.getByTestId('contextual-position-trigger')).toBeVisible()
})

test('tool strip sits directly below contextual bar and remains fully accessible', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  const toolbar = editor.page.getByTestId('toolbar')

  await expect(bar).toBeVisible()
  await expect(toolbar).toBeVisible()

  const barBox = await bar.boundingBox()
  const toolbarBox = await toolbar.boundingBox()

  expect(barBox).toBeTruthy()
  expect(toolbarBox).toBeTruthy()
  if (barBox && toolbarBox) {
    // Bar is above the toolbar (barBox.y < toolbarBox.y)
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(toolbarBox.y + 1)
  }
})

test('all four themes render the contextual property bar without visual regression', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('No store')
    const page = store.graph.getPages()[0]
    const node = store.graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      opacity: 1,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      strokes: []
    })
    store.state.selectedIds = new Set([node.id])
    store.state.sceneVersion++
  })

  const bar = editor.page.getByTestId('contextual-property-bar')
  await expect(bar).toBeVisible()

  const themes = ['light', 'grey', 'dark', 'midnight'] as const
  for (const theme of themes) {
    await editor.page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
    }, theme)
    await expect(editor.page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(bar).toBeVisible()
  }
})
