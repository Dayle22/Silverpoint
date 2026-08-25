import { createCliChatTransport, type CliStreamState } from '@/app/ai/chat/cli-transport'
import { redactAntigravityText, spawnAntigravityProcess } from './process'
import ANTIGRAVITY_SYSTEM_PROMPT from './system-prompt.md?raw'

type AntigravityState = CliStreamState<null>

export class AntigravityChatTransport {
  private readonly transport = createCliChatTransport({
    spawn: spawnAntigravityProcess,
    redact: redactAntigravityText,
    initialRemainder: null,
    firstOutputTimeoutMs: 120_000,
    systemPrompt: ANTIGRAVITY_SYSTEM_PROMPT,
    onData: (chunk: Uint8Array, state: AntigravityState, textId: string) => {
      const text = new TextDecoder().decode(chunk)
      if (!text) return { state, chunks: [] }
      const chunks = state.textStarted
        ? [{ type: 'text-delta' as const, id: textId, delta: text }]
        : [
            { type: 'text-start' as const, id: textId },
            { type: 'text-delta' as const, id: textId, delta: text }
          ]
      return { state: { remainder: null, textStarted: true }, chunks }
    },
    onClose: (_code, state) => ({ state, chunks: [] })
  })

  sendMessages = this.transport.sendMessages.bind(this.transport)
  reconnectToStream = this.transport.reconnectToStream.bind(this.transport)
  destroy = this.transport.destroy.bind(this.transport)
}
