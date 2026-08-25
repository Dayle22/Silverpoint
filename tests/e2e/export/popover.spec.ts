// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, useEditorSetup, expectInViewport } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.describe('Top-bar Export popover (T-069)', () => {
  test.beforeEach(async () => {
    await editor.canvas.clearCanvas()
  })

  test('Export trigger renders in top chrome and replaces Share', async () => {
    const trigger = editor.page.getByTestId('export-popover-button')
    await expect(trigger).toHaveCount(1)
    await expect(trigger).toHaveText('Export')

    // Old collab share button and popover are absent
    await expect(editor.page.getByTestId('collab-share-button')).toHaveCount(0)
    await expect(editor.page.getByTestId('collab-popover')).toHaveCount(0)
    editor.canvas.assertNoErrors()
  })

  test('clicking Export opens the export popover with empty state', async () => {
    const trigger = editor.page.getByTestId('export-popover-button')
    await trigger.click()

    const popover = editor.page.getByTestId('export-popover')
    await expect(popover).toBeVisible()
    await expectInViewport(editor.page, popover)

    const addBtn = popover.getByRole('button', { name: 'Add export' })
    await expect(addBtn).toBeVisible()
    await expect(popover.getByTestId('export-button')).toHaveCount(0)

    // Escape closes popover and returns focus to trigger
    await editor.page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(trigger).toBeFocused()
    editor.canvas.assertNoErrors()
  })

  test('adding export row in popover exposes format options and syncs to graph state', async () => {
    // Draw a shape to establish a selected node target
    await editor.canvas.drawRect(200, 200, 100, 100)

    const trigger = editor.page.getByTestId('export-popover-button')
    await trigger.click()

    const popover = editor.page.getByTestId('export-popover')
    await expect(popover).toBeVisible()

    const addBtn = popover.getByRole('button', { name: 'Add export' })
    await addBtn.click()
    await editor.canvas.waitForRender()

    // Export action button is now present for selected node
    const exportBtn = popover.getByTestId('export-button')
    await expect(exportBtn).toBeVisible()

    // Format selector
    const formatTrigger = popover.getByRole('combobox', { name: 'Export format' })
    await expect(formatTrigger).toBeVisible()
    await formatTrigger.click()

    for (const label of ['PNG', 'JPG', 'WEBP', 'SVG', 'PDF']) {
      await expect(editor.page.locator('[role="option"]').filter({ hasText: label })).toBeVisible()
    }

    const svgOption = editor.page.locator('[role="option"]').filter({ hasText: 'SVG' })
    await svgOption.click()
    await editor.canvas.waitForRender()

    await expect(formatTrigger).toHaveText('SVG')

    // Verify shared graph state
    const graphSettings = await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const selectedId = [...store.state.selectedIds][0]
      return store.graph.getNode(selectedId)?.exportSettings
    })
    expect(graphSettings).toEqual([{ format: 'svg', scale: 1 }])

    // Escape closes and returns focus
    await editor.page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Reselect the shape on canvas
    await editor.canvas.click(250, 250)
    await editor.canvas.waitForRender()

    // Reopen popover and confirm settings persist
    await trigger.click()
    await expect(popover).toBeVisible()
    await expect(popover.getByRole('combobox', { name: 'Export format' })).toHaveText('SVG')

    // Close via outside click
    await editor.page.mouse.click(10, 10)
    await expect(popover).toHaveCount(0)
    editor.canvas.assertNoErrors()
  })
})
