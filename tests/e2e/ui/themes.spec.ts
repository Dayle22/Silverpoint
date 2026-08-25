import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const themes = ['light', 'grey', 'dark', 'midnight'] as const

async function chooseTheme(page: Page, theme: string) {
  const trigger = page.getByTestId('app-icon-menu-trigger')
  await trigger.click()
  const viewGroup = page.getByTestId('app-menu-group-view')
  await expect(viewGroup).toBeVisible()
  await viewGroup.hover()
  await page.waitForTimeout(150)
  const themeItem = page.locator('[role="menuitem"]', { hasText: /^Theme$/i })
  await expect(themeItem).toBeVisible()
  await themeItem.hover()
  await page.waitForTimeout(150)
  await page
    .getByRole('menuitemcheckbox', { name: theme[0].toUpperCase() + theme.slice(1) })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await page.waitForTimeout(250)
}

test('explicit themes persist, update rulers, shell chrome, canvas and grid', async ({
  browser
}) => {
  test.setTimeout(60000)
  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { width: 1280, height: 800 }
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/?test')
  await page.waitForSelector('[data-test-id="editor-root"]')
  const before = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return JSON.stringify({
      graph: Array.from(store.graph.nodes.values()).map((node) => ({
        id: node.id,
        type: node.type,
        parentId: node.parentId,
        fills: node.fills
      })),
      undo: store.undo.canUndo
    })
  })

  for (const theme of themes) {
    await chooseTheme(page, theme)
    const state = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const root = document.documentElement
      const style = getComputedStyle(root)
      const panelToken = style.getPropertyValue('--color-panel').trim()
      const canvasToken = style.getPropertyValue('--color-canvas').trim()

      const tabbar = document
        .querySelector('[data-test-id="tabbar-home"]')
        ?.closest('.scrollbar-none')
      const toolbar = document.querySelector('[data-test-id="toolbar"]')
      const dockPanel = document.querySelector('[data-test-id^="workspace-panel-"]')
      const floatTitle = document.querySelector('[data-test-id^="float-title-"]')

      const dummy = document.createElement('div')
      dummy.style.backgroundColor = panelToken
      document.body.appendChild(dummy)
      const expectedPanelRgb = getComputedStyle(dummy).backgroundColor
      dummy.style.backgroundColor = canvasToken
      const expectedCanvasRgb = getComputedStyle(dummy).backgroundColor
      dummy.remove()

      return {
        setting: root.dataset.themeSetting,
        colorScheme: root.style.colorScheme,
        panelToken,
        canvasToken,
        expectedPanelRgb,
        expectedCanvasRgb,
        tabbarBg: tabbar ? getComputedStyle(tabbar).backgroundColor : '',
        toolbarBg: toolbar ? getComputedStyle(toolbar).backgroundColor : '',
        dockBg: dockPanel ? getComputedStyle(dockPanel).backgroundColor : '',
        floatTitleBg: floatTitle ? getComputedStyle(floatTitle).backgroundColor : null,
        pageColor: store.state.pageColor,
        gridSettings: store.state.canvasGrid,
        ruler: store.state.rulerTheme,
        graph: JSON.stringify(
          Array.from(store.graph.nodes.values()).map((node) => ({
            id: node.id,
            type: node.type,
            parentId: node.parentId,
            fills: node.fills
          }))
        ),
        undo: store.undo.canUndo
      }
    })

    expect(state.setting).toBe(theme)
    expect(state.colorScheme).toBe(theme === 'light' ? 'light' : 'dark')
    expect(state.panelToken).not.toBe('')
    expect(state.canvasToken).not.toBe('')
    expect(state.tabbarBg).toBe(state.expectedPanelRgb)
    expect(state.toolbarBg).toBe(state.expectedPanelRgb)
    if (state.dockBg) {
      expect(state.dockBg).toBe(state.expectedPanelRgb)
    }
    if (state.floatTitleBg) {
      expect(state.floatTitleBg).toBe(state.expectedPanelRgb)
    }
    expect(state.ruler).toBeTruthy()
    expect(state.ruler?.tick).toBeTruthy()
    expect(state.gridSettings?.color ?? '#808080').toBe('#808080')
    expect(state.graph).toBe(JSON.stringify(JSON.parse(before).graph))
    expect(state.undo).toBe(JSON.parse(before).undo)
  }

  // Verify custom canvas colour override survives theme changes
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.setPageColor({ r: 0.8, g: 0.1, b: 0.2, a: 1 })
  })

  await chooseTheme(page, 'light')
  const customLightColor = await page.evaluate(
    () => window.openPencil?.getStore?.()?.state.pageColor
  )
  expect(customLightColor).toEqual({ r: 0.8, g: 0.1, b: 0.2, a: 1 })

  await chooseTheme(page, 'midnight')
  const customMidnightColor = await page.evaluate(
    () => window.openPencil?.getStore?.()?.state.pageColor
  )
  expect(customMidnightColor).toEqual({ r: 0.8, g: 0.1, b: 0.2, a: 1 })

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight')
  const trigger = page.getByTestId('app-icon-menu-trigger')
  await trigger.click()
  const fileGroup = page.getByTestId('app-menu-group-file')
  await expect(fileGroup).toBeVisible()
  await fileGroup.hover()
  await page.waitForTimeout(150)
  await page.getByRole('menuitem', { name: 'New' }).click()
  await page.waitForTimeout(150)
  const newTabRuler = await page.evaluate(() => window.openPencil?.getStore?.()?.state.rulerTheme)
  expect(newTabRuler).toBeTruthy()

  expect(errors).toEqual([])
  await context.close()
})
