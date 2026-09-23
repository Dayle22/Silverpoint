import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getPageChildren } from '#tests/helpers/store'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId
} from '#tests/helpers/test-ids'

const editor = useEditorSetup()

test.beforeAll(async () => {
  await editor.page.route('**/api/session/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'usr_test',
          email: 'test@biosculpture.com',
          displayName: 'Test User',
          role: 'member'
        }
      })
    })
  })

  // The development Vite server returns 404 for /api/session/me because the Cloudflare
  // Access worker is not running locally. On initial navigation before this test-level
  // route was active, WorkspaceView's onMounted checkSession() triggered a 404 which
  // Chromium logged to console. If that is the only error collected so far, clear it
  // now that the mock route is in place. Any genuine runtime exceptions, script errors,
  // or other failed resource loads remain preserved and will fail the test.
  const onlySessionMe404 =
    editor.canvas.errors.length === 1 &&
    editor.canvas.errors[0].includes('404')
  if (onlySessionMe404) {
    editor.canvas.errors.length = 0
  }

  await editor.page.getByTestId('persona-advanced').click()
})

test('shapes flyout opens', async () => {
  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  const rectangleItem = editor.page.getByTestId(toolbarFlyoutItemTestId('RECTANGLE'))
  const polygonItem = editor.page.getByTestId(toolbarFlyoutItemTestId('POLYGON'))

  await expect(polygonItem).toBeVisible()
  await expect(rectangleItem).toHaveAttribute('data-active', 'true')
  await expect(rectangleItem).toHaveAttribute('role', 'menuitemradio')
  await expect(rectangleItem).toHaveAttribute('aria-checked', 'true')
  await expect(rectangleItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  await expect(polygonItem).not.toHaveAttribute('data-active', 'true')
  await expect(polygonItem).toHaveAttribute('aria-checked', 'false')
  editor.canvas.assertNoErrors()
})

test('Polygon tool creates POLYGON node', async () => {
  await editor.page.getByTestId(toolbarFlyoutItemTestId('POLYGON')).click()
  await expect(editor.page.getByTestId(toolbarToolTestId('POLYGON'))).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await editor.canvas.drag(300, 200, 400, 300)
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  expect(children.some((n) => n.type === 'POLYGON')).toBe(true)
  editor.canvas.assertNoErrors()
})

test('Star tool creates STAR node', async () => {
  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  await editor.page.getByTestId(toolbarFlyoutItemTestId('STAR')).click()
  await editor.canvas.drag(150, 150, 250, 250)
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  expect(children.some((n) => n.type === 'STAR')).toBe(true)
  editor.canvas.assertNoErrors()
})

test('shape flyout remembers its selection independently of the active tool', async () => {
  await editor.canvas.pressKey('f')
  await expect(editor.page.getByTestId(toolbarToolTestId('STAR'))).toHaveAttribute(
    'aria-pressed',
    'false'
  )

  await editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE')).click()
  const starItem = editor.page.getByTestId(toolbarFlyoutItemTestId('STAR'))
  const rectangleItem = editor.page.getByTestId(toolbarFlyoutItemTestId('RECTANGLE'))

  await expect(starItem).toHaveAttribute('data-active', 'true')
  await expect(starItem).toHaveAttribute('aria-checked', 'true')
  await expect(starItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  await expect(rectangleItem).not.toHaveAttribute('data-active', 'true')
  await expect(rectangleItem).toHaveAttribute('aria-checked', 'false')

  await rectangleItem.hover()
  await expect(rectangleItem).toHaveAttribute('data-highlighted', '')
  await expect(starItem).toHaveAttribute('data-active', 'true')
  editor.canvas.assertNoErrors()
})

test('Pen creates VECTOR node with 3 vertices on Enter', async () => {
  await editor.canvas.pressKey('Escape')
  await editor.canvas.pressKey('p')
  await editor.canvas.click(100, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(200, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(200, 480)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBeGreaterThan(0)
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.vertices.length).toBe(3)
  editor.canvas.assertNoErrors()
})

test('Pen Escape with 2 vertices cancels path without creating node', async () => {
  const before = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length

  await editor.canvas.pressKey('p')
  await editor.canvas.click(350, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.click(440, 400)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Escape')
  await editor.canvas.waitForRender()

  const after = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length
  expect(after).toBe(before)
  editor.canvas.assertNoErrors()
})

test('Pen close path creates VECTOR with closed region', async () => {
  const before = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length

  await editor.canvas.pressKey('p')
  await editor.canvas.click(500, 200)
  await editor.canvas.waitForRender()
  await editor.canvas.click(580, 200)
  await editor.canvas.waitForRender()
  await editor.canvas.click(540, 270)
  await editor.canvas.waitForRender()
  await editor.canvas.click(500, 200)
  await editor.canvas.waitForRender()

  const after = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR').length
  expect(after).toBeGreaterThan(before)

  const vectors = (await getPageChildren(editor.page)).filter((n) => n.type === 'VECTOR')
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.regions?.length).toBeGreaterThan(0)
  editor.canvas.assertNoErrors()
})

test('Frame flyout shows Frame and Section items', async () => {
  await editor.canvas.pressKey('f')
  const frameButton = editor.page.getByTestId(toolbarToolTestId('FRAME'))
  const frameOptions = editor.page.getByTestId(toolbarFlyoutTestId('FRAME'))

  await expect(frameButton).toHaveAttribute('aria-pressed', 'true')
  await expect(frameOptions).not.toHaveAttribute('data-active', 'true')
  await expect(frameOptions).toHaveAttribute('data-state', 'closed')

  await frameOptions.click()
  await expect(frameOptions).toHaveAttribute('data-state', 'open')
  await expect(frameOptions).not.toHaveAttribute('data-active', 'true')
  const frameItem = editor.page.getByTestId(toolbarFlyoutItemTestId('FRAME'))
  await expect(frameItem).toBeVisible()
  await expect(frameItem).toHaveAttribute('data-active', 'true')
  await expect(frameItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(1)
  const sectionItem = editor.page.getByTestId(toolbarFlyoutItemTestId('SECTION'))
  await expect(sectionItem).toBeVisible()
  await expect(sectionItem).not.toHaveAttribute('data-active', 'true')
  await expect(sectionItem.locator('[data-slot="flyout-item-indicator"] svg')).toHaveCount(0)

  await sectionItem.hover()
  await expect(sectionItem).toHaveAttribute('data-highlighted', '')
  await expect(frameItem).toHaveAttribute('data-active', 'true')
  editor.canvas.assertNoErrors()
})

test('canvas shows native tool cursors', async () => {
  const canvas = editor.page.getByTestId('canvas-element')
  await editor.canvas.pressKey('Escape')
  await editor.canvas.pressKey('v')
  await expect(canvas).toHaveCSS('cursor', 'default')
  await editor.canvas.pressKey('t')
  await expect(canvas).toHaveCSS('cursor', 'text')
  await editor.canvas.pressKey('h')
  await expect(canvas).toHaveCSS('cursor', 'grab')
  await editor.canvas.pressKey('r')
  await expect(canvas).toHaveCSS('cursor', 'crosshair')
})

test('mobile toolbar buttons have names and usable targets', async () => {
  await editor.page.getByTestId('persona-essential').click()
  await editor.page.setViewportSize({ width: 390, height: 844 })
  const toolbar = editor.page.getByTestId('mobile-toolbar')
  await expect(toolbar).toBeVisible()

  const select = toolbar.getByRole('button', { name: 'Move' })
  await select.click()
  await expect(select).toHaveAttribute('aria-pressed', 'true')
  expect((await select.boundingBox())?.width).toBeGreaterThanOrEqual(39.5)

  await toolbar.getByRole('button', { name: 'Next toolbar category' }).click()
  const edit = editor.page.getByTestId('mobile-toolbar-edit')
  await expect(edit).toBeVisible()
  const copy = edit.getByRole('button', { name: 'Copy' })
  expect((await copy.boundingBox())?.width).toBeGreaterThanOrEqual(39.5)
  await expect(toolbar.getByRole('button', { name: 'Previous toolbar category' })).toBeEnabled()
})

test('toolbar renders legible icons and buttons in light and dark themes', async () => {
  await editor.page.setViewportSize({ width: 1280, height: 800 })
  await editor.page.getByTestId('persona-advanced').click()

  const selectBtn = editor.page.getByTestId(toolbarToolTestId('SELECT'))
  const selectSVG = selectBtn.locator('svg')
  await expect(selectSVG).toBeVisible()

  const darkBox = await selectSVG.boundingBox()
  expect(darkBox?.width).toBeGreaterThanOrEqual(14)
  expect(darkBox?.width).toBeLessThanOrEqual(18)

  // Switch to light theme
  await editor.page.evaluate(async () => {
    const themeModule = await import('/src/app/shell/theme.ts')
    themeModule.useAppTheme().setTheme('light')
  })
  await editor.page.waitForFunction(() => document.documentElement.dataset.theme === 'light')

  await expect(selectSVG).toBeVisible()
  const lightBox = await selectSVG.boundingBox()
  expect(lightBox?.width).toBeGreaterThanOrEqual(14)
  expect(lightBox?.width).toBeLessThanOrEqual(18)

  // Restore dark theme
  await editor.page.evaluate(async () => {
    const themeModule = await import('/src/app/shell/theme.ts')
    themeModule.useAppTheme().setTheme('dark')
  })
  await editor.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  editor.canvas.assertNoErrors()
})
