<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, useSelectionState } from '@open-pencil/vue'
import { colorToFill } from '@open-pencil/core/color'
import IconButton from '@/components/ui/IconButton.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import PanelEmptyState from '@/components/ui/panel/PanelEmptyState.vue'
import {
  swatches,
  recentColours,
  addSwatch,
  deleteSwatch,
  applySwatchToSelection,
  currentSelectionSolidHex
} from '@/app/swatches'

const { panels } = useI18n()
const { editor, selectedNode, selectedIds } = useSelectionState()

const currentHex = computed(() => {
  void selectedNode.value
  void selectedIds.value
  if (!editor) return null
  return currentSelectionSolidHex(editor)
})

function handleAddCurrent() {
  if (!currentHex.value) return
  addSwatch(currentHex.value)
}

function handleApply(hex: string) {
  if (!editor) return
  applySwatchToSelection(editor, hex)
}

function handleDelete(id: string, event: MouseEvent) {
  event.stopPropagation()
  deleteSwatch(id)
}
</script>

<template>
  <div data-test-id="swatches-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between px-3 py-2">
      <span class="text-[11px] tracking-wider text-muted uppercase">
        {{ panels.swatches }}
      </span>
      <IconButton
        data-test-id="swatches-add-current"
        :label="panels.addCurrentColor"
        :disabled="currentHex === null"
        @click="handleAddCurrent"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </div>

    <div class="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
      <template v-if="recentColours.length > 0">
        <h3 class="mb-1 mt-2 text-[11px] tracking-wider text-muted uppercase">
          {{ panels.recentColors }}
        </h3>
        <div data-test-id="swatches-recent-grid" class="grid grid-cols-6 gap-1.5">
          <div
            v-for="hex in recentColours"
            :key="hex"
            data-test-id="swatch-item"
            :data-swatch-hex="hex"
            class="group relative min-w-0"
          >
            <button
              type="button"
              data-test-id="swatch-apply"
              class="block aspect-square w-full cursor-pointer rounded-md border border-border bg-transparent p-0 outline-none hover:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              :aria-label="panels.applySwatch({ name: hex, hex })"
              @click="handleApply(hex)"
            >
              <FillSwatch :fill="colorToFill(hex)" class="size-full rounded-md" />
            </button>
          </div>
        </div>
      </template>

      <h3 class="mb-1 mt-2 text-[11px] tracking-wider text-muted uppercase">
        {{ panels.savedColors }}
      </h3>
      <div
        v-if="swatches.length > 0"
        data-test-id="swatches-saved-grid"
        class="grid grid-cols-6 gap-1.5"
      >
        <div
          v-for="swatch in swatches"
          :key="swatch.id"
          data-test-id="swatch-item"
          :data-swatch-id="swatch.id"
          :data-swatch-hex="swatch.hex"
          class="group relative min-w-0"
        >
          <button
            type="button"
            data-test-id="swatch-apply"
            class="block aspect-square w-full cursor-pointer rounded-md border border-border bg-transparent p-0 outline-none hover:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            :aria-label="panels.applySwatch({ name: swatch.name, hex: swatch.hex })"
            @click="handleApply(swatch.hex)"
          >
            <FillSwatch :fill="colorToFill(swatch.hex)" class="size-full rounded-md" />
          </button>
          <button
            type="button"
            data-test-id="swatch-delete"
            class="absolute -right-1 -top-1 flex size-4 cursor-pointer items-center justify-center rounded-md border border-border bg-panel text-muted opacity-0 shadow-sm outline-none group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-hover hover:text-surface focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent"
            :aria-label="`${panels.deleteSwatch}: ${swatch.name}`"
            @click="handleDelete(swatch.id, $event)"
          >
            <icon-lucide-x class="size-3" />
          </button>
        </div>
      </div>
      <PanelEmptyState v-else :message="panels.noSavedSwatches" />
    </div>
  </div>
</template>
