import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

function getDocumentUnits() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.documentUnits
  })
}

test('document units and DPI can be configured, update properties, and undo cleanly', async () => {
  const pageSection = propertySection(editor.page, 'Page')
  await expect(pageSection).toBeVisible()

  // 1. Initial unit is px
  let units = await getDocumentUnits()
  expect(units?.unit ?? 'px').toBe('px')

  // Create two 100x100 rectangles to activate multi-selection position & dimensions
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const rect1 = store.graph.createNode('RECTANGLE', pageId, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const rect2 = store.graph.createNode('RECTANGLE', pageId, {
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    store.select([rect1.id, rect2.id])
    store.requestRender()
  })
  await editor.canvas.waitForRender()

  // 2. Switch unit dropdown to mm
  const unitSelect = pageSection.locator('[data-property="document-unit"]')
  await unitSelect.click()
  const mmOption = editor.page.getByRole('option', { name: 'mm' })
  await mmOption.click()
  await editor.canvas.waitForRender()

  units = await getDocumentUnits()
  expect(units?.unit).toBe('mm')

  // In Position section, X/Y/W/H reflect unit conversion
  const posSection = propertySection(editor.page, 'Position')
  const widthField = posSection.getByRole('spinbutton', { name: 'Width' })
  // 100 px at 300 DPI mm = 100 / (300 / 25.4) = 8.47 mm
  await expect(widthField).toContainText('8.47')

  // 3. Switch unit to in
  await unitSelect.click()
  const inOption = editor.page.getByRole('option', { name: 'in' })
  await inOption.click()
  await editor.canvas.waitForRender()

  units = await getDocumentUnits()
  expect(units?.unit).toBe('in')
  // 100 px at 300 DPI in = 100 / 300 = 0.33 in
  await expect(widthField).toContainText('0.33')

  // 4. Change DPI to 150
  const dpiInput = pageSection.getByRole('spinbutton', { name: 'DPI' })
  await dpiInput.click()
  await dpiInput.fill('150')
  await dpiInput.press('Enter')
  await editor.canvas.waitForRender()

  units = await getDocumentUnits()
  expect(units?.dpi).toBe(150)
  // 100 px at 150 DPI in = 100 / 150 = 0.67 in
  await expect(widthField).toContainText('0.67')

  // 5. Undo operations
  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
  units = await getDocumentUnits()
  expect(units?.dpi).toBe(300)

  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
  units = await getDocumentUnits()
  expect(units?.unit).toBe('mm')

  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
  units = await getDocumentUnits()
  expect(units?.unit).toBe('px')
})
