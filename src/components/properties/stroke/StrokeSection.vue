<script setup lang="ts">
import { ref } from 'vue'

import { colorToHexRaw } from '@open-pencil/core/color'
import type { Color, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import {
  BindableValueRoot,
  useColorBindingProvider,
  useI18n,
  useOkHCL,
  useStrokeControls
} from '@open-pencil/vue'
import type { BindableValueActions } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { fillLabel } from '@/components/properties/fill-label'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import {
  applyPaintMutation,
  cancelPaintMutation,
  commitPaintMutation,
  paintBindingTargets
} from '@/components/properties/paint/binding'
import { createStrokeOkhclAdapter } from '@/components/properties/paint/okhcl'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import StrokePicker from '@/components/properties/paint/StrokePicker.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import FillSwatchTrigger from '@/components/ui/paint/FillSwatchTrigger.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
const {
  visible: stylesVisible,
  hasStyle,
  value: styleValue,
  options: styleOptions,
  update: updateStyle
} = useSharedStylePicker('stroke')

import StrokeSettingsPopover from './StrokeSettingsPopover.vue'

const strokeCtx = useStrokeControls()
const { advancedActive } = strokeCtx
const colorProvider = useColorBindingProvider()
const okhcl = useOkHCL()
const { panels, common } = useI18n()
const expandedSides = ref(false)

function strokePreview(stroke: Stroke, color?: Color): Fill {
  return {
    type: stroke.type ?? 'SOLID',
    color: color ?? stroke.color,
    opacity: stroke.opacity,
    visible: stroke.visible,
    gradientStops: stroke.gradientStops,
    gradientTransform: stroke.gradientTransform
  }
}

function updatePickerStroke(
  binding: BindableValueActions<Color>,
  flush: () => void,
  nextStroke: Stroke,
  update: (stroke: Stroke) => void
) {
  applyPaintMutation(binding, flush, () => update(nextStroke))
}

function updateStrokeColor(
  binding: BindableValueActions<Color>,
  flush: () => void,
  stroke: Stroke,
  color: Color,
  update: (stroke: Stroke) => void
) {
  if (
    applyPaintMutation(binding, flush, () =>
      update({ ...stroke, type: 'SOLID', color, opacity: color.a })
    )
  )
    commitPaintMutation(binding)
}

function onToggleSides(activeNode: SceneNode | null) {
  if (!activeNode) return
  const next = !expandedSides.value
  expandedSides.value = next
  if (next && !activeNode.independentStrokeWeights) {
    const weight = activeNode.strokes[0]?.weight ?? 1
    strokeCtx.selectSide('CUSTOM', {
      ...activeNode,
      borderTopWeight: weight,
      borderRightWeight: weight,
      borderBottomWeight: weight,
      borderLeftWeight: weight
    })
  } else if (!next && activeNode.independentStrokeWeights) {
    strokeCtx.selectSide('ALL', activeNode)
  }
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, selectedNodeIds, flush, actions }"
    prop-key="strokes"
    :label="panels.stroke"
  >
    <PanelSection :label="panels.stroke" :empty="!isMixed && items.length === 0">
      <template #actions>
        <AppSelect
          v-if="stylesVisible && !hasStyle"
          :model-value="styleValue"
          :options="styleOptions"
          @update:model-value="updateStyle"
        >
          <template #trigger>
            <IconButton :label="panels.strokeStyle" data-property="stroke-style"
              ><icon-lucide-layout-grid class="size-3.5"
            /></IconButton>
          </template>
        </AppSelect>
        <IconButton :label="panels.addStroke" @click="actions.add(strokeCtx.defaultStroke)">
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <AppSelect
        v-if="stylesVisible && hasStyle"
        :model-value="styleValue"
        :options="styleOptions"
        :label="panels.strokeStyle"
        data-property="stroke-style"
        class="mb-1.5"
        @update:model-value="updateStyle"
      />

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedStrokesHelp }}</p>

      <PropertyItemRow
        v-for="(stroke, index) in items"
        :key="`${index}:${stroke.visible ? 'visible' : 'hidden'}`"
        prop-key="strokes"
        :index="index"
        :visibility-label="panels.toggleVisibility"
        :remove-label="panels.removeStroke"
      >
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(selectedNodeIds, 'strokes', index)"
          :value="stroke.color"
          batch-label="Change stroke color"
        >
          <PaintField
            :opacity="stroke.opacity"
            :opacity-label="panels.opacity"
            @update:opacity="actions.patch(index, { opacity: $event })"
          >
            <template #preview>
              <StrokePicker
                :stroke="stroke"
                :okhcl="createStrokeOkhclAdapter(okhcl, activeNode, index)"
                @update="
                  updatePickerStroke(binding.actions, flush, $event, (next) =>
                    actions.update(index, next)
                  )
                "
                @open-change="!$event && commitPaintMutation(binding.actions)"
                @cancel="cancelPaintMutation(binding.actions)"
              >
                <template #trigger>
                  <FillSwatchTrigger
                    :label="panels.stroke"
                    :fill="strokePreview(stroke, binding.resolvedValue ?? stroke.color)"
                  />
                </template>
              </StrokePicker>
            </template>

            <template #value>
              <PaintValue
                v-if="!stroke.type || stroke.type === 'SOLID'"
                :color="stroke.color"
                :resolved-color="binding.resolvedValue"
                :variable-name="binding.variable?.name ?? binding.bindingId"
                :unavailable-label="
                  binding.state === 'unresolved' ? panels.unresolvedVariable : undefined
                "
                :label="panels.stroke"
                @update="
                  updateStrokeColor(binding.actions, flush, stroke, $event, (next) =>
                    actions.update(index, next)
                  )
                "
              />
              <span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-surface">
                {{ fillLabel(strokePreview(stroke)) }}
              </span>
            </template>

            <template #binding>
              <VariableBindingPicker
                :trigger-label="panels.applyVariable"
                :search-placeholder="common.search"
                :empty-label="panels.noVariablesFound"
                :detach-label="panels.detachVariable"
                :create-label="
                  panels.createColorVariable({ value: `#${colorToHexRaw(stroke.color)}` })
                "
                :create-name-placeholder="panels.variableName"
                :create-submit-label="panels.create"
              />
            </template>
          </PaintField>
        </BindableValueRoot>
      </PropertyItemRow>

      <div v-if="!isMixed && items.length > 0" class="mt-1 flex items-center gap-1.5">
        <AppSelect
          :label="panels.strokeType"
          :ui="{ trigger: 'w-[88px] flex-none' }"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          data-property="stroke-align"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode)"
        />
        <Tip :label="panels.strokeWeight">
          <NumberField
            v-if="!expandedSides"
            class="flex-1"
            icon="W"
            :model-value="items[0]?.weight ?? 1"
            :min="0"
            data-property="stroke-weight"
            @update:model-value="actions.patch(0, { weight: $event })"
          />
        </Tip>
        <StrokeSettingsPopover
          v-if="advancedActive"
          :stroke="items[0]"
          @patch="actions.patch(0, $event)"
        />
        <IconButton
          :label="panels.strokeSides"
          size="xs"
          class="size-[26px] shrink-0"
          :active="expandedSides"
          data-property="stroke-sides"
          @click="onToggleSides(activeNode)"
        >
          <icon-lucide-layout-grid class="size-3.5" />
        </IconButton>
      </div>

      <StrokeSettingsPopover v-if="isMixed && advancedActive" />

      <div
        v-if="!isMixed && items.length > 0 && expandedSides"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <NumberField
          v-for="side in strokeCtx.borderSides"
          :key="side"
          :label="side[0].toUpperCase()"
          :model-value="strokeCtx.borderWeight(activeNode, side)"
          :min="0"
          :data-property="`stroke-${side}-weight`"
          @update:model-value="strokeCtx.updateBorderWeight(side, $event, activeNode)"
        />
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
