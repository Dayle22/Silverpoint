// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
/* oxlint-disable open-pencil/no-direct-storage-access */
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId
} from '#tests/helpers/test-ids'

const editor = useEditorSetup()

async function closeMenu() {
  const rootMenu = editor.page.locator('[role="menu"]').first()
  for (let i = 0; i < 5; i++) {
    if (!(await rootMenu.isVisible())) break
    await editor.page.keyboard.press('Escape')
    await editor.page.waitForTimeout(50)
  }
}

async function openAppMenu() {
  const rootMenu = editor.page.locator('[role="menu"]').first()
  if (!(await rootMenu.isVisible())) {
    const trigger = editor.page.getByTestId('app-icon-menu-trigger')
    await trigger.click()
    await expect(rootMenu).toBeVisible()
  }
  return rootMenu
}

async function openGroup(groupName: string) {
  await openAppMenu()
  const group = editor.page.getByTestId(`app-menu-group-${groupName.toLowerCase()}`)
  await expect(group).toBeVisible()
  await group.hover()
  await editor.page.waitForTimeout(300)
  return editor.page.locator('[role="menu"]').last()
}

test.beforeEach(async () => {
  await closeMenu()
  // Ensure default Full capability
  await editor.page.evaluate(() => {
    localStorage.removeItem('silverpoint:capability')
  })
})

test('switcher is visible above tool strip with icons and labels', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  await expect(switcher).toBeVisible()

  const simpleIcon = editor.page.getByTestId('capability-simple')
  const fullIcon = editor.page.getByTestId('capability-full')
  await expect(simpleIcon).toBeVisible()
  await expect(fullIcon).toBeVisible()

  await expect(switcher.getByText('Simple')).toBeVisible()
  await expect(switcher.getByText('Full')).toBeVisible()
})

