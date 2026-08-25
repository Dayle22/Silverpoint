import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-expect-error -- the standalone generator check does not load the App path aliases.
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-expect-error -- the standalone generator check does not load the App path aliases.
import type { AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-expect-error -- the standalone generator check does not load the App path aliases.
import { shortcutTokenToAccelerator } from '@/app/shell/menu/shortcut'

function isNativeVisible(entry: { target?: string }): boolean {
  return entry.target !== 'browser'
}

function cleanEntry(entry: AppMenuEntry): Record<string, unknown> | null {
  if (!isNativeVisible(entry)) return null
  if (entry.type === 'separator') return { type: 'separator' }
  return {
    id: entry.id,
    label: entry.label,
    accelerator: entry.accelerator ?? shortcutTokenToAccelerator(entry.shortcut),
    checkbox: entry.checkbox,
    sub: entry.sub?.map(cleanEntry).filter(Boolean)
  }
}

function cleanGroup(group: AppMenuGroupSchema): Record<string, unknown> | null {
  if (!isNativeVisible(group)) return null
  return {
    label: group.label,
    items: group.items.map(cleanEntry).filter(Boolean)
  }
}

const outputPath = 'desktop/generated/menu.json'
const menu = APP_MENU_SCHEMA.map(cleanGroup).filter(Boolean)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(menu, null, 2)}\n`)
