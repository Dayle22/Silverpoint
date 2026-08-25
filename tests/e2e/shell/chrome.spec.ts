// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

test.describe('Top chrome consolidation (T-031d)', () => {
  test('document name appears exactly once', async () => {
    await expect(editor.page.getByTestId('app-document-name')).toHaveCount(1)
  })

  test('the UI toggle button lives in the tab-bar row', async () => {
    const chrome = editor.page.getByTestId('desktop-shell-chrome')
    await expect(chrome).toHaveCount(1)
    await expect(chrome.getByTestId('app-toggle-ui')).toHaveCount(1)

    const home = editor.page.getByTestId('tabbar-home')
    const toggle = chrome.getByTestId('app-toggle-ui')
    const homeBox = expectDefined(await home.boundingBox(), 'home button bounds')
    const toggleBox = expectDefined(await toggle.boundingBox(), 'toggle button bounds')
    expect(Math.abs(homeBox.y - toggleBox.y)).toBeLessThan(homeBox.height)
  })

  test('ExportPopover and ZoomDropdown render exactly once', async () => {
    await expect(editor.page.getByTestId('export-popover-button')).toHaveCount(1)
    await expect(editor.page.getByTestId('zoom-dropdown-trigger')).toHaveCount(1)
  })

  test('double-clicking the active tab renames the document; Enter commits', async () => {
    const tab = editor.page.getByTestId('tabbar-tab').first()
    await expect(tab).toHaveAttribute('data-state', 'active')

    await tab.getByTestId('app-document-name').dblclick()

    const input = tab.getByTestId('app-document-name-input')
    await expect(input).toBeFocused()
    await input.fill('Renamed Doc')
    await editor.page.keyboard.press('Enter')

    await expect(tab.getByTestId('app-document-name')).toHaveText('Renamed Doc')

    const storeName = await editor.page.evaluate(
      () => window.openPencil?.getStore?.()?.state.documentName
    )
    expect(storeName).toBe('Renamed Doc')
  })

  test('Escape cancels an in-progress rename', async () => {
    const tab = editor.page.getByTestId('tabbar-tab').first()
    const before = await tab.getByTestId('app-document-name').textContent()

    await tab.getByTestId('app-document-name').dblclick()
    const input = tab.getByTestId('app-document-name-input')
    await expect(input).toBeFocused()
    await input.fill('Should Not Save')
    await editor.page.keyboard.press('Escape')

    await expect(tab.getByTestId('app-document-name-input')).toHaveCount(0)
    await expect(tab.getByTestId('app-document-name')).toHaveText(before ?? '')

    const storeName = await editor.page.evaluate(
      () => window.openPencil?.getStore?.()?.state.documentName
    )
    expect(storeName).toBe(before)
  })

  test('double-clicking an inactive tab switches to it without starting a rename', async () => {
    await editor.page.getByTestId('tabbar-new').click()
    const tabs = editor.page.getByTestId('tabbar-tab')
    await expect(tabs).toHaveCount(2)

    const firstTab = tabs.nth(0)
    await expect(firstTab).toHaveAttribute('data-state', 'inactive')

    await firstTab.getByTestId('app-document-name').dblclick()

    await expect(firstTab).toHaveAttribute('data-state', 'active')
    await expect(firstTab.getByTestId('app-document-name-input')).toHaveCount(0)

    // Clean up the extra tab so later tests see the original single-tab state.
    await editor.page.getByTestId('tabbar-close').nth(1).click()
    await expect(tabs).toHaveCount(1)
  })

  test('renaming never starts a tab drag or closes the tab', async () => {
    const tab = editor.page.getByTestId('tabbar-tab').first()
    await expect(tab).toHaveAttribute('data-state', 'active')
    const countBefore = await editor.page.getByTestId('tabbar-tab').count()

    const label = tab.getByTestId('app-document-name')
    const box = expectDefined(await label.boundingBox(), 'label bounds')

    await label.dblclick()
    const input = tab.getByTestId('app-document-name-input')
    await expect(input).toBeFocused()

    // Drag the pointer the way a reorder drag would, from inside the rename input.
    await editor.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await editor.page.mouse.down()
    await editor.page.mouse.move(box.x + box.width + 150, box.y, { steps: 5 })
    await editor.page.mouse.up()

    await expect(editor.page.getByTestId('tabbar-tab')).toHaveCount(countBefore)
    await expect(tab).toHaveAttribute('data-state', 'active')

    await editor.page.keyboard.press('Escape')
  })
})