test('default starts in Full mode with 8 top-level tool entries', async () => {
  const toolbar = editor.page.getByTestId('toolbar')
  await expect(toolbar).toBeVisible()

  await expect(editor.page.getByTestId(toolbarToolTestId('SELECT'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('FRAME'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('PEN'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarToolTestId('TEXT'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarToolTestId('HAND'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarToolTestId('SHAPE_BUILDER'))).toBeVisible()
})

test('switching to Simple reduces toolbar to 6 entries with collecting PEN flyout', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  await switcher.getByRole('button', { name: 'Simple' }).click()

  // 6 entries: SELECT, FRAME, RECTANGLE, TEXT, HAND, PEN (collecting flyout)
  await expect(editor.page.getByTestId(toolbarToolTestId('SELECT'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('FRAME'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('RECTANGLE'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarToolTestId('TEXT'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarToolTestId('HAND'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('PEN'))).toBeVisible()

  // BARCODE and SHAPE_BUILDER top-level buttons should not be present
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toHaveCount(0)
  await expect(editor.page.getByTestId(toolbarToolTestId('SHAPE_BUILDER'))).toHaveCount(0)

  // Open the collecting PEN flyout
  await editor.page.getByTestId(toolbarFlyoutTestId('PEN')).click()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('PEN'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('PENCIL'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('BRUSH'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('SHAPE_BUILDER'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('BARCODE'))).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('BARCODE_EAN13'))).toBeVisible()

  // Selecting a hidden tool works
  await editor.page.getByTestId(toolbarFlyoutItemTestId('SHAPE_BUILDER')).click()
  const activeTool = await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)
  expect(activeTool).toBe('SHAPE_BUILDER')

  // Switch back to Full
  await switcher.getByRole('button', { name: 'Full' }).click()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toBeVisible()
})

test('shortcuts still select hidden tools while in Simple mode (Fixed Decision 7)', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  await switcher.getByRole('button', { name: 'Simple' }).click()

  // Press P -> PEN
  await editor.canvas.pressKey('p')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe('PEN')

  // Press N -> PENCIL
  await editor.canvas.pressKey('n')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe('PENCIL')

  // Press B -> BRUSH
  await editor.canvas.pressKey('b')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe('BRUSH')

  // Press M -> SHAPE_BUILDER
  await editor.canvas.pressKey('m')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe('SHAPE_BUILDER')

  // Press Shift+M -> SHAPE_BUILDER
  await editor.canvas.pressKey('v') // reset to SELECT first
  await editor.canvas.pressKey('Shift+M')
  expect(await editor.page.evaluate(() => window.openPencil?.getStore?.()?.state.activeTool)).toBe('SHAPE_BUILDER')

  await switcher.getByRole('button', { name: 'Full' }).click()
})

test('Frame preset popover opens in Simple mode (Fixed Decision 5)', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  await switcher.getByRole('button', { name: 'Simple' }).click()

  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  const popover = editor.page.getByTestId('frame-preset-popover')
  await expect(popover).toBeVisible()
  await editor.page.keyboard.press('Escape')

  await switcher.getByRole('button', { name: 'Full' }).click()
})

test('roving focus moves between segments on capability switcher', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  const simpleBtn = switcher.getByRole('button', { name: 'Simple' })
  const fullBtn = switcher.getByRole('button', { name: 'Full' })

  // Focus Full button initially (since Full is active default)
  await fullBtn.focus()
  expect(await editor.page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Full')

  // ArrowLeft moves roving focus to Simple button
  await editor.page.keyboard.press('ArrowLeft')
  expect(await editor.page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Simple')

  // ArrowRight moves roving focus back to Full button
  await editor.page.keyboard.press('ArrowRight')
  expect(await editor.page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Full')

  // Clicking Simple switches toolbar to Simple
  await simpleBtn.click()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toHaveCount(0)

  // Clicking Full switches toolbar back to Full
  await fullBtn.click()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toBeVisible()
})

test('capability persists across page reload', async () => {
  const switcher = editor.page.getByTestId('capability-switcher')
  await switcher.getByRole('button', { name: 'Simple' }).click()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toHaveCount(0)

  await editor.page.reload()
  const switcherAfterReload = editor.page.getByTestId('capability-switcher')
  await expect(switcherAfterReload).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toHaveCount(0)

  // Reset to full
  await switcherAfterReload.getByRole('button', { name: 'Full' }).click()
})

test('corrupt capability in localStorage normalises to Full on reload', async () => {
  await editor.page.evaluate(() => {
    localStorage.setItem('silverpoint:capability', '{ corrupt json')
  })
  await editor.page.reload()
  await expect(editor.page.getByTestId('capability-switcher')).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toBeVisible()

  await editor.page.evaluate(() => {
    localStorage.setItem('silverpoint:capability', JSON.stringify({ version: 99, capability: 'simple' }))
  })
  await editor.page.reload()
  await expect(editor.page.getByTestId('capability-switcher')).toBeVisible()
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toBeVisible()
})

test('View menu reflects capability and updates toolbar', async () => {
  const viewMenu = await openGroup('View')
  await expect(viewMenu).toBeVisible()

  const simpleItem = viewMenu.locator('[role="menuitemcheckbox"]', { hasText: /^Simple$/i })
  const fullItem = viewMenu.locator('[role="menuitemcheckbox"]', { hasText: /^Full$/i })
  await expect(simpleItem).toBeVisible()
  await expect(fullItem).toBeVisible()

  // Full should be checked initially
  expect(await fullItem.getAttribute('aria-checked')).toBe('true')
  expect(await simpleItem.getAttribute('aria-checked')).toBe('false')

  // Click Simple in menu
  await simpleItem.click()
  await closeMenu()

  // Toolbar is in Simple
  await expect(editor.page.getByTestId(toolbarFlyoutTestId('BARCODE'))).toHaveCount(0)

  // Re-open menu to verify tick moved
  const viewMenu2 = await openGroup('View')
  const simpleItem2 = viewMenu2.locator('[role="menuitemcheckbox"]', { hasText: /^Simple$/i })
  expect(await simpleItem2.getAttribute('aria-checked')).toBe('true')
  await closeMenu()

  // Switch back to Full from switcher
  await editor.page.getByTestId('capability-switcher').getByRole('button', { name: 'Full' }).click()
})

test.describe('capability switcher absence outside desktop chrome', () => {
  test.describe('?no-chrome', () => {
    const chromelessEditor = useEditorSetup('/?no-chrome')

    test('capability switcher is absent in no-chrome', async () => {
      await expect(chromelessEditor.page.getByTestId('capability-switcher')).toHaveCount(0)
    })
  })

  test.describe('showUI=false', () => {
    const collapsedEditor = useEditorSetup()

    test('capability switcher is absent when UI is collapsed', async () => {
      await expect(collapsedEditor.page.getByTestId('capability-switcher')).toBeVisible()
      await collapsedEditor.page.getByTestId('app-toggle-ui').click()
      await expect(collapsedEditor.page.getByTestId('capability-switcher')).toHaveCount(0)
      await collapsedEditor.page.getByTestId('editor-show-ui').click()
      await expect(collapsedEditor.page.getByTestId('capability-switcher')).toBeVisible()
    })
  })
})
