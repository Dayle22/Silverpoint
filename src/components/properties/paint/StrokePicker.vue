<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import {
  getStrokeCategory,
  strokeToGradient,
  strokeToSolid,
  useI18n
} from '@open-pencil/vue'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import GradientEditor from '@/components/fill-picker/GradientEditor.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import Tip from '@/components/ui/Tip.vue'
import { usePopoverUI } from '@/components/ui/popover'
import fillPickerTheme from '@/theme/fill-picker'

import type { Fill, Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue'

const fillPicker = tv(fillPickerTheme)

function tabClass(active: boolean) {
  return fillPicker({ active }).tab()
}

const {
  stroke,
  okhcl = null,
  swatchBackground
} = defineProps<{
  stroke: Stroke
  okhcl?: OkHCLControls | null
  swatchBackground?: string
}>()

const emit = defineEmits<{
  update: [stroke: Stroke]
  openChange: [open: boolean]
  cancel: []
}>()

const cls = usePopoverUI({ content: 'w-60 p-2' })
const { panels } = useI18n()

const category = computed(() => getStrokeCategory(stroke))

const previewFill = computed<Fill>(() => ({
  type: stroke.type ?? 'SOLID',
  color: stroke.color,
  opacity: stroke.opacity,
  visible: stroke.visible,
  gradientStops: stroke.gradientStops,
  gradientTransform: stroke.gradientTransform
}))

function toSolid() {
  if (category.value === 'SOLID') return
  emit('update', strokeToSolid(stroke))
}

function toGradient() {
  if (category.value === 'GRADIENT') return
  emit('update', strokeToGradient(stroke))
}

function onSolidColorUpdate(color: Color) {
  emit('update', {
    ...stroke,
    type: 'SOLID',
    color,
    opacity: color.a
  })
}

function onGradientUpdate(updated: Fill) {
  emit('update', {
    ...stroke,
    type: updated.type,
    color: updated.color,
    opacity: updated.opacity,
    visible: updated.visible,
    gradientStops: updated.gradientStops,
    gradientTransform: updated.gradientTransform
  })
}

function cancelFromEscape(event: KeyboardEvent) {
  event.stopPropagation()
  emit('cancel')
}
</script>

<template>
  <PopoverRoot @update:open="emit('openChange', $event)">
    <PopoverTrigger as-child>
      <slot v-if="$slots.trigger" name="trigger" />
      <button
        v-else
        type="button"
        :aria-label="panels.stroke"
        data-test-id="stroke-picker-swatch"
        class="size-4 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0"
      >
        <FillSwatch :fill="previewFill" class="size-full" v-slot="swatch">
          <span
            class="pointer-events-none absolute inset-0"
            :style="{ background: swatchBackground ?? swatch.background }"
          />
        </FillSwatch>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        :class="cls.content"
        :side-offset="4"
        side="left"
        data-picker-content
        @escape-key-down="cancelFromEscape"
      >
        <div class="mb-2 flex items-center gap-0.5">
          <Tip :label="panels.solid">
            <button
              :data-active="category === 'SOLID' || undefined"
              :class="tabClass(category === 'SOLID')"
              data-test-id="stroke-picker-tab-solid"
              @click="toSolid"
            >
              <icon-lucide-square class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.linearGradient">
            <button
              :data-active="category === 'GRADIENT' || undefined"
              :class="tabClass(category === 'GRADIENT')"
              data-test-id="stroke-picker-tab-gradient"
              @click="toGradient"
            >
              <icon-lucide-blend class="size-3.5" />
            </button>
          </Tip>
        </div>

        <ColorPickerPanel
          v-if="category === 'SOLID'"
          :color="stroke.color"
          :okhcl="okhcl"
          @update="onSolidColorUpdate"
        />

        <GradientEditor
          v-if="category === 'GRADIENT'"
          :fill="previewFill"
          @update="onGradientUpdate"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
