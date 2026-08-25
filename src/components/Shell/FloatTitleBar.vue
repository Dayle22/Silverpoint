<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  closeRegisteredPanel,
  containerMembers,
  nudgePanel,
  panelLayout,
  startContainerDrag,
  type FloatId
} from '@/app/shell/panels'
import IconButton from '@/components/ui/IconButton.vue'

const { containerId } = defineProps<{ containerId: FloatId }>()

const { panels } = useI18n()

const members = computed(() => containerMembers(panelLayout.value, containerId))
const label = computed(() => {
  const first = members.value[0]
  if (!first) return ''
  const val = panels.value[first]
  return typeof val === 'string' ? val : ''
})

const NUDGE_STEP = 1
const NUDGE_STEP_LARGE = 10

function onKeydown(event: KeyboardEvent): void {
  const first = members.value[0]
  if (!first) return

  const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  nudgePanel(first, move[0], move[1])
}

function onClose(): void {
  const currentMembers = [...members.value]
  for (const id of currentMembers) {
    closeRegisteredPanel(id)
  }
}
</script>

<template>
  <header
    :data-test-id="`float-title-${containerId}`"
    role="group"
    :aria-label="label"
    tabindex="0"
    class="flex h-6 shrink-0 cursor-grab items-center gap-1 rounded-t-lg border-b border-border bg-panel px-2 select-none active:cursor-grabbing"
    @pointerdown="startContainerDrag(containerId, $event)"
    @keydown="onKeydown"
  >
    <icon-lucide-grip-horizontal class="size-3 shrink-0 text-muted" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-[11px] font-semibold text-surface">{{ label }}</span>
    <IconButton
      :label="panels.closePanel"
      :data-test-id="`float-close-${containerId}`"
      @click="onClose"
    >
      <icon-lucide-x class="size-3" />
    </IconButton>
  </header>
</template>
