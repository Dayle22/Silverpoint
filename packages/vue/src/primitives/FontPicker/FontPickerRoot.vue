<script setup lang="ts">
import { nextTick } from 'vue'
import { templateRef, unrefElement } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxVirtualizer,
  ComboboxViewport,
  type AcceptableValue
} from 'reka-ui'

import {
  useFontPicker,
  type FontAccessController,
  type FontCategory,
  type FontFamilyOption
} from '#vue/primitives/FontPicker/useFontPicker'

import type { FontPickerUI } from '#vue/primitives/FontPicker/types'

const {
  listFamilies,
  localFontAccess,
  documentFonts,
  popularFonts,
  googleFonts,
  variableFonts,
  initialCategory,
  ui,
  emptySearchText,
  emptyFontsText,
  emptyFontsHint
} = defineProps<{
  listFamilies: () => Promise<string[] | FontFamilyOption[]>
  localFontAccess?: FontAccessController
  documentFonts?: MaybeRefOrGetter<string[]>
  popularFonts?: MaybeRefOrGetter<string[]>
  googleFonts?: MaybeRefOrGetter<string[]>
  variableFonts?: MaybeRefOrGetter<string[]>
  initialCategory?: FontCategory
  ui?: FontPickerUI
  emptySearchText?: string
  emptyFontsText?: string
  emptyFontsHint?: string
}>()

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const contentRef = templateRef<HTMLElement>('contentRef')

function focusSearchInput() {
  nextTick(() => {
    const content = unrefElement(contentRef)
    if (!(content instanceof HTMLElement)) return
    content.querySelector<HTMLInputElement>('input')?.focus()
  })
}

const {
  searchTerm,
  open,
  categories,
  activeCategory,
  setCategory,
  filtered,
  loading,
  accessState,
  requestAccess,
  select
} = useFontPicker({
  modelValue,
  listFamilies,
  localFontAccess,
  documentFonts,
  popularFonts,
  googleFonts,
  variableFonts,
  initialCategory,
  onSelect: (family) => emit('select', family)
})
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :model-value="modelValue"
    :ignore-filter="true"
    @update:model-value="
      (v: AcceptableValue) => {
        if (typeof v === 'string') select(v)
      }
    "
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <slot name="trigger" :value="modelValue" :open="open">
          <button :class="ui?.trigger">
            <span class="truncate">{{ modelValue }}</span>
          </button>
        </slot>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :side-offset="2"
        align="start"
        position="popper"
        :class="
          ui?.content ??
          'isolate z-[1000] w-64 max-w-[90vw] overflow-hidden p-1 rounded-lg shadow-2xl border border-border bg-panel text-surface'
        "
        @open-auto-focus.prevent
        ref="contentRef"
        @vue:mounted="focusSearchInput"
      >
        <slot
          name="categories"
          :categories="categories"
          :active-category="activeCategory"
          :set-category="setCategory"
        >
          <div :class="ui?.categories ?? 'flex flex-col gap-0.5 p-1 bg-panel'">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              :class="[
                ui?.categoryItem ??
                  'flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-hover',
                activeCategory === cat.id
                  ? (ui?.categoryItemActive ?? 'bg-accent/10 text-accent font-semibold')
                  : 'text-surface'
              ]"
              @click="setCategory(cat.id)"
            >
              <slot name="category-item" :category="cat" :active="activeCategory === cat.id">
                <span class="truncate flex-1">{{ cat.label }}</span>
                <span v-if="activeCategory === cat.id" class="size-1.5 rounded-full bg-accent" />
              </slot>
            </button>
          </div>
        </slot>

        <div :class="ui?.divider ?? 'border-b border-border my-1'" />

        <slot name="search" :search-term="searchTerm">
          <ComboboxInput
            v-model="searchTerm"
            :display-value="() => ''"
            :class="ui?.search"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </slot>

        <ComboboxViewport :class="ui?.viewport ?? 'max-h-72 overflow-y-auto bg-panel scrollbar-thin'">
          <ComboboxVirtualizer
            v-slot="{ option }"
            :options="filtered"
            :text-content="(option: FontFamilyOption) => option.family"
            :estimate-size="36"
          >
            <ComboboxItem
              :value="option.family"
              :class="ui?.item"
              :style="{ fontFamily: `'${option.family}', sans-serif` }"
            >
              <slot
                name="item"
                :family="option.family"
                :source="option.source"
                :selected="option.family === modelValue"
              >
                <ComboboxItemIndicator>
                  <slot name="indicator" :selected="option.family === modelValue" />
                </ComboboxItemIndicator>
                <span class="truncate">{{ option.family }}</span>
              </slot>
            </ComboboxItem>
          </ComboboxVirtualizer>

          <div v-if="filtered.length === 0 && searchTerm" :class="ui?.empty">
            {{ emptySearchText ?? 'No fonts found' }}
          </div>
          <div v-else-if="filtered.length === 0" :class="ui?.empty">
            <div>
              <p v-if="activeCategory === 'in-file'">No fonts used in this file yet.</p>
              <p v-else-if="accessState === 'prompt'">
                Allow local font access to browse installed fonts.
              </p>
              <p v-else-if="accessState === 'denied'">
                Local font access is blocked for this site.
              </p>
              <p v-else-if="accessState === 'unsupported'">
                Local fonts are not available in this browser.
              </p>
              <p v-else>{{ emptyFontsText ?? 'No fonts available.' }}</p>
              <p
                v-if="emptyFontsHint && activeCategory === 'installed'"
                class="mt-1"
              >
                {{ emptyFontsHint }}
              </p>
              <button
                v-if="accessState === 'prompt'"
                type="button"
                :class="ui?.emptyAction"
                :disabled="loading"
                @click="requestAccess"
              >
                {{ loading ? 'Loading…' : 'Allow local fonts' }}
              </button>
            </div>
          </div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
