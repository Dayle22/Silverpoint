import { createCliChatTransport, type CliStreamState } from '@/app/ai/chat/cli-transport'
import { mapCodexEvent, parseCodexJsonl } from './events'
import { spawnCodexProcess, redactCodexText } from './process'

type CodexState = CliStreamState<string>

function mapEvents(events: ReturnType<typeof parseCodexJsonl>['events'], textId: string, textStarted: boolean) {
  const chunks = []
  for (const event of events) {
    const mapped = mapCodexEvent(event, textId, textStarted)
    chunks.push(...mapped.chunks)
    textStarted = mapped.textStarted
  }
  return { chunks, textStarted }
}

export class CodexChatTransport {
  private readonly transport = createCliChatTransport({
    spawn: spawnCodexProcess,
    redact: redactCodexText,
    initialRemainder: '',
    onData: (chunk: Uint8Array, state: CodexState, textId: string) => {
      const parsed = parseCodexJsonl(new TextDecoder().decode(chunk), state.remainder)
      const mapped = mapEvents(parsed.events, textId, state.textStarted)
      return {
        state: { remainder: parsed.remainder, textStarted: mapped.textStarted },
        chunks: mapped.chunks
      }
    },
    onClose: (_code: number | null, state: CodexState, textId: string) => {
      const parsed = parseCodexJsonl('', state.remainder, true)
      const mapped = mapEvents(parsed.events, textId, state.textStarted)
      return {
        state: { remainder: parsed.remainder, textStarted: mapped.textStarted },
        chunks: mapped.chunks
      }
    }
  })

  sendMessages = this.transport.sendMessages.bind(this.transport)
  reconnectToStream = this.transport.reconnectToStream.bind(this.transport)
  destroy = this.transport.destroy.bind(this.transport)
}
