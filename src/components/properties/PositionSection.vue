<script setup lang="ts">
import { computed } from 'vue'

import {
  DEFAULT_DOCUMENT_UNITS,
  formatUnitValue,
  resolveUnitCommitPx
} from '@open-pencil/core/editor'
import { PositionControlsRoot, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

const { panels } = useI18n()
const store = useEditorStore()
const units = computed(() => store.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS)
const minSize = computed(() => Math.max(0.001, Number(formatUnitValue(1, units.value))))

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

function handleAlign(
  nodeAlign: (axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') => void,
  axis: 'horizontal' | 'vertical',
  pos: 'min' | 'center' | 'max'
) {
  const editState = store.state.nodeEditState
  if (editState && editState.selectedVertexIndices.size >= 2) {
    store.nodeEditAlignVertices(axis, pos)
  } else {
    nodeAlign(axis, pos)
  }
}
</script>

<template>
  <PositionControlsRoot
    v-slot="{ active, isMulti, xValue, yValue, wValue, hValue, rotationValue, actions }"
  >
    <PanelSection v-if="active" :label="panels.position">
      <div role="toolbar" :aria-label="panels.position" class="mb-panel flex w-fit gap-0.5">
        <IconButton
          :label="panels.alignLeft"
          size="md"
          @click="handleAlign(actions.align, 'horizontal', 'min')"
        >
          <icon-lucide-align-start-vertical class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.alignCenterHorizontally"
          size="md"
          @click="handleAlign(actions.align, 'horizontal', 'center')"
        >
          <icon-lucide-align-center-vertical class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.alignRight"
          size="md"
          @click="handleAlign(actions.align, 'horizontal', 'max')"
        >
          <icon-lucide-align-end-vertical class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.alignTop"
          size="md"
          @click="handleAlign(actions.align, 'vertical', 'min')"
        >
          <icon-lucide-align-start-horizontal class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.alignCenterVertically"
          size="md"
          @click="handleAlign(actions.align, 'vertical', 'center')"
        >
          <icon-lucide-align-center-horizontal class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.alignBottom"
          size="md"
          @click="handleAlign(actions.align, 'vertical', 'max')"
        >
          <icon-lucide-align-end-horizontal class="size-3.5" />
        </IconButton>
      </div>

      <PanelGrid columns="two">
        <Tip :label="panels.xAxis">
          <NumberField
            icon="X"
            data-property="x"
            :suffix="units.unit"
            :aria-label="panels.xAxis"
            :model-value="toDisplay(xValue)"
            @update:model-value="handleUpdate('x', xValue, $event, actions.updateProp)"
            @commit="(v: number) => handleCommit('x', xValue, v, actions.commitProp)"
          />
        </Tip>
        <Tip :label="panels.yAxis">
          <NumberField
            icon="Y"
            data-property="y"
            :suffix="units.unit"
            :aria-label="panels.yAxis"
            :model-value="toDisplay(yValue)"
            @update:model-value="handleUpdate('y', yValue, $event, actions.updateProp)"
            @commit="(v: number) => handleCommit('y', yValue, v, actions.commitProp)"
          />
        </Tip>
      </PanelGrid>

      <PanelGrid v-if="isMulti" columns="two" class="mt-panel">
        <Tip :label="panels.width">
          <NumberField
            icon="W"
            data-property="width"
            :suffix="units.unit"
            :aria-label="panels.width"
            :model-value="toDisplay(wValue)"
            :min="minSize"
            @update:model-value="handleUpdate('width', wValue, $event, actions.updateProp)"
            @commit="(v: number) => handleCommit('width', wValue, v, actions.commitProp)"
          />
        </Tip>
        <Tip :label="panels.height">
          <NumberField
            icon="H"
            data-property="height"
            :suffix="units.unit"
            :aria-label="panels.height"
            :model-value="toDisplay(hValue)"
            :min="minSize"
            @update:model-value="handleUpdate('height', hValue, $event, actions.updateProp)"
            @commit="(v: number) => handleCommit('height', hValue, v, actions.commitProp)"
          />
        </Tip>
      </PanelGrid>

      <div class="mt-panel grid grid-cols-[minmax(0,1fr)_repeat(3,var(--spacing-control))] gap-0.5">
        <Tip :label="panels.rotation">
          <NumberField
            suffix="°"
            data-property="rotation"
            :aria-label="panels.rotation"
            :model-value="rotationValue"
            :min="-360"
            :max="360"
            @update:model-value="actions.updateProp('rotation', $event)"
            @commit="(v: number, p: number) => actions.commitProp('rotation', v, p)"
          >
            <template #icon>
              <icon-lucide-rotate-cw class="size-3" />
            </template>
          </NumberField>
        </Tip>
        <IconButton :label="panels.flipHorizontal" size="md" @click="actions.flip('horizontal')">
          <icon-lucide-flip-horizontal-2 class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.flipVertical" size="md" @click="actions.flip('vertical')">
          <icon-lucide-flip-vertical-2 class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.rotate90" size="md" @click="actions.rotate(90)">
          <icon-lucide-rotate-cw-square class="size-3.5" />
        </IconButton>
      </div>
    </PanelSection>
  </PositionControlsRoot>
</template>
