import { describe, expect, test } from 'bun:test'

const config = (await Bun.file(
  new URL('../../../desktop/tauri.conf.json', import.meta.url)
).json()) as {
  app?: { windows?: Array<{ dragDropEnabled?: boolean }> }
}

describe('desktop image drop configuration', () => {
  test('keeps frontend HTML5 drag and drop enabled on Windows', () => {
    expect(config.app.windows[0]?.dragDropEnabled).toBe(false)
  })
})
