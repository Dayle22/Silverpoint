<script setup lang="ts">
import { vTestId } from '@open-pencil/vue'

import type { ToolbarActionItem } from '@/components/Toolbar/types'

const { actions, testPrefix } = defineProps<{
  actions: ToolbarActionItem[]
  testPrefix: string
}>()

const emit = defineEmits<{
  action: [item: ToolbarActionItem]
}>()
</script>

<template>
  <button
    v-for="item in actions"
    :key="item.label"
    v-test-id="`${testPrefix}-${item.label.toLowerCase()}`"
    class="flex size-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted/80 transition-all duration-150 select-none hover:bg-hover hover:text-surface active:scale-95"
    @click="emit('action', item)"
  >
    <component :is="item.icon" class="size-[17px] stroke-[1.75]" />
  </button>
</template>
