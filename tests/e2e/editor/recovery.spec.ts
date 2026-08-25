import { test, expect, useEditorSetup } from '#tests/e2e/fixtures'

const setup = useEditorSetup()

test.describe('Per-document autosave, recovery, and dashboard (T-026)', () => {
  test('should render home button and navigate to dashboard view', async () => {
    const homeBtn = setup.page.getByTestId('tabbar-home')
    await expect(homeBtn).toBeVisible()

    await homeBtn.click()

    const dashboardRoot = setup.page.getByTestId('dashboard-root')
    await expect(dashboardRoot).toBeVisible()
    await expect(setup.page.getByTestId('editor-panels')).toHaveCount(0)

    const viewportSize = setup.page.viewportSize()
    if (viewportSize) {
      const box = await dashboardRoot.boundingBox()
      expect(box).not.toBeNull()
      expect(box?.height).toBeGreaterThanOrEqual(viewportSize.height - 40)
    }
  })

  test('should allow creating a new design file from dashboard', async () => {
    const homeBtn = setup.page.getByTestId('tabbar-home')
    await homeBtn.click()

    const newFileBtn = setup.page.getByTestId('dashboard-new-file')
    await expect(newFileBtn).toBeVisible()

    await newFileBtn.click()

    const tabs = setup.page.getByTestId('tabbar-tab')
    await expect(tabs).toHaveCount(2)
  })

  test('should switch to dashboard view when all tabs are closed', async () => {
    const tabs = setup.page.getByTestId('tabbar-tab')
    let count = await tabs.count()

    while (count > 0) {
      const closeBtn = setup.page.getByTestId('tabbar-close').nth(0)
      await closeBtn.click()
      count = await tabs.count()
    }

    const dashboardRoot = setup.page.getByTestId('dashboard-root')
    await expect(dashboardRoot).toBeVisible()
    await expect(setup.page.getByTestId('editor-panels')).toHaveCount(0)
  })
})
