<script setup lang="ts">
import { ref } from 'vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { useI18n } from '@open-pencil/vue'

import ExportSection from '@/components/properties/ExportSection.vue'
import { usePopoverUI } from '@/components/ui/popover'

const { panels } = useI18n()
const open = ref(false)
const cls = usePopoverUI({ content: 'z-50 max-h-[80vh] w-80 overflow-y-auto p-0' })

function handleEscape(event?: Event | KeyboardEvent) {
  event?.stopPropagation?.()
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        data-test-id="export-popover-button"
        type="button"
        class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none bg-accent px-3 text-xs font-medium text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent data-[state=open]:bg-accent/90"
      >
        <icon-lucide-download class="size-3.5" />
        {{ panels.export }}
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="export-popover"
        :class="cls.content"
        :side-offset="8"
        :collision-padding="8"
        side="bottom"
        align="end"
        @escape-key-down="handleEscape"
      >
        <ExportSection :ui="{ root: 'border-b-0 px-3', body: 'pb-3' }" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
