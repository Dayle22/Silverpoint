import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { MENU_ARTIFACTS } from './menu'

for (const [path, render] of Object.entries(MENU_ARTIFACTS)) {
  try {
    mkdirSync(dirname(path), { recursive: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code !== 'EEXIST') throw error
  }
  writeFileSync(path, render())
}
