<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { capability, setCapability, type Capability } from '@/app/shell/capability'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

const { menu } = useI18n()

const model = computed({
  get: () => capability.value,
  set: (v) => setCapability(v as Capability)
})

const options = computed(() => [
  { value: 'simple', label: menu.value.capabilitySimple },
  { value: 'full', label: menu.value.capabilityFull }
])

const switcherUi = {
  root: 'gap-1 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md',
  item: 'h-8 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-accent'
}
</script>

<template>
  <SegmentedControl
    v-model="model"
    :options="options"
    :label="menu.capability"
    :ui="switcherUi"
    size="md"
    data-test-id="capability-switcher"
    class="max-w-[calc(100vw-32px)]"
  >
    <template #option="{ option }">
      <icon-lucide-sparkles
        v-if="option.value === 'simple'"
        class="size-3.5"
        data-test-id="capability-simple"
      />
      <icon-lucide-sliders-horizontal
        v-else-if="option.value === 'full'"
        class="size-3.5"
        data-test-id="capability-full"
      />
      <span class="truncate">{{ option.label }}</span>
    </template>
  </SegmentedControl>
</template>
