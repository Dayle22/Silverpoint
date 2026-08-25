import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertyField } from '#tests/helpers/properties'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
})

test('corner smoothing field defaults to 0 and edits the model', async () => {
  await editor.canvas.drawRect(120, 100, 120, 90)
  const field = propertyField(editor.page, 'cornerSmoothing')
  await expect(field).toBeVisible()
  await expect(field).toHaveAttribute('aria-valuenow', '0')

  await field.click()
  const input = field.getByRole('spinbutton')
  await input.fill('60')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.cornerSmoothing).toBe(0.6)

  await editor.canvas.undo()
  expect((await getSelectedNode(editor.page))?.cornerSmoothing).toBe(0)
  editor.canvas.assertNoErrors()
})

test('corner smoothing field is absent for node types with no corner radius', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawEllipse(120, 100, 120, 90)
  await expect(propertyField(editor.page, 'cornerSmoothing')).not.toBeVisible()
  editor.canvas.assertNoErrors()
})
