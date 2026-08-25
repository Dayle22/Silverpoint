<script setup lang="ts">
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { applySolidStrokeColor, useI18n, useStrokeCategory } from '@open-pencil/vue'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import GradientEditor from '@/components/fill-picker/GradientEditor.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import Tip from '@/components/ui/Tip.vue'
import { usePopoverUI } from '@/components/ui/popover'

import type { Fill, Stroke } from '@open-pencil/scene-graph'
import type { OkHCLControls } from '@open-pencil/vue'

const TAB_BASE =
  'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors'

function tabClass(active: boolean) {
  return twMerge(
    TAB_BASE,
    active ? 'bg-hover text-surface' : 'text-muted hover:bg-hover hover:text-surface'
  )
}

function strokeToFillLike(stroke: Stroke): Fill {
  return {
    type: stroke.type ?? 'SOLID',
    color: stroke.color,
    opacity: stroke.opacity,
    visible: stroke.visible,
    gradientStops: stroke.gradientStops,
    gradientTransform: stroke.gradientTransform
  }
}

function applyFillLikeToStroke(stroke: Stroke, fillLike: Fill): Stroke {
  return {
    ...stroke,
    type: fillLike.type,
    color: fillLike.color,
    opacity: fillLike.opacity,
    gradientStops: fillLike.gradientStops,
    gradientTransform: fillLike.gradientTransform
  }
}

const {
  stroke,
  strokeIndex = 0,
  okhcl = null
} = defineProps<{
  stroke: Stroke
  strokeIndex?: number
  okhcl?: OkHCLControls | null
}>()
const emit = defineEmits<{
  update: [stroke: Stroke]
  openChange: [open: boolean]
  cancel: []
  commit: [stroke: Stroke]
}>()
const cls = usePopoverUI({ content: 'w-60 p-2' })
const { panels } = useI18n()

const { category, actions: categoryActions } = useStrokeCategory(
  computed(() => stroke),
  (patch) => emit('update', { ...stroke, ...patch })
)

let isCancelled = false

function handleOpenChange(open: boolean) {
  if (open) {
    isCancelled = false
  }
  emit('openChange', open)
  if (!open && !isCancelled) {
    emit('commit', stroke)
  }
}

function cancelFromEscape(event: KeyboardEvent) {
  isCancelled = true
  event.stopPropagation()
  emit('cancel')
}
</script>

<template>
  <PopoverRoot @update:open="handleOpenChange">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-label="panels.stroke"
        data-test-id="stroke-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      >
        <FillSwatch :fill="strokeToFillLike(stroke)" class="size-full" />
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
              :class="tabClass(category === 'SOLID')"
              data-test-id="stroke-picker-tab-solid"
              @click="categoryActions.toSolid"
            >
              <icon-lucide-square class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.linearGradient">
            <button
              :class="tabClass(category === 'GRADIENT')"
              data-test-id="stroke-picker-tab-gradient"
              @click="categoryActions.toGradient"
            >
              <icon-lucide-blend class="size-3.5" />
            </button>
          </Tip>
        </div>

        <ColorPickerPanel
          v-if="category === 'SOLID'"
          :color="stroke.color"
          :okhcl="okhcl"
          @update="emit('update', { ...stroke, ...applySolidStrokeColor($event) })"
        />

        <GradientEditor
          v-if="category === 'GRADIENT'"
          :fill="strokeToFillLike(stroke)"
          :fill-index="strokeIndex"
          property="strokes"
          @update="emit('update', applyFillLikeToStroke(stroke, $event))"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
