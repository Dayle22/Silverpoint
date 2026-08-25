import { afterEach, describe, expect, test, vi } from 'bun:test'

import { getAIWorkspace } from '@/app/ai/codex/workspace'
import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Codex AI workspace', () => {
  test('uses only the app-local AI workspace', async () => {
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:path|resolve_directory') return 'C:\\Silverpoint\\AppLocalData'
      if (cmd === 'plugin:path|join') return (args as { paths: string[] }).paths.join('\\')
      if (cmd === 'plugin:fs|exists') return false
      return null
    })
    await expect(getAIWorkspace()).resolves.toBe('C:\\Silverpoint\\AppLocalData\\ai-workspace')
  })

  test('grants the exists permission required to create the AI workspace', async () => {
    const capabilityUrl = new URL('../../../desktop/capabilities/default.json', import.meta.url)
    const capability = await Bun.file(capabilityUrl).text()

    expect(capability).toContain('fs:allow-exists')
  })
})
