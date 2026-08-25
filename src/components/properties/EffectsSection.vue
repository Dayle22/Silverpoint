<script setup lang="ts">
import { ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { MIXED, useEffectsControls, useFlatReorderDrag, useI18n } from '@open-pencil/vue'
import type { EffectControlType, PropertyListActions } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import { menu, menuContent, menuItem } from '@/components/ui/menu'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'

import type { BlurType, Effect, Fill } from '@open-pencil/scene-graph'

const effectsCtx = useEffectsControls()
const { panels } = useI18n()
const addOpen = ref(false)

const currentEffects = ref<readonly Effect[]>([])
const currentActions = ref<PropertyListActions<'effects'> | null>(null)

const { setupItem, draggingId, instruction, instructionTargetId } = useFlatReorderDrag({
  items: () => currentEffects.value.map((_, index) => ({ id: String(index) })),
  onMove: (sourceId, targetIndex) => currentActions.value?.reorder(Number(sourceId), targetIndex),
  axis: 'vertical'
})

function setupGripRef(
  el: unknown,
  index: number,
  items: readonly Effect[],
  actions: PropertyListActions<'effects'>
) {
  currentEffects.value = items
  currentActions.value = actions
  setupItem(el, () => ({ id: String(index) }))
}

function isEffectTypeDisabled(_type: EffectControlType): boolean {
  return false
}

function onPickEffectType(addFn: (item: Effect) => void, type: EffectControlType) {
  addFn(effectsCtx.createEffectOfType(type))
  addOpen.value = false
}

function effectPreview(effect: Effect): Fill {
  return {
    type: 'SOLID',
    color: effect.color,
    opacity: 1,
    visible: effect.visible
  }
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, targetNodes, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <PanelSection :label="panels.effects" :empty="!isMixed && items.length === 0">
      <template #actions>
        <PopoverRoot v-model:open="addOpen">
          <Tip :label="panels.addEffect" side="top">
            <PopoverTrigger as-child>
              <button
                type="button"
                :aria-label="panels.addEffect"
                data-slot="icon-button"
                data-test-id="effect-add-trigger"
                class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus"
              >
                <icon-lucide-plus class="size-3.5" />
              </button>
            </PopoverTrigger>
          </Tip>
          <PopoverPortal>
            <PopoverContent
              side="bottom"
              align="end"
              :side-offset="4"
              :class="menuContent()"
              data-test-id="effect-type-picker"
              @escape-key-down="addOpen = false"
            >
              <button
                v-for="option in effectsCtx.effectOptions"
                :key="option.value"
                type="button"
                :class="menuItem()"
                :data-disabled="isEffectTypeDisabled(option.value) ? '' : undefined"
                :disabled="isEffectTypeDisabled(option.value)"
                :data-test-id="`effect-type-${option.value.toLowerCase()}`"
                @click="onPickEffectType(actions.add, option.value)"
              >
                <component
                  :is="effectsCtx.effectIcon(option.value)"
                  :class="menu().icon()"
                  aria-hidden="true"
                />
                {{ option.label }}
              </button>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </template>

      <p v-if="isMixed && items.length === 0" class="text-[11px] text-muted">
        {{ panels.mixedEffectsHelp }}
      </p>

      <div
        v-for="(effect, index) in items"
        :key="`${index}:${effect.visible ? 'visible' : 'hidden'}`"
        :data-effect-index="index"
        data-effect-group
        :class="[
          draggingId === String(index) ? 'opacity-40' : '',
          instructionTargetId === String(index) && instruction?.operation === 'reorder-before'
            ? 'border-t-2 border-t-accent'
            : '',
          instructionTargetId === String(index) && instruction?.operation === 'reorder-after'
            ? 'border-b-2 border-b-accent'
            : ''
        ]"
      >
        <PropertyItemRow
          prop-key="effects"
          :index="index"
          :visibility-label="panels.toggleVisibility"
          :remove-label="panels.removeEffect"
          @remove="effectsCtx.adjustExpandedAfterRemove(index)"
        >
          <Tip
            :label="
              effectsCtx.expandedIndex.value === index
                ? panels.collapseEffectSettings
                : panels.expandEffectSettings
            "
          >
            <button
              type="button"
              :aria-expanded="effectsCtx.expandedIndex.value === index"
              :aria-label="
                effectsCtx.expandedIndex.value === index
                  ? panels.collapseEffectSettings
                  : panels.expandEffectSettings
              "
              data-property="effect-expand"
              class="flex size-control shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-icon border border-border bg-input p-0"
              @click="effectsCtx.toggleExpand(index)"
            >
              <FillSwatch
                v-if="effectsCtx.isShadow(effect.type)"
                :fill="effectPreview(effect)"
                class="size-full border-0"
              />
              <component
                v-else
                :is="effectsCtx.effectIcon(effectsCtx.effectControlType(effect))"
                class="size-3 text-muted"
              />
            </button>
          </Tip>

          <AppSelect
            class="min-w-0 flex-1"
            :model-value="effectsCtx.effectControlType(effect)"
            :options="effectsCtx.effectOptions"
            :label="panels.effects"
            data-property="effect-type"
            @update:model-value="effectsCtx.updateType(actions.patch, activeNode, index, $event)"
          />
          <template #rail>
            <Tip :label="panels.dragToReorderEffect">
              <button
                type="button"
                :ref="(el) => setupGripRef(el, index, items, actions)"
                :data-dragging="draggingId === String(index) ? '' : undefined"
                data-property="effect-drag-handle"
                :aria-label="panels.dragToReorderEffect"
                class="flex size-control shrink-0 cursor-grab items-center justify-center rounded-icon border-none bg-transparent p-0 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-hover hover:text-surface data-[dragging]:cursor-grabbing"
                @keydown.up.prevent="actions.reorder(index, index - 1)"
                @keydown.down.prevent="actions.reorder(index, index + 1)"
              >
                <icon-lucide-grip-vertical class="size-3.5" />
              </button>
            </Tip>
          </template>
        </PropertyItemRow>

        <div
          v-if="effectsCtx.expandedIndex.value === index"
          class="ml-6 flex flex-col gap-1 py-1"
          data-slot="effect-settings"
        >
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <Tip :label="panels.xAxis">
                <NumberField
                  icon="X"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.offset.x)
                      ? MIXED
                      : effect.offset.x
                  "
                  data-property="effect-offset-x"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(targetNodes, index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                />
              </Tip>
              <Tip :label="panels.yAxis">
                <NumberField
                  icon="Y"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.offset.y)
                      ? MIXED
                      : effect.offset.y
                  "
                  data-property="effect-offset-y"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(targetNodes, index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <Tip :label="panels.radius">
                <NumberField
                  icon="B"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.radius)
                      ? MIXED
                      : effect.radius
                  "
                  :min="0"
                  data-property="effect-radius"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, { radius: $event })
                  "
                  @commit="effectsCtx.commitEffect(targetNodes, index, { radius: $event })"
                />
              </Tip>
              <Tip :label="panels.spread">
                <NumberField
                  icon="S"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.spread)
                      ? MIXED
                      : effect.spread
                  "
                  data-property="effect-spread"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, { spread: $event })
                  "
                  @commit="effectsCtx.commitEffect(targetNodes, index, { spread: $event })"
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput
                class="min-w-0 flex-1"
                :color="effect.color"
                editable
                @update="effectsCtx.updateColor(actions.patch, index, $event)"
              />
              <Tip :label="panels.opacity">
                <NumberField
                  class="w-14"
                  suffix="%"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) =>
                      Math.round(e.color.a * 100)
                    )
                      ? MIXED
                      : Math.round(effect.color.a * 100)
                  "
                  :min="0"
                  :max="100"
                  data-property="effect-opacity"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(targetNodes, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                />
              </Tip>
            </div>
          </template>

          <template v-else-if="effectsCtx.isAdjustmentEffect(effect)">
            <NumberField
              v-if="effect.type === 'BRIGHTNESS_CONTRAST'"
              class="w-24 flex-none"
              suffix="%"
              :model-value="
                effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.brightness ?? 0)
                  ? MIXED
                  : (effect.brightness ?? 0)
              "
              :min="-100"
              :max="100"
              data-property="effect-brightness"
              @update:model-value="
                effectsCtx.scrubEffect(targetNodes, index, { brightness: $event })
              "
              @commit="effectsCtx.commitEffect(targetNodes, index, { brightness: $event })"
            />
            <NumberField
              v-if="effect.type === 'BRIGHTNESS_CONTRAST'"
              class="w-24 flex-none"
              suffix="%"
              :model-value="
                effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.contrast ?? 0)
                  ? MIXED
                  : (effect.contrast ?? 0)
              "
              :min="-100"
              :max="100"
              data-property="effect-contrast"
              @update:model-value="effectsCtx.scrubEffect(targetNodes, index, { contrast: $event })"
              @commit="effectsCtx.commitEffect(targetNodes, index, { contrast: $event })"
            />
            <NumberField
              v-else-if="effect.type === 'SATURATION'"
              class="w-24 flex-none"
              suffix="%"
              :model-value="
                effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.saturation ?? 100)
                  ? MIXED
                  : (effect.saturation ?? 100)
              "
              :min="0"
              :max="200"
              data-property="effect-saturation"
              @update:model-value="
                effectsCtx.scrubEffect(targetNodes, index, { saturation: $event })
              "
              @commit="effectsCtx.commitEffect(targetNodes, index, { saturation: $event })"
            />
            <NumberField
              v-else
              class="w-24 flex-none"
              :model-value="
                effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.gamma ?? 1)
                  ? MIXED
                  : (effect.gamma ?? 1)
              "
              :min="0.1"
              :max="3"
              :step="0.1"
              data-property="effect-gamma"
              @update:model-value="effectsCtx.scrubEffect(targetNodes, index, { gamma: $event })"
              @commit="effectsCtx.commitEffect(targetNodes, index, { gamma: $event })"
            />
          </template>
          <template v-else-if="effect.type === 'NOISE'">
            <div class="flex items-center gap-1.5">
              <Tip :label="panels.radius">
                <NumberField
                  class="w-24 flex-none"
                  icon="B"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.radius)
                      ? MIXED
                      : effect.radius
                  "
                  :min="0"
                  data-property="effect-radius"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, { radius: $event })
                  "
                  @commit="effectsCtx.commitEffect(targetNodes, index, { radius: $event })"
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput
                class="min-w-0 flex-1"
                :color="effect.color"
                editable
                @update="effectsCtx.updateColor(actions.patch, index, $event)"
              />
              <Tip :label="panels.opacity">
                <NumberField
                  class="w-14"
                  suffix="%"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) =>
                      Math.round(e.color.a * 100)
                    )
                      ? MIXED
                      : Math.round(effect.color.a * 100)
                  "
                  :min="0"
                  :max="100"
                  data-property="effect-opacity"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(targetNodes, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                />
              </Tip>
            </div>
          </template>
          <template v-else>
            <SegmentedControl
              v-if="effectsCtx.supportsProgressiveBlur(effect)"
              :model-value="effectsCtx.blurTypeOf(effect)"
              :options="effectsCtx.blurTypeOptions"
              :label="panels.blurType"
              data-property="effect-blur-type"
              @change="
                effectsCtx.updateBlurType(actions.patch, activeNode, index, $event as BlurType)
              "
            />

            <div v-if="effectsCtx.isProgressiveBlur(effect)" class="flex items-center gap-1.5">
              <Tip :label="panels.blurStart">
                <NumberField
                  class="w-24"
                  :label="panels.blurStart"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.startRadius ?? 0)
                      ? MIXED
                      : (effect.startRadius ?? 0)
                  "
                  :min="0"
                  data-property="effect-blur-start-radius"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, { startRadius: $event })
                  "
                  @commit="effectsCtx.commitEffect(targetNodes, index, { startRadius: $event })"
                />
              </Tip>
              <Tip :label="panels.blurEnd">
                <NumberField
                  class="w-24"
                  :label="panels.blurEnd"
                  :model-value="
                    effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.radius)
                      ? MIXED
                      : effect.radius
                  "
                  :min="0"
                  data-property="effect-radius"
                  @update:model-value="
                    effectsCtx.scrubEffect(targetNodes, index, { radius: $event })
                  "
                  @commit="effectsCtx.commitEffect(targetNodes, index, { radius: $event })"
                />
              </Tip>
            </div>

            <NumberField
              v-else
              class="w-24 flex-none"
              icon="B"
              :model-value="
                effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.radius)
                  ? MIXED
                  : effect.radius
              "
              :min="0"
              data-property="effect-radius"
              @update:model-value="effectsCtx.scrubEffect(targetNodes, index, { radius: $event })"
              @commit="effectsCtx.commitEffect(targetNodes, index, { radius: $event })"
            />
          </template>
        </div>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
