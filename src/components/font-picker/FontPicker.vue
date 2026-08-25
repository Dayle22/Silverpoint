<script setup lang="ts">
import { computed, inject } from 'vue'
import { EDITOR_KEY, FontPickerRoot } from '@open-pencil/vue'

import { useSelectUI } from '@/components/ui/select'
import {
  GOOGLE_FONT_FAMILIES,
  KNOWN_VARIABLE_FONTS,
  POPULAR_FONT_FAMILIES,
  listFamilies,
  localFontAccessState,
  requestLocalFontAccess
} from '@/app/editor/fonts'

import type { FontPickerUI } from '@open-pencil/vue'

const { label = 'Font family' } = defineProps<{ label?: string }>()
const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const selectCls = useSelectUI({
  trigger: 'w-full rounded px-2 py-1 text-xs',
  item: 'w-full gap-2 px-3 py-2 text-xs leading-tight'
})

const editor = inject(EDITOR_KEY, null)

const documentFonts = computed<string[]>(() => {
  if (!editor || !editor.graph) return []
  const fonts = new Set<string>()
  for (const node of editor.graph.nodes.values()) {
    if (node.type === 'TEXT') {
      if (node.fontFamily) fonts.add(node.fontFamily)
      if (node.styleRuns) {
        for (const run of node.styleRuns) {
          if (run.style?.fontFamily) fonts.add(run.style.fontFamily)
        }
      }
    }
  }
  return Array.from(fonts).sort((a, b) => a.localeCompare(b))
})

const ui = computed<FontPickerUI>(() => ({
  trigger: selectCls.trigger,
  content:
    'isolate z-[1000] w-64 max-w-[90vw] overflow-hidden p-1 rounded-lg shadow-2xl border border-border bg-panel text-surface',
  categories: 'flex flex-col gap-0.5 p-1 bg-panel',
  categoryItem:
    'flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-normal text-surface hover:bg-hover transition-colors cursor-pointer text-left w-full',
  categoryItemActive:
    'flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium bg-[#0d99ff] text-white cursor-pointer text-left w-full',
  divider: 'border-b border-border/70 my-1 mx-1',
  search:
    'w-full border-b border-border/70 bg-input/40 px-3 py-2 text-xs text-surface outline-none placeholder:text-muted',
  item: 'w-full flex items-center gap-2 px-2.5 py-2 text-xs text-surface hover:bg-hover rounded transition-colors cursor-pointer',
  viewport: 'max-h-64 overflow-y-auto p-1 bg-panel scrollbar-thin',
  empty: 'px-3 py-4 text-center text-xs text-muted',
  emptyAction:
    'mt-2 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50'
}))

const localFontAccess = {
  state: localFontAccessState,
  load: requestLocalFontAccess
}
</script>

<template>
  <FontPickerRoot
    v-model="modelValue"
    data-test-id="font-picker-root"
    :list-families="listFamilies"
    :local-font-access="localFontAccess"
    :document-fonts="documentFonts"
    :popular-fonts="POPULAR_FONT_FAMILIES"
    :google-fonts="[...GOOGLE_FONT_FAMILIES]"
    :variable-fonts="KNOWN_VARIABLE_FONTS"
    :ui="ui"
    empty-fonts-hint="Use the desktop app or Chrome/Edge to access system fonts."
    @select="emit('select', $event)"
  >
    <template #trigger>
      <button
        type="button"
        data-test-id="font-picker-trigger"
        :aria-label="label"
        :class="selectCls.trigger"
      >
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </template>

    <template #category-item="{ category, active }">
      <icon-lucide-check v-if="active" class="size-3.5 shrink-0 text-white" />
      <span v-else class="size-3.5 shrink-0" />
      <span class="truncate flex-1">{{ category.label }}</span>
    </template>

    <template #item="{ family, selected, source }">
      <div data-test-id="font-picker-item" class="flex min-w-0 flex-1 items-center gap-2">
        <icon-lucide-check v-if="selected" class="size-3.5 shrink-0 text-accent" />
        <span v-else class="size-3.5 shrink-0" />
        <span class="truncate text-xs" :style="{ fontFamily: `'${family}', sans-serif` }">
          {{ family }}
        </span>
        <span
          v-if="source && source !== 'local' && source !== 'bundled' && (source as string) !== 'in-file'"
          class="font-sans ml-auto shrink-0 rounded bg-input px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted"
        >
          {{ source }}
        </span>
      </div>
    </template>
  </FontPickerRoot>
</template>
