// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import type { AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'

function actionItems(entries: readonly AppMenuEntry[]): AppMenuEntry[] {
  const result: AppMenuEntry[] = []
  for (const entry of entries) {
    if ('type' in entry && entry.type === 'separator') continue
    result.push(entry)
    if (entry.sub) result.push(...actionItems(entry.sub))
  }
  return result
}

describe('APP_MENU_SCHEMA', () => {
  test('exposes themes in the required order', () => {
    const theme = APP_MENU_SCHEMA.find((group) => group.label === 'View')?.items.find(
      (entry) => !('type' in entry) && entry.id === 'theme'
    )

    expect(theme && !('type' in theme) ? theme.sub?.map((entry) => entry.id) : []).toEqual([
      'theme-light',
      'theme-grey',
      'theme-dark',
      'theme-midnight',
      'theme-auto'
    ])
  })

  test('does not duplicate shortcuts for command-backed entries', () => {
    const duplicated = APP_MENU_SCHEMA.flatMap((group) =>
      actionItems(group.items).filter(
        (entry) => !('type' in entry) && entry.command && entry.shortcut
      )
    )

    expect(duplicated).toEqual([])
  })

  test('routes every theme item to the shared setter', () => {
    const selected: string[] = []
    const actions = createSharedEditorMenuActions((theme) => selected.push(theme))

    actions['theme-light']()
    actions['theme-grey']()
    actions['theme-dark']()
    actions['theme-midnight']()
    actions['theme-auto']()

    expect(selected).toEqual(['light', 'grey', 'dark', 'midnight', 'auto'])
  })

  test('exposes capability items in View menu', () => {
    const viewItems = APP_MENU_SCHEMA.find((group) => group.label === 'View')?.items ?? []
    const resetIndex = viewItems.findIndex((e) => !('type' in e) && e.id === 'reset-panel-layout')
    const simpleItem = viewItems[resetIndex + 1]
    const fullItem = viewItems[resetIndex + 2]
    const toggleUiItem = viewItems[resetIndex + 3]

    expect(simpleItem).toMatchObject({ id: 'capability-simple', label: 'Simple', checkbox: true })
    expect(fullItem).toMatchObject({ id: 'capability-full', label: 'Full', checkbox: true })
    expect(toggleUiItem).toMatchObject({ id: 'toggle-ui' })
  })

  test('menuMessageDefaults defines non-empty capability i18n keys', async () => {
    const { menuMessageDefaults } = await import('#vue/i18n/messages/menu')
    expect(typeof menuMessageDefaults.capability).toBe('string')
    expect(menuMessageDefaults.capability.length).toBeGreaterThan(0)
    expect(typeof menuMessageDefaults.capabilitySimple).toBe('string')
    expect(menuMessageDefaults.capabilitySimple.length).toBeGreaterThan(0)
    expect(typeof menuMessageDefaults.capabilityFull).toBe('string')
    expect(menuMessageDefaults.capabilityFull.length).toBeGreaterThan(0)
  })
})

