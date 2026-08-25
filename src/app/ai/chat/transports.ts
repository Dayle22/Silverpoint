import { Chat } from '@ai-sdk/vue'
import { DirectChatTransport, stepCountIs, ToolLoopAgent } from 'ai'
import type { ChatTransport, UIMessage } from 'ai'
import type { ComputedRef, Ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import { createLanguageModel, resolveLanguageModelID } from '@/app/ai/chat/model'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'
import { MAX_AGENT_STEPS, createAITools, recordStepUsage, resetRunSteps } from '@/app/ai/tools'
import type { getActiveEditorStore } from '@/app/editor/active-store'

type EditorStore = ReturnType<typeof getActiveEditorStore>

type ChatSessionOptions = {
  isConfigured: ComputedRef<boolean>
  providerID: Ref<AIProviderID>
  apiKey: Ref<string>
  modelID: Ref<string>
  customModelID: Ref<string>
  customBaseURL: Ref<string>
  customAPIType: Ref<'completions' | 'responses'>
  maxOutputTokens: Ref<number>
  getActiveEditorStore: () => EditorStore
}

type ToolLoopTransportOptions = {
  store: EditorStore
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  maxOutputTokens: number
}

const ANTHROPIC_CACHE_CONTROL = {
  anthropic: { cacheControl: { type: 'ephemeral' } }
} as const

function supportsAnthropicCaching(providerID: AIProviderID, modelID: string): boolean {
  return (
    providerID === 'anthropic' ||
    providerID === 'anthropic-compatible' ||
    (providerID === 'openrouter' && modelID.startsWith('anthropic/'))
  )
}

export async function createCodexTransport(providerID: AIProviderID) {
  if (providerID !== 'codex-cli') throw new Error(`Unknown Codex provider: ${providerID}`)
  const { CodexChatTransport } = await import('@/app/ai/codex/transport')
  return new CodexChatTransport()
}

export async function createAntigravityTransport(providerID: AIProviderID) {
  if (providerID !== 'antigravity-cli') throw new Error(`Unknown Antigravity provider: ${providerID}`)
  const { AntigravityChatTransport } = await import('@/app/ai/antigravity/transport')
  return new AntigravityChatTransport()
}

export function createToolLoopTransport({
  store,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens
}: ToolLoopTransportOptions) {
  const tools = createAITools(store)
  const effectiveModelID = resolveLanguageModelID({ providerID, modelID, customModelID })
  const cacheProviderOptions = supportsAnthropicCaching(providerID, effectiveModelID)
    ? ANTHROPIC_CACHE_CONTROL
    : undefined

  const agent = new ToolLoopAgent({
    model: createLanguageModel({
      providerID,
      apiKey,
      modelID,
      customModelID,
      customBaseURL,
      customAPIType
    }),
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxOutputTokens,
    providerOptions: cacheProviderOptions,
    prepareCall: (options) => {
      resetRunSteps(store)
      return {
        ...options,
        maxOutputTokens,
        providerOptions: cacheProviderOptions
      }
    },
    onStepFinish: ({ usage }) => {
      recordStepUsage(
        {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
          cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
          timestamp: Date.now()
        },
        store
      )
    }
  })

  return new DirectChatTransport({ agent }) as ChatTransport<UIMessage>
}

export function createChatSessionManager({
  isConfigured,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens,
  getActiveEditorStore
}: ChatSessionOptions) {
  let transportDirty = false
  let currentChatStore: EditorStore | null = null
  const currentChatMessages = new WeakMap<EditorStore, UIMessage[]>()
  let chat: Chat<UIMessage> | null = null
  let codexTransportInstance: { destroy(): Promise<void> } | null = null
  let overrideTransport: (() => ChatTransport<UIMessage>) | null = null

  function markTransportDirty() {
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, snapshotMessages(chat.messages))
    }
    transportDirty = true
    currentChatStore = null
  }

  async function createActiveCodexTransport() {
    await codexTransportInstance?.destroy()
    const transport = await createCodexTransport(providerID.value)
    codexTransportInstance = transport
    return transport as ChatTransport<UIMessage>
  }

  function createTransport(store: EditorStore) {
    if (overrideTransport) return overrideTransport()

    void codexTransportInstance?.destroy()
    codexTransportInstance = null

    return createToolLoopTransport({
      store,
      providerID: providerID.value,
      apiKey: apiKey.value,
      modelID: modelID.value,
      customModelID: customModelID.value,
      customBaseURL: customBaseURL.value,
      customAPIType: customAPIType.value,
      maxOutputTokens: maxOutputTokens.value
    })
  }

  async function ensureChat(): Promise<Chat<UIMessage> | null> {
    if (!isConfigured.value) return null

    const store = getActiveEditorStore()
    if (currentChatStore && chat) {
      currentChatMessages.set(currentChatStore, snapshotMessages(chat.messages))
    }

    if (!chat || transportDirty || currentChatStore !== store) {
      const messages =
        currentChatMessages.get(store) ??
        (currentChatStore ? currentChatMessages.get(currentChatStore) : undefined)
      let transport: ChatTransport<UIMessage>
      if (providerID.value === 'codex-cli') {
        transport = await createActiveCodexTransport()
      } else if (providerID.value === 'antigravity-cli') {
        transport = await createAntigravityTransport(providerID.value) as ChatTransport<UIMessage>
      } else {
        transport = createTransport(store)
      }
      chat = new Chat<UIMessage>({ transport, messages })
      currentChatStore = store
      transportDirty = false
    }
    return chat
  }

  function resetChat() {
    if (currentChatStore) currentChatMessages.delete(currentChatStore)
    chat = null
    currentChatStore = null
    transportDirty = false
  }

  function setOverrideTransport(factory: (() => ChatTransport<UIMessage>) | null) {
    overrideTransport = factory
    markTransportDirty()
  }

  return { ensureChat, resetChat, markTransportDirty, setOverrideTransport }
}

function snapshotMessages(messages: UIMessage[]): UIMessage[] {
  // eslint-disable-next-line unicorn/prefer-structured-clone -- AI SDK messages can contain non-cloneable runtime values.
  return JSON.parse(JSON.stringify(messages)) as UIMessage[]
}
