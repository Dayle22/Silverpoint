import { describe, expect, test } from 'bun:test'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import { createCodexTransport } from '@/app/ai/chat/transports'

describe('Tauri Codex transport', () => {
  test('exposes the no-key Codex CLI provider', () => {
    expect(AI_PROVIDERS.find((provider) => provider.id === 'codex-cli')).toMatchObject({
      name: 'Codex CLI (ChatGPT sign-in)'
    })
  })

  test('constructs a direct Codex transport for the new provider', async () => {
    const transport = await createCodexTransport('codex-cli')
    expect(transport).toBeDefined()
  })
})
