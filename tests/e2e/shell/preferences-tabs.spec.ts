// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test } from '@playwright/test'

test.beforeEach(() => {
  test.setTimeout(60_000)
})

async function openPreferences(page) {
  const trigger = page.getByTestId('app-icon-menu-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  const editGroup = page.getByTestId('app-menu-group-edit')
  await expect(editGroup).toBeVisible()
  await editGroup.hover()
  const preferencesItem = page.getByRole('menuitem', { name: 'Preferences' })
  await expect(preferencesItem).toBeVisible()
  await preferencesItem.click()
}

test('preferences dialog supports vertical tab navigation and keeps active tab within session', async ({ page }) => {
  await page.goto('/?test')
  await page.getByTestId('editor-root').waitFor()

  await openPreferences(page)

  const dialog = page.getByRole('dialog', { name: 'Preferences' })
  await expect(dialog).toBeVisible()

  const sectionIds = ['appearance', 'canvas', 'guides', 'capabilities', 'ai', 'shortcuts']
  for (const id of sectionIds) {
    await expect(page.getByTestId(`preferences-tab-${id}`)).toBeVisible()
  }

  const appearanceTab = page.getByTestId('preferences-tab-appearance')
  await expect(appearanceTab).toHaveAttribute('aria-selected', 'true')
  const themeCombobox = dialog.getByRole('combobox', { name: 'Theme' })
  const shortcutsSearch = page.getByTestId('preferences-shortcuts-search')
  await expect(themeCombobox).toBeVisible()
  await expect(shortcutsSearch).toBeHidden()

  const shortcutsTab = page.getByTestId('preferences-tab-shortcuts')
  await shortcutsTab.click()
  await expect(shortcutsSearch).toBeVisible()
  await expect(themeCombobox).toBeHidden()

  await appearanceTab.click()
  await expect(appearanceTab).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  const canvasTab = page.getByTestId('preferences-tab-canvas')
  await expect(canvasTab).toHaveAttribute('aria-selected', 'true')

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()

  await openPreferences(page)
  await expect(dialog).toBeVisible()
  await expect(canvasTab).toHaveAttribute('aria-selected', 'true')
})
