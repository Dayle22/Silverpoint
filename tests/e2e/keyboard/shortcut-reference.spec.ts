// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.describe('Keyboard shortcut reference (T-055)', () => {
  test('opens preferences dialog and shows searchable shortcut reference', async () => {
    // Open app menu -> Edit -> Preferences
    const appMenuTrigger = editor.page.getByTestId('app-icon-menu-trigger')
    await expect(appMenuTrigger).toBeVisible()
    await appMenuTrigger.click()

    const editGroup = editor.page.getByTestId('app-menu-group-edit')
    await expect(editGroup).toBeVisible()
    await editGroup.hover()

    const preferencesItem = editor.page.getByRole('menuitem', { name: 'Preferences' })
    await expect(preferencesItem).toBeVisible()
    await preferencesItem.click()

    await editor.page.getByTestId('preferences-tab-shortcuts').click()

    // Assert preferences dialog and shortcut search input are visible
    const searchInput = editor.page.getByTestId('preferences-shortcuts-search')
    await expect(searchInput).toBeVisible()

    // Initial state: known rows from all groups are visible
    const duplicateRow = editor.page.getByTestId('shortcut-row-selection.duplicate')
    const selectRow = editor.page.getByTestId('shortcut-row-selection.selectAll')
    const toolSelectRow = editor.page.getByTestId('shortcut-row-tool-select')
    const toggleAiRow = editor.page.getByTestId('shortcut-row-toggle-ai')

    await expect(duplicateRow).toBeVisible()
    await expect(selectRow).toBeVisible()
    await expect(toolSelectRow).toBeVisible()
    await expect(toggleAiRow).toBeVisible()

    // Search for "duplicate"
    await searchInput.fill('duplicate')
    await expect(duplicateRow).toBeVisible()
    await expect(selectRow).toHaveCount(0)
    await expect(toolSelectRow).toHaveCount(0)
    await expect(toggleAiRow).toHaveCount(0)

    // Search for non-matching query
    await searchInput.fill('nonexistentquery123')
    await expect(duplicateRow).toHaveCount(0)
    await expect(selectRow).toHaveCount(0)
    await expect(toolSelectRow).toHaveCount(0)
    await expect(toggleAiRow).toHaveCount(0)

    // Clear search query and verify rows return
    await searchInput.fill('')
    await expect(duplicateRow).toBeVisible()
    await expect(selectRow).toBeVisible()
    await expect(toolSelectRow).toBeVisible()
    await expect(toggleAiRow).toBeVisible()
  })
})
