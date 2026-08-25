<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, ref } from 'vue'

import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import ProviderSettings from '@/components/chat/ProviderSettings/ProviderSettings.vue'
import AppInput from '@/components/ui/AppInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useButtonUI } from '@/components/ui/button'
import { useAIChat } from '@/app/ai/chat/use'
import { useI18n } from '@open-pencil/vue'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { dialogs } = useI18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
}>()

const input = ref('')

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const isCodexProvider = computed(() => providerID.value === 'codex-cli')
const isAntigravityProvider = computed(() => providerID.value === 'antigravity-cli')
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)

const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isCodexProvider || isAntigravityProvider">
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3" />
            {{ isCodexProvider ? 'Codex CLI (ChatGPT sign-in)' : 'Antigravity CLI (Google sign-in)' }}
          </div>
        </template>
        <template v-else-if="isCustomProvider || usesCustomModel">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
          </div>
        </template>
        <ProviderModelSelect v-else>
          <template #value>{{ selectedModelName }}</template>
        </ProviderModelSelect>

        <div class="ml-auto">
          <ProviderSettings />
        </div>
      </div>

      <!-- Input form -->
      <form class="flex gap-1.5" @submit="handleSubmit">
        <AppInput
          v-model="input"
          data-test-id="chat-input"
          :placeholder="dialogs.describeChange"
          class="min-w-0 flex-1 placeholder:text-muted"
          :disabled="isStreaming"
          @paste.stop
          @copy.stop
          @cut.stop
        />
        <Tip v-if="isStreaming" :label="dialogs.stopGenerating">
          <button
            type="button"
            data-test-id="chat-stop-button"
            :class="
              useButtonUI({
                tone: 'ghost',
                shape: 'rounded',
                size: 'sm',
                ui: { base: 'shrink-0 border border-border px-2 py-1.5' }
              }).base
            "
            @click="emit('stop')"
          >
            <icon-lucide-square class="size-3" />
          </button>
        </Tip>
        <Tip v-else :label="dialogs.sendMessage">
          <button
            type="submit"
            data-test-id="chat-send-button"
            :class="
              useButtonUI({
                tone: 'accent',
                shape: 'rounded',
                size: 'sm',
                ui: { base: 'shrink-0 px-2.5 py-1.5 font-medium' }
              }).base
            "
            :disabled="!input.trim()"
          >
            <icon-lucide-send class="size-3" />
          </button>
        </Tip>
      </form>
    </div>
  </TooltipProvider>
</template>
