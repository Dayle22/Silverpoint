<script setup lang="ts">
import { computed } from 'vue'

import { capability, setCapability, type Capability } from '@/app/shell/capability'
import SegmentedControl, { type SegmentedControlOption } from '@/components/ui/SegmentedControl.vue'

const options: SegmentedControlOption[] = [
  { value: 'essential', label: 'Essential' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'dev', label: 'Dev' }
]

const model = computed({
  get: () => capability.value,
  set: (val: string) => setCapability(val as Capability)
})

const switcherUI = {
  root: 'gap-0.5 rounded-md border border-border/80 bg-panel/90 p-0.5 shadow-sm',
  item: 'h-6 gap-1 rounded px-2 text-[11px] font-medium data-[state=on]:bg-panel-selected-muted data-[state=on]:font-semibold data-[state=on]:text-surface data-[state=on]:ring-1 data-[state=on]:ring-accent'
}
</script>

<template>
  <div class="flex items-center" data-test-id="persona-switcher">
    <SegmentedControl
      v-model="model"
      :options="options"
      label="Workspace Persona"
      size="sm"
      :ui="switcherUI"
    >
      <template #option="{ option, selected }">
        <div
          class="flex items-center gap-1"
          :data-test-id="'persona-' + option.value"
          :data-active="selected || undefined"
        >
          <icon-lucide-sparkles v-if="option.value === 'essential'" class="size-3" />
          <icon-lucide-sliders-horizontal v-else-if="option.value === 'advanced'" class="size-3" />
          <icon-lucide-code-2 v-else-if="option.value === 'dev'" class="size-3" />
          <span class="truncate">{{ option.label }}</span>
        </div>
      </template>
    </SegmentedControl>
  </div>
</template>
