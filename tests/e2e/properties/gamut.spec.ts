import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

test('print gamut warning lists out-of-gamut colours, updates on edit, and toggles cleanly', async () => {
  // Draw a rectangle on the canvas
  await editor.canvas.drawRect(100, 100, 150, 100)
  await editor.canvas.waitForRender()

  const gamutSection = propertySection(editor.page, 'Print Gamut Warning')
  await expect(gamutSection).toBeVisible()

  // Mandatory advisory note must be visible
  const advisoryNotice = gamutSection.getByTestId('gamut-approximate-notice')
  await expect(advisoryNotice).toBeVisible()
  await expect(advisoryNotice).toContainText(
    'Approximate print gamut — advisory only, not a colour-managed proof.'
  )

  // Enable the gamut check
  const enableCheckbox = gamutSection.getByTestId('gamut-enable-checkbox')
  await enableCheckbox.click()
  await editor.canvas.waitForRender()

  // Set the rectangle fill to pure RGB green (#00FF00), which is out of CMYK gamut
  const fillSection = propertySection(editor.page, 'Fill')
  const fillHexInput = fillSection.getByRole('textbox', { name: 'Fill' })
  await fillHexInput.fill('00FF00')
  await fillHexInput.press('Enter')
  await editor.canvas.waitForRender()

  // Gamut warning shows count and lists the finding
  const countBadge = gamutSection.getByTestId('gamut-count')
  await expect(countBadge).toBeVisible()
  await expect(countBadge).toContainText('1 out of gamut')

  const findingRows = gamutSection.getByTestId('gamut-finding-row')
  await expect(findingRows).toHaveCount(1)

  // Change fill to a safe in-gamut colour (#808080)
  await fillHexInput.fill('808080')
  await fillHexInput.press('Enter')
  await editor.canvas.waitForRender()

  // Finding is removed from the list and no-issues message is shown
  await expect(gamutSection.getByTestId('gamut-no-issues')).toBeVisible()
  await expect(findingRows).toHaveCount(0)

  // Disable the gamut check
  await enableCheckbox.click()
  await editor.canvas.waitForRender()

  // When disabled, findings list is cleared
  await expect(gamutSection.getByTestId('gamut-count')).toHaveCount(0)
  await expect(gamutSection.getByTestId('gamut-no-issues')).toHaveCount(0)
  await expect(findingRows).toHaveCount(0)

  editor.canvas.assertNoErrors()
})
