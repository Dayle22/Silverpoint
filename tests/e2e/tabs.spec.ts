import { test, expect, useEditorSetup } from '#tests/e2e/fixtures'

const setup = useEditorSetup()

test.describe('Multi-document tabs & projects (T-025)', () => {
  test('should display tabbar and allow creating, switching, and closing tabs', async () => {
    const tabs = setup.page.getByTestId('tabbar-tab')
    await expect(tabs).toHaveCount(1)

    const newTabBtn = setup.page.getByTestId('tabbar-new')
    await newTabBtn.click()
    await expect(tabs).toHaveCount(2)

    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveAttribute('data-state', 'active')

    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('data-state', 'active')

    const closeBtn = setup.page.getByTestId('tabbar-close').nth(1)
    await closeBtn.click()
    await expect(tabs).toHaveCount(1)
  })

  test('should show unsaved dirty indicator upon document modification', async () => {
    const dirtyIndicator = setup.page.getByTestId('tab-dirty-indicator')

    await expect(dirtyIndicator).toHaveCount(0)

    await setup.canvas.drawRect(100, 100, 200, 150)

    await expect(dirtyIndicator).toBeVisible()
  })

  test('should reopen closed tab via Ctrl+Shift+T', async () => {
    const tabs = setup.page.getByTestId('tabbar-tab')
    const newTabBtn = setup.page.getByTestId('tabbar-new')

    await newTabBtn.click()
    await expect(tabs).toHaveCount(2)

    const tab2Text = await tabs.nth(1).textContent()

    const closeBtn = setup.page.getByTestId('tabbar-close').nth(1)
    await closeBtn.click()
    await expect(tabs).toHaveCount(1)

    await setup.page.keyboard.press('Control+Shift+T')

    await expect(tabs).toHaveCount(2)
    expect(await tabs.nth(1).textContent()).toContain(tab2Text?.trim() || '')
  })

  test('should give a new tab a clean canvas bound to its own document', async () => {
    const tabs = setup.page.getByTestId('tabbar-tab')

    await tabs.nth(0).click()
    await setup.canvas.waitForInit()
    await setup.canvas.drawRect(120, 120, 260, 200)
    await setup.canvas.waitForRender()
    const withContent = await setup.canvas.screenshotCanvas()

    await setup.page.getByTestId('tabbar-new').click()
    await setup.canvas.waitForInit()

    await expect
      .poll(async () => (await setup.canvas.screenshotCanvas()).equals(withContent))
      .toBe(false)

    // The regression this guards: the canvas was never remounted for the new
    // tab, so `setCanvasKit` never ran against that tab's store and it owned no
    // renderer at all — its render loop still listened to the previous tab, and
    // export, thumbnails and text measurement had nothing to draw with.
    const hasRenderer = await setup.page.evaluate(
      () => window.openPencil?.getStore?.().renderer != null
    )
    expect(hasRenderer).toBe(true)
  })

  test('should enforce maximum limit of 20 concurrent tabs', async () => {
    const newTabBtn = setup.page.getByTestId('tabbar-new')
    const tabs = setup.page.getByTestId('tabbar-tab')

    // We already have 2 tabs from serial test execution state
    const currentCount = await tabs.count()
    for (let i = currentCount; i < 20; i++) {
      await newTabBtn.click()
    }

    await expect(tabs).toHaveCount(20)

    // Attempting 21st tab should be blocked by limit 20
    await newTabBtn.click()

    await expect(tabs).toHaveCount(20)
  })
})
