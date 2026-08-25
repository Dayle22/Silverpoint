<script setup lang="ts">
import { computed } from 'vue'

import AppGroupedSelect from '@/components/ui/AppGroupedSelect.vue'
import {
  AI_PROVIDERS,
  IS_TAURI
} from '@open-pencil/core/constants'
import { useAIChat } from '@/app/ai/chat/use'

const { providerID, providerDef } = useAIChat()

const codexAvailable = computed(() => IS_TAURI)
const antigravityAvailable = computed(() => IS_TAURI)

const displayName = computed(() => {
  if (providerID.value === 'codex-cli') return 'Codex CLI (ChatGPT sign-in)'
  if (providerID.value === 'antigravity-cli') return 'Antigravity CLI (Google sign-in)'
  return providerDef.value.name
})

interface ProviderSelectProps {
  ui?: {
    trigger?: string
    content?: string
    item?: string
    label?: string
    separator?: string
  }
}

const { ui } = defineProps<ProviderSelectProps>()

const groups = computed(() => {
  const result: Array<{ label?: string; items: Array<{ value: string; label: string }> }> = []

  result.push({
    label: codexAvailable.value ? 'API key or installed agent CLI' : undefined,
    items: AI_PROVIDERS.filter((provider) =>
      (provider.id !== 'codex-cli' || codexAvailable.value) &&
      (provider.id !== 'antigravity-cli' || antigravityAvailable.value)
    ).map((provider) => ({
      value: provider.id,
      label: provider.name
    }))
  })

  return result
})
</script>

<template>
  <AppGroupedSelect v-model="providerID" :groups="groups" :display-value="displayName" :ui="ui" />
</template>
