import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import SYSTEM_PROMPT from './system-prompt.md?raw'
import { getAutomationAuthToken } from '@/app/automation/mcp/spawn'
import { getAIWorkspace } from '@/app/ai/codex/workspace'

export type CliProcess = {
  kill(): Promise<unknown>
  cleanup?(): Promise<unknown>
}

export type CliStreamState<R> = {
  remainder: R
  textStarted: boolean
}

type SpawnOptions = {
  workspace: string
  prompt: string
  authToken: string
  onData: (chunk: Uint8Array) => void
  onError: (message: string) => void
  onClose: (code: number | null) => void
}

type CliTransportOptions<P extends CliProcess, R> = {
  spawn: (options: SpawnOptions) => Promise<P>
  redact: (text: string) => string
  initialRemainder: R
  onData: (chunk: Uint8Array, state: CliStreamState<R>, textId: string) => {
    state: CliStreamState<R>
    chunks: UIMessageChunk[]
  }
  onClose: (code: number | null, state: CliStreamState<R>, textId: string) => {
    state: CliStreamState<R>
    chunks: UIMessageChunk[]
  }
  firstOutputTimeoutMs?: number
  systemPrompt?: string
}

export type CliChatTransport = ChatTransport<UIMessage> & {
  destroy(): Promise<void>
}

function promptFromMessages(systemPrompt: string, messages: UIMessage[]): string {
  const history = messages
    .slice(-12)
    .map((message) => {
      const text = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
      return `${message.role}: ${text}`
    })
    .join('\n\n')
  return `${systemPrompt}\n\nConversation:\n${history}`
}

export function createCliChatTransport<P extends CliProcess, R>(
  options: CliTransportOptions<P, R>
): CliChatTransport {
  let child: P | null = null

  return {
    async sendMessages({ messages, abortSignal }) {
      const workspace = await getAIWorkspace()
      const authToken = await getAutomationAuthToken()
      if (!authToken)
        throw new Error('Bundled MCP authentication is unavailable. Restart Silverpoint.')
      const prompt = promptFromMessages(options.systemPrompt ?? SYSTEM_PROMPT, messages)

      return new ReadableStream<UIMessageChunk>({
        start: (controller) => {
          const textId = `text-${Date.now()}`
          let state: CliStreamState<R> = {
            remainder: options.initialRemainder,
            textStarted: false
          }
          let stderr = ''
          let closed = false
          const firstOutputTimer = setTimeout(() => {
            void child?.kill()
            finish('error', 'CLI did not produce output in time.')
          }, options.firstOutputTimeoutMs ?? 30_000)
          let inactivityTimer: ReturnType<typeof setTimeout> | undefined
          const abort = () => {
            void child?.kill()
            finish('stop')
          }
          const finish = (reason: 'stop' | 'other' | 'error', errorText?: string) => {
            if (closed) return
            closed = true
            clearTimeout(firstOutputTimer)
            if (inactivityTimer) clearTimeout(inactivityTimer)
            abortSignal?.removeEventListener('abort', abort)
            if (errorText)
              controller.enqueue({ type: 'error', errorText: options.redact(errorText) })
            if (state.textStarted) controller.enqueue({ type: 'text-end', id: textId })
            controller.enqueue({ type: 'finish-step' })
            controller.enqueue({ type: 'finish', finishReason: reason })
            controller.close()
            void child?.cleanup?.()
            child = null
          }
          const armInactivity = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer)
            inactivityTimer = setTimeout(() => {
              void child?.kill()
              finish('error', 'CLI stopped responding.')
            }, 120_000)
          }
          abortSignal?.addEventListener('abort', abort, { once: true })
          controller.enqueue({ type: 'start' })
          controller.enqueue({ type: 'start-step' })
          void options.spawn({
            workspace,
            prompt,
            authToken,
            onData: (chunk) => {
              if (closed) return
              clearTimeout(firstOutputTimer)
              armInactivity()
              const result = options.onData(chunk, state, textId)
              state = result.state
              for (const next of result.chunks) controller.enqueue(next)
            },
            onError: (message) => {
              if (!closed) stderr = options.redact(`${stderr}\n${message}`.trim())
            },
            onClose: (code) => {
              if (closed) return
              const result = options.onClose(code, state, textId)
              state = result.state
              for (const next of result.chunks) controller.enqueue(next)
              if (code !== 0) finish('error', stderr || `CLI exited with code ${code ?? 'unknown'}.`)
              else if (!state.textStarted) finish('error', 'CLI returned no usable response.')
              else finish('stop')
            }
          })
            .then(async (nextChild) => {
              if (closed) {
                await nextChild.kill()
                await nextChild.cleanup?.()
              } else child = nextChild
              return nextChild
            })
            .catch((error: unknown) =>
              finish('error', error instanceof Error ? error.message : String(error))
            )
        }
      })
    },
    async reconnectToStream() {
      return null
    },
    async destroy() {
      await child?.kill()
      await child?.cleanup?.()
      child = null
    }
  }
}
