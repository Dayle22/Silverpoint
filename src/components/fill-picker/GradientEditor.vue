<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watchEffect } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import Tip from '@/components/ui/Tip.vue'
import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import { colorToCSS } from '@open-pencil/core/color'
import {
  GradientEditorRoot,
  GradientEditorBar,
  GradientEditorStop,
  inputValue,
  useEditor,
  useI18n
} from '@open-pencil/vue'

import type { Fill } from '@open-pencil/scene-graph'

const { fill, fillIndex = 0, property = 'fills' } = defineProps<{
  fill: Fill
  fillIndex?: number
  property?: 'fills' | 'strokes'
}>()
const emit = defineEmits<{ update: [fill: Fill] }>()
const { panels } = useI18n()
const editor = useEditor()

const activeStopIndex = ref(0)

watchEffect(() => {
  void editor.state.sceneVersion
  const ids = [...editor.state.selectedIds]
  if (ids.length === 1 && typeof fill.type === 'string' && fill.type.startsWith('GRADIENT')) {
    editor.setGradientEdit({
      nodeId: ids[0],
      fillIndex,
      property,
      activeStopIndex: activeStopIndex.value
    })
  } else {
    editor.setGradientEdit(null)
  }
})

// Switching a fill to a gradient opens this editor, so this is where the
// on-canvas gradient line becomes editable: drop back to the select tool so its
// handles can be dragged straight away without another click in the toolbar.
onMounted(() => {
  if (editor.state.activeTool !== 'SELECT') editor.setTool('SELECT')
})

onScopeDispose(() => {
  editor.setGradientEdit(null)
})
</script>

<template>
  <GradientEditorRoot
    :fill="fill"
    @update="emit('update', $event)"
    @active-stop-change="activeStopIndex = $event"
    v-slot="root"
  >
    <div>
      <div class="mb-2 w-28">
        <AppSelect
          :model-value="root.subtype"
          :options="root.subtypes"
          @update:model-value="root.actions.setSubtype($event)"
        />
      </div>

      <GradientEditorBar
        :stops="root.stops"
        :active-stop-index="root.activeStopIndex"
        :bar-background="root.barBackground"
        :ui="{ bar: 'relative mb-2 h-6 rounded' }"
        data-test-id="fill-picker-gradient-bar"
        @select-stop="root.actions.selectStop"
        @drag-stop="root.actions.dragStop"
        v-slot="bar"
      >
        <GradientEditorStop
          v-for="(stop, idx) in bar.stops"
          :key="idx"
          :stop="stop"
          :index="idx"
          :active="idx === bar.activeStopIndex"
          :dragging="idx === bar.draggingIndex"
          :removable="bar.stops.length > 2"
          class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 shadow-sm data-[selected]:border-white data-[dragging]:cursor-grabbing"
          :class="idx === bar.activeStopIndex ? 'border-white' : 'border-white/60'"
          :style="{ left: `${stop.position * 100}%`, background: colorToCSS(stop.color) }"
          @select="root.actions.selectStop"
          @update-position="root.actions.updateStopPosition"
          @remove="root.actions.removeStop"
          @pointerdown.stop="bar.actions.stopPointerDown(idx, $event)"
        />
      </GradientEditorBar>

      <div v-if="fill.type === 'GRADIENT_CURVED'" class="mb-2 flex items-center justify-between">
        <span class="text-[11px] text-muted">{{ panels.gradientBend }}</span>
        <NumberField
          class="w-16"
          suffix="%"
          :model-value="Math.round((fill.gradientSpine?.[0]?.offset ?? 0) * 100)"
          :min="-100"
          :max="100"
          @update:model-value="
            emit('update', {
              ...fill,
              gradientSpine: [{ t: 0.5, offset: Number($event) / 100 }]
            })
          "
          @click.stop
        />
      </div>

      <div class="mb-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[11px] text-muted">{{ panels.stops }}</span>
          <Tip :label="panels.addStop">
            <button
              class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
              data-test-id="fill-picker-add-stop"
              @click="root.actions.addStop"
            >
              <icon-lucide-plus class="size-3" />
            </button>
          </Tip>
        </div>
        <GradientEditorStop
          v-for="(stop, idx) in root.stops"
          :key="idx"
          :stop="stop"
          :index="idx"
          :active="idx === root.activeStopIndex"
          :removable="root.stops.length > 2"
          :interactive="false"
          class="flex items-center gap-1 py-0.5 data-[selected]:rounded data-[selected]:bg-hover/50"
          @select="root.actions.selectStop"
          @update-position="root.actions.updateStopPosition"
          @update-color="root.actions.updateStopColor"
          @update-opacity="root.actions.updateStopOpacity"
          @remove="root.actions.removeStop"
          v-slot="s"
        >
          <NumberField
            class="w-11"
            suffix="%"
            :model-value="s.positionPercent"
            :min="0"
            :max="100"
            @update:model-value="s.actions.updatePosition(Number($event))"
            @click.stop
          />
          <button
            class="size-4 shrink-0 cursor-pointer rounded border border-border p-0"
            :style="{ background: s.css }"
            @click.stop="s.actions.select"
          />
          <input
            class="min-w-0 flex-1 rounded border border-border bg-input px-1 py-0.5 font-mono text-[11px] text-surface"
            :value="s.hex"
            maxlength="6"
            @change="s.actions.updateColor(inputValue($event))"
            @click.stop
          />
          <NumberField
            class="w-9"
            suffix="%"
            :model-value="s.opacityPercent"
            :min="0"
            :max="100"
            @update:model-value="s.actions.updateOpacity(Number($event))"
            @click.stop
          />
          <button
            v-if="root.stops.length > 2"
            class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
            aria-label="Remove gradient stop"
            @click.stop="s.actions.remove"
          >
            <icon-lucide-minus class="size-3" />
          </button>
        </GradientEditorStop>
      </div>

      <ColorPickerPanel :color="root.activeColor" @update="root.actions.updateActiveColor" />
    </div>
  </GradientEditorRoot>
</template>
