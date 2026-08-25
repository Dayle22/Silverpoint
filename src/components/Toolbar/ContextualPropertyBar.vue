<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import {
  BindableValueRoot,
  useAppearance,
  useColorBindingProvider,
  useEditorPropertyList,
  useFillControls,
  useI18n,
  useOkHCL,
  usePosition,
  useStrokeControls,
  useTypography
} from '@open-pencil/vue'
import {
  DEFAULT_DOCUMENT_UNITS,
  formatUnitValue,
  resolveUnitCommitPx
} from '@open-pencil/core/editor'
import { colorToHex } from '@open-pencil/core/color'
import type { Fill, Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { BindableValueActions } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { loadFont } from '@/app/editor/fonts'
import { recordRecentColour } from '@/app/swatches'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import FillPicker from '@/components/fill-picker/FillPicker.vue'
import StrokePicker from '@/components/properties/paint/StrokePicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'
import { usePopoverUI } from '@/components/ui/popover'
import {
  applyPaintMutation,
  cancelPaintMutation,
  commitPaintMutation,
  paintBindingTargets
} from '@/components/properties/paint/binding'
import {
  createFillOkhclAdapter,
  createStrokeOkhclAdapter
} from '@/components/properties/paint/okhcl'

const fontLoader = { load: loadFont }

const fillsCtx = useEditorPropertyList('fills')
const strokesCtx = useEditorPropertyList('strokes')
const fillControls = useFillControls()
const strokeControls = useStrokeControls()
const appearanceCtx = useAppearance()
const typographyCtx = useTypography({ fontLoader })
const positionCtx = usePosition()
const colorProvider = useColorBindingProvider()
const okhcl = useOkHCL()
const store = useEditorStore()
const { panels } = useI18n()
const popoverCls = usePopoverUI({ content: 'p-1.5' })

const selectedNodeIds = computed(() => fillsCtx.selectedNodeIds.value)
const isVisible = computed(() => selectedNodeIds.value.length > 0)
const isText = computed(
  () => selectedNodeIds.value.length === 1 && fillsCtx.activeNode.value?.type === 'TEXT'
)
const isImage = computed(
  () =>
    !isText.value &&
    fillsCtx.items.value.length === 1 &&
    fillsCtx.items.value[0]?.type === 'IMAGE'
)

const units = computed(() => store.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS)
const minSize = computed(() => Math.max(0.001, Number(formatUnitValue(1, units.value))))

const alignmentOptions = computed(() => [
  { value: 'LEFT', label: panels.value.alignLeft },
  { value: 'CENTER', label: panels.value.alignCenterHorizontally },
  { value: 'RIGHT', label: panels.value.alignRight }
])

function displayFill(fill: Fill, resolvedColor: Color | undefined): Fill {
  return fill.type === 'SOLID' && resolvedColor ? { ...fill, color: resolvedColor } : fill
}

function displayStroke(stroke: Stroke, resolvedColor: Color | undefined): Stroke {
  return (stroke.type === undefined || stroke.type === 'SOLID') && resolvedColor
    ? { ...stroke, color: resolvedColor }
    : stroke
}

function updatePickerFill(
  binding: BindableValueActions<Color>,
  flush: () => void,
  nextFill: Fill,
  update: (fill: Fill) => void
) {
  applyPaintMutation(binding, flush, () => update(nextFill))
}

function handleFillPickerCommit(committedFill: Fill) {
  if (committedFill.type === 'SOLID' && committedFill.color) {
    recordRecentColour(colorToHex(committedFill.color))
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

function toDisplay(val: number | symbol): number | symbol {
  if (typeof val !== 'number') return val
  return Number(formatUnitValue(val, units.value))
}

function handleUpdate(
  key: string,
  currentVal: number | symbol,
  typedUnitVal: number,
  updateFn: (key: string, value: number) => void
) {
  const currentPx = typeof currentVal === 'number' ? currentVal : 0
  const targetPx = resolveUnitCommitPx(typedUnitVal, currentPx, units.value)
  updateFn(key, targetPx)
}

function handleCommit(
  key: string,
  currentVal: number | symbol,
  typedUnitVal: number,
  commitFn: (key: string, value: number, previous: number) => void
) {
  const currentPx = typeof currentVal === 'number' ? currentVal : 0
  const targetPx = resolveUnitCommitPx(typedUnitVal, currentPx, units.value)
  commitFn(key, targetPx, currentPx)
}
</script>

<template>
  <div
    v-if="isVisible"
    data-test-id="contextual-property-bar"
    class="flex items-center gap-1 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md max-w-[calc(100vw-32px)] overflow-x-auto scrollbar-thin select-none"
  >
    <!-- Text Contextual Controls -->
    <template v-if="isText">
      <!-- Font Family -->
      <div class="w-32 min-w-0 flex-none" data-test-id="contextual-font-picker">
        <FontPicker
          :model-value="typographyCtx.node.value?.fontFamily ?? ''"
          :label="panels.fontFamily"
          @select="typographyCtx.setFamily"
        />
      </div>

      <!-- Font Size -->
      <Tip :label="panels.fontSize">
        <NumberField
          class="w-16"
          data-property="fontSize"
          :aria-label="panels.fontSize"
          :model-value="typographyCtx.fontSize.value"
          :min="1"
          @update:model-value="typographyCtx.updateProp('fontSize', $event)"
          @commit="(v: number, p: number) => typographyCtx.commitProp('fontSize', v, p)"
        >
          <template #icon>
            <icon-lucide-type class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>

      <!-- Font Weight -->
      <div class="w-24" data-test-id="contextual-font-weight">
        <AppSelect
          :label="panels.fontWeight"
          :model-value="typographyCtx.fontWeight.value"
          :options="typographyCtx.weights"
          @change="typographyCtx.setWeight(Number($event))"
        />
      </div>

      <div class="mx-1 h-4 w-px bg-border shrink-0" role="separator" />

      <!-- Text Colour (Fill) -->
      <div
        v-if="fillsCtx.active.value && fillsCtx.items.value.length > 0"
        data-test-id="contextual-text-color"
      >
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(fillsCtx.selectedNodeIds.value, 'fills', 0)"
          :value="fillsCtx.items.value[0]?.color"
          batch-label="Change fill color"
        >
          <FillPicker
            :fill="displayFill(fillsCtx.items.value[0], binding.resolvedValue)"
            :fill-index="0"
            :okhcl="createFillOkhclAdapter(okhcl, fillsCtx.activeNode.value, 0)"
            @update="
              updatePickerFill(binding.actions, fillsCtx.flush, $event, (next) =>
                fillsCtx.actions.update(0, next)
              )
            "
            @open-change="!$event && commitPaintMutation(binding.actions)"
            @cancel="cancelPaintMutation(binding.actions)"
            @commit="handleFillPickerCommit"
          />
        </BindableValueRoot>
      </div>
      <IconButton
        v-else-if="fillsCtx.active.value"
        :label="panels.addFill"
        size="md"
        class="size-(--spacing-control)"
        @click="fillsCtx.actions.add({ ...fillControls.defaultFill })"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>

      <div class="mx-1 h-4 w-px bg-border shrink-0" role="separator" />

      <!-- Text Alignment -->
      <div data-test-id="contextual-alignment">
        <SegmentedControl
          :model-value="typographyCtx.node.value?.textAlignHorizontal ?? 'LEFT'"
          :options="alignmentOptions"
          :label="panels.textAlignment"
          size="sm"
          @change="typographyCtx.setAlign($event as 'LEFT' | 'CENTER' | 'RIGHT')"
        >
          <template #option="{ option }">
            <icon-lucide-align-left v-if="option.value === 'LEFT'" class="size-3.5" />
            <icon-lucide-align-center v-else-if="option.value === 'CENTER'" class="size-3.5" />
            <icon-lucide-align-right v-else class="size-3.5" />
          </template>
        </SegmentedControl>
      </div>

      <div class="mx-1 h-4 w-px bg-border shrink-0" role="separator" />

      <!-- Opacity -->
      <Tip :label="panels.opacity">
        <NumberField
          class="w-16"
          suffix="%"
          data-property="opacity"
          :aria-label="panels.opacity"
          :model-value="appearanceCtx.opacityPercent.value"
          :min="0"
          :max="100"
          @update:model-value="appearanceCtx.updateProp('opacity', $event / 100)"
          @commit="(v: number, p: number) => appearanceCtx.commitProp('opacity', v / 100, p / 100)"
        >
          <template #icon>
            <icon-lucide-blend class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>
    </template>

    <!-- Image Contextual Controls -->
    <template v-else-if="isImage">
      <!-- Opacity -->
      <Tip :label="panels.opacity">
        <NumberField
          class="w-16"
          suffix="%"
          data-property="opacity"
          :aria-label="panels.opacity"
          :model-value="appearanceCtx.opacityPercent.value"
          :min="0"
          :max="100"
          @update:model-value="appearanceCtx.updateProp('opacity', $event / 100)"
          @commit="(v: number, p: number) => appearanceCtx.commitProp('opacity', v / 100, p / 100)"
        >
          <template #icon>
            <icon-lucide-blend class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>

      <!-- Corner radius -->
      <Tip v-if="appearanceCtx.hasCornerRadius.value" :label="panels.radius">
        <NumberField
          class="w-16"
          data-property="cornerRadius"
          :aria-label="panels.radius"
          :model-value="appearanceCtx.cornerRadiusValue.value"
          :min="0"
          @update:model-value="appearanceCtx.updateProp('cornerRadius', $event)"
          @commit="(v: number, p: number) => appearanceCtx.commitProp('cornerRadius', v, p)"
        >
          <template #icon>
            <icon-lucide-square-round-corner class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>

      <!-- Position -->
      <template v-if="positionCtx.active.value">
        <div class="mx-1 h-4 w-px bg-border shrink-0" role="separator" />

        <PopoverRoot>
          <PopoverTrigger as-child>
            <IconButton
              :label="panels.position"
              size="md"
              class="size-(--spacing-control)"
              data-test-id="contextual-position-trigger"
            >
              <icon-lucide-move class="size-3.5" />
            </IconButton>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              :class="popoverCls.content"
              :side-offset="8"
              side="top"
              data-test-id="contextual-position-popover"
            >
              <div class="grid grid-cols-2 gap-1.5 p-1 w-44">
                <Tip :label="panels.xAxis">
                  <NumberField
                    icon="X"
                    data-property="x"
                    :suffix="units.unit"
                    :aria-label="panels.xAxis"
                    :model-value="toDisplay(positionCtx.x.value)"
                    @update:model-value="
                      handleUpdate('x', positionCtx.x.value, $event, positionCtx.updateProp)
                    "
                    @commit="(v: number) => handleCommit('x', positionCtx.x.value, v, positionCtx.commitProp)"
                  />
                </Tip>
                <Tip :label="panels.yAxis">
                  <NumberField
                    icon="Y"
                    data-property="y"
                    :suffix="units.unit"
                    :aria-label="panels.yAxis"
                    :model-value="toDisplay(positionCtx.y.value)"
                    @update:model-value="
                      handleUpdate('y', positionCtx.y.value, $event, positionCtx.updateProp)
                    "
                    @commit="(v: number) => handleCommit('y', positionCtx.y.value, v, positionCtx.commitProp)"
                  />
                </Tip>
                <Tip :label="panels.width">
                  <NumberField
                    icon="W"
                    data-property="width"
                    :suffix="units.unit"
                    :aria-label="panels.width"
                    :model-value="toDisplay(positionCtx.width.value)"
                    :min="minSize"
                    @update:model-value="
                      handleUpdate('width', positionCtx.width.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) => handleCommit('width', positionCtx.width.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
                <Tip :label="panels.height">
                  <NumberField
                    icon="H"
                    data-property="height"
                    :suffix="units.unit"
                    :aria-label="panels.height"
                    :model-value="toDisplay(positionCtx.height.value)"
                    :min="minSize"
                    @update:model-value="
                      handleUpdate('height', positionCtx.height.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) => handleCommit('height', positionCtx.height.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </template>
    </template>

    <!-- Shape / Frame / Multi-select Controls -->
    <template v-else>
      <!-- Fill swatch -->
      <div v-if="fillsCtx.active.value && fillsCtx.items.value.length > 0" data-test-id="contextual-fill-picker">
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(fillsCtx.selectedNodeIds.value, 'fills', 0)"
          :value="fillsCtx.items.value[0]?.color"
          batch-label="Change fill color"
        >
          <FillPicker
            :fill="displayFill(fillsCtx.items.value[0], binding.resolvedValue)"
            :fill-index="0"
            :okhcl="createFillOkhclAdapter(okhcl, fillsCtx.activeNode.value, 0)"
            @update="
              updatePickerFill(binding.actions, fillsCtx.flush, $event, (next) =>
                fillsCtx.actions.update(0, next)
              )
            "
            @open-change="!$event && commitPaintMutation(binding.actions)"
            @cancel="cancelPaintMutation(binding.actions)"
            @commit="handleFillPickerCommit"
          />
        </BindableValueRoot>
      </div>
      <IconButton
        v-else-if="fillsCtx.active.value"
        :label="panels.addFill"
        size="md"
        class="size-(--spacing-control)"
        data-test-id="contextual-add-fill"
        @click="fillsCtx.actions.add({ ...fillControls.defaultFill })"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>

      <!-- Stroke swatch -->
      <div v-if="strokesCtx.active.value && strokesCtx.items.value.length > 0" data-test-id="contextual-stroke-picker">
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(strokesCtx.selectedNodeIds.value, 'strokes', 0)"
          :value="strokesCtx.items.value[0]?.color"
          batch-label="Change stroke color"
        >
          <StrokePicker
            :stroke="displayStroke(strokesCtx.items.value[0], binding.resolvedValue)"
            :stroke-index="0"
            :okhcl="createStrokeOkhclAdapter(okhcl, strokesCtx.activeNode.value, 0)"
            @update="
              updatePickerStroke(binding.actions, strokesCtx.flush, $event, (next) =>
                strokesCtx.actions.update(0, next)
              )
            "
            @open-change="!$event && commitPaintMutation(binding.actions)"
            @cancel="cancelPaintMutation(binding.actions)"
          />
        </BindableValueRoot>
      </div>
      <IconButton
        v-else-if="strokesCtx.active.value"
        :label="panels.addStroke"
        size="md"
        class="size-(--spacing-control)"
        data-test-id="contextual-add-stroke"
        @click="strokesCtx.actions.add({ ...strokeControls.defaultStroke })"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>

      <div
        v-if="(fillsCtx.active.value || strokesCtx.active.value) && (appearanceCtx.hasCornerRadius.value || appearanceCtx.active.value)"
        class="mx-1 h-4 w-px bg-border shrink-0"
        role="separator"
      />

      <!-- Corner radius -->
      <Tip v-if="appearanceCtx.hasCornerRadius.value" :label="panels.radius">
        <NumberField
          class="w-16"
          data-property="cornerRadius"
          :aria-label="panels.radius"
          :model-value="appearanceCtx.cornerRadiusValue.value"
          :min="0"
          @update:model-value="appearanceCtx.updateProp('cornerRadius', $event)"
          @commit="(v: number, p: number) => appearanceCtx.commitProp('cornerRadius', v, p)"
        >
          <template #icon>
            <icon-lucide-square-round-corner class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>

      <!-- Opacity -->
      <Tip :label="panels.opacity">
        <NumberField
          class="w-16"
          suffix="%"
          data-property="opacity"
          :aria-label="panels.opacity"
          :model-value="appearanceCtx.opacityPercent.value"
          :min="0"
          :max="100"
          @update:model-value="appearanceCtx.updateProp('opacity', $event / 100)"
          @commit="(v: number, p: number) => appearanceCtx.commitProp('opacity', v / 100, p / 100)"
        >
          <template #icon>
            <icon-lucide-blend class="size-3 text-muted" />
          </template>
        </NumberField>
      </Tip>

      <!-- Position -->
      <template v-if="positionCtx.active.value">
        <div class="mx-1 h-4 w-px bg-border shrink-0" role="separator" />

        <PopoverRoot>
          <PopoverTrigger as-child>
            <IconButton
              :label="panels.position"
              size="md"
              class="size-(--spacing-control)"
              data-test-id="contextual-position-trigger"
            >
              <icon-lucide-move class="size-3.5" />
            </IconButton>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              :class="popoverCls.content"
              :side-offset="8"
              side="top"
              data-test-id="contextual-position-popover"
            >
              <div class="grid grid-cols-2 gap-1.5 p-1 w-44">
                <Tip :label="panels.xAxis">
                  <NumberField
                    icon="X"
                    data-property="x"
                    :suffix="units.unit"
                    :aria-label="panels.xAxis"
                    :model-value="toDisplay(positionCtx.x.value)"
                    @update:model-value="
                      handleUpdate('x', positionCtx.x.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) => handleCommit('x', positionCtx.x.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
                <Tip :label="panels.yAxis">
                  <NumberField
                    icon="Y"
                    data-property="y"
                    :suffix="units.unit"
                    :aria-label="panels.yAxis"
                    :model-value="toDisplay(positionCtx.y.value)"
                    @update:model-value="
                      handleUpdate('y', positionCtx.y.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) => handleCommit('y', positionCtx.y.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
                <Tip :label="panels.width">
                  <NumberField
                    icon="W"
                    data-property="width"
                    :suffix="units.unit"
                    :aria-label="panels.width"
                    :model-value="toDisplay(positionCtx.width.value)"
                    :min="minSize"
                    @update:model-value="
                      handleUpdate('width', positionCtx.width.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) =>
                        handleCommit('width', positionCtx.width.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
                <Tip :label="panels.height">
                  <NumberField
                    icon="H"
                    data-property="height"
                    :suffix="units.unit"
                    :aria-label="panels.height"
                    :model-value="toDisplay(positionCtx.height.value)"
                    :min="minSize"
                    @update:model-value="
                      handleUpdate('height', positionCtx.height.value, $event, positionCtx.updateProp)
                    "
                    @commit="
                      (v: number) =>
                        handleCommit('height', positionCtx.height.value, v, positionCtx.commitProp)
                    "
                  />
                </Tip>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </template>
    </template>
  </div>
</template>
