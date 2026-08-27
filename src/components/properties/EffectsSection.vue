<script setup lang="ts">
import { ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useEffectsControls, useI18n } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import {
  commitDiscretePropertyListChange,
  useBlendModeOptions
} from '@/components/properties/blend-mode/use'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { menuContent, menuItem } from '@/components/ui/menu'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

import type { Effect, EffectTextureType, Fill } from '@open-pencil/scene-graph'

const effectsCtx = useEffectsControls()
const { panels } = useI18n()
const blendModeOptions = useBlendModeOptions()

const addOpen = ref(false)

const textureOptions = [
  { value: 'GRAIN', label: 'Grain' },
  { value: 'CANVAS', label: 'Canvas' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'CROSSHATCH', label: 'Crosshatch' }
]

function effectPreview(effect: Effect): Fill {
  return {
    type: 'SOLID',
    color: effect.color,
    opacity: 1,
    visible: effect.visible
  }
}

function onPickEffectType(actions: { add: (effect: Effect) => void }, type: Effect['type']) {
  actions.add(effectsCtx.createEffectOfType(type))
  addOpen.value = false
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, flush, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <PanelSection :label="panels.effects" :empty="!isMixed && items.length === 0">
      <template #actions>
        <PopoverRoot v-model:open="addOpen">
          <PopoverTrigger as-child>
            <IconButton
              :label="panels.addEffect"
              data-test-id="effect-add-trigger"
            >
              <icon-lucide-plus class="size-3.5" />
            </IconButton>
          </PopoverTrigger>
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
                :data-test-id="`effect-type-${option.value.toLowerCase()}`"
                @click="onPickEffectType(actions, option.value)"
              >
                {{ option.label }}
              </button>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </template>

      <SharedStyleField kind="effect" :label="panels.effectStyle" />

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedEffectsHelp }}</p>

      <div
        v-for="(effect, index) in items"
        :key="`${index}:${effect.visible ? 'visible' : 'hidden'}`"
        :data-effect-index="index"
        data-effect-group
      >
        <PropertyItemRow
          prop-key="effects"
          :index="index"
          :visibility-label="panels.toggleVisibility"
          :remove-label="panels.removeEffect"
          class="items-start"
          @remove="effectsCtx.adjustExpandedAfterRemove(index)"
        >
          <template #rail>
            <Tip :label="panels.dragToReorderEffect">
              <button
                type="button"
                data-property="effect-drag-handle"
                :aria-label="panels.dragToReorderEffect"
                class="flex size-control shrink-0 cursor-grab items-center justify-center rounded-icon border-none bg-transparent p-0 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-hover hover:text-surface"
                @keydown.up.prevent="actions.reorder(index, index - 1)"
                @keydown.down.prevent="actions.reorder(index, index + 1)"
              >
                <icon-lucide-grip-vertical class="size-3.5" />
              </button>
            </Tip>
          </template>

          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex min-w-0 items-center gap-1.5">
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
                  class="flex size-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border bg-input p-0"
                  @click="effectsCtx.toggleExpand(index)"
                >
                  <FillSwatch
                    v-if="effectsCtx.isShadow(effect.type)"
                    :fill="effectPreview(effect)"
                    class="size-full border-0"
                  />
                  <icon-lucide-blend v-else class="size-3 text-muted" />
                </button>
              </Tip>

              <AppSelect
                class="min-w-0 flex-1"
                :model-value="effect.type"
                :options="effectsCtx.effectOptions"
                :label="panels.effects"
                data-property="effect-type"
                @update:model-value="
                  effectsCtx.updateType(actions.patch, activeNode, index, $event as Effect['type'])
                "
              />
            </div>

            <div
              v-if="effectsCtx.expandedIndex.value === index"
              class="flex flex-col gap-1.5 py-1.5"
              data-slot="effect-settings"
            >
              <PanelFieldGroup :label="panels.blendMode">
                <AppSelect
                  :model-value="effect.blendMode ?? 'NORMAL'"
                  :options="blendModeOptions"
                  :label="panels.blendMode"
                  data-property="effect-blend-mode"
                  @update:model-value="
                    commitDiscretePropertyListChange(flush, () =>
                      actions.patch(index, { blendMode: $event as Effect['blendMode'] })
                    )
                  "
                />
              </PanelFieldGroup>

              <!-- Shadows (Drop Shadow / Inner Shadow) -->
              <template v-if="effectsCtx.isShadow(effect.type)">
                <div class="flex items-center gap-1.5">
                  <Tip :label="panels.xAxis">
                    <NumberField
                      icon="X"
                      :model-value="effect.offset.x"
                      data-property="effect-offset-x"
                      @update:model-value="
                        effectsCtx.scrubEffect(activeNode, index, {
                          offset: { ...effect.offset, x: $event }
                        })
                      "
                      @commit="
                        effectsCtx.commitEffect(activeNode, index, {
                          offset: { ...effect.offset, x: $event }
                        })
                      "
                    />
                  </Tip>
                  <Tip :label="panels.yAxis">
                    <NumberField
                      icon="Y"
                      :model-value="effect.offset.y"
                      data-property="effect-offset-y"
                      @update:model-value="
                        effectsCtx.scrubEffect(activeNode, index, {
                          offset: { ...effect.offset, y: $event }
                        })
                      "
                      @commit="
                        effectsCtx.commitEffect(activeNode, index, {
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
                      :model-value="effect.radius"
                      :min="0"
                      data-property="effect-radius"
                      @update:model-value="
                        effectsCtx.scrubEffect(activeNode, index, { radius: $event })
                      "
                      @commit="effectsCtx.commitEffect(activeNode, index, { radius: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.spread">
                    <NumberField
                      icon="S"
                      :model-value="effect.spread"
                      data-property="effect-spread"
                      @update:model-value="
                        effectsCtx.scrubEffect(activeNode, index, { spread: $event })
                      "
                      @commit="effectsCtx.commitEffect(activeNode, index, { spread: $event })"
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
                      :model-value="Math.round(effect.color.a * 100)"
                      :min="0"
                      :max="100"
                      data-property="effect-opacity"
                      @update:model-value="
                        effectsCtx.scrubEffect(activeNode, index, {
                          color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                        })
                      "
                      @commit="
                        effectsCtx.commitEffect(activeNode, index, {
                          color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                        })
                      "
                    />
                  </Tip>
                </div>
              </template>

              <!-- Brightness / Contrast -->
              <template v-else-if="effect.type === 'BRIGHTNESS_CONTRAST'">
                <div class="flex items-center gap-1.5">
                  <Tip :label="panels.brightness">
                    <NumberField
                      class="w-24 flex-1"
                      icon="B"
                      :model-value="effect.brightness ?? 0"
                      :min="-100"
                      :max="100"
                      data-property="effect-brightness"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { brightness: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { brightness: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.contrast">
                    <NumberField
                      class="w-24 flex-1"
                      icon="C"
                      :model-value="effect.contrast ?? 0"
                      :min="-100"
                      :max="100"
                      data-property="effect-contrast"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { contrast: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { contrast: $event })"
                    />
                  </Tip>
                </div>
              </template>

              <!-- Hue / Saturation -->
              <template v-else-if="effect.type === 'HUE_SATURATION'">
                <div class="flex items-center gap-1.5">
                  <Tip :label="panels.hue">
                    <NumberField
                      class="w-24 flex-1"
                      icon="H"
                      :model-value="effect.hue ?? 0"
                      :min="-180"
                      :max="180"
                      data-property="effect-hue"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { hue: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { hue: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.saturation">
                    <NumberField
                      class="w-24 flex-1"
                      icon="S"
                      :model-value="effect.saturation ?? 0"
                      :min="-100"
                      :max="100"
                      data-property="effect-saturation"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { saturation: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { saturation: $event })"
                    />
                  </Tip>
                </div>
              </template>

              <!-- Exposure -->
              <template v-else-if="effect.type === 'EXPOSURE'">
                <Tip :label="panels.exposure">
                  <NumberField
                    class="w-24 flex-1"
                    icon="E"
                    :model-value="effect.exposure ?? 0"
                    :min="-100"
                    :max="100"
                    data-property="effect-exposure"
                    @update:model-value="effectsCtx.scrubEffect(activeNode, index, { exposure: $event })"
                    @commit="effectsCtx.commitEffect(activeNode, index, { exposure: $event })"
                  />
                </Tip>
              </template>

              <!-- Vibrance -->
              <template v-else-if="effect.type === 'VIBRANCE'">
                <Tip :label="panels.vibrance">
                  <NumberField
                    class="w-24 flex-1"
                    icon="V"
                    :model-value="effect.vibrance ?? 0"
                    :min="-100"
                    :max="100"
                    data-property="effect-vibrance"
                    @update:model-value="effectsCtx.scrubEffect(activeNode, index, { vibrance: $event })"
                    @commit="effectsCtx.commitEffect(activeNode, index, { vibrance: $event })"
                  />
                </Tip>
              </template>

              <!-- Saturation -->
              <template v-else-if="effect.type === 'SATURATION'">
                <Tip :label="panels.saturation">
                  <NumberField
                    class="w-24 flex-1"
                    icon="S"
                    :model-value="effect.saturation ?? 100"
                    :min="0"
                    :max="200"
                    data-property="effect-saturation"
                    @update:model-value="effectsCtx.scrubEffect(activeNode, index, { saturation: $event })"
                    @commit="effectsCtx.commitEffect(activeNode, index, { saturation: $event })"
                  />
                </Tip>
              </template>

              <!-- Curves (Gamma) -->
              <template v-else-if="effect.type === 'CURVES'">
                <Tip :label="panels.gamma">
                  <NumberField
                    class="w-24 flex-1"
                    icon="G"
                    :model-value="effect.gamma ?? 1"
                    :min="0.1"
                    :max="3"
                    :step="0.1"
                    data-property="effect-gamma"
                    @update:model-value="effectsCtx.scrubEffect(activeNode, index, { gamma: $event })"
                    @commit="effectsCtx.commitEffect(activeNode, index, { gamma: $event })"
                  />
                </Tip>
              </template>

              <!-- Noise -->
              <template v-else-if="effect.type === 'NOISE'">
                <div class="flex items-center gap-1.5">
                  <Tip :label="panels.noiseDensity">
                    <NumberField
                      class="w-24 flex-1"
                      icon="D"
                      :model-value="effect.noiseDensity ?? 20"
                      :min="0"
                      :max="100"
                      data-property="effect-noise-density"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { noiseDensity: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { noiseDensity: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.noiseSeed">
                    <NumberField
                      class="w-20 flex-1"
                      icon="#"
                      :model-value="effect.noiseSeed ?? 1"
                      :min="1"
                      data-property="effect-noise-seed"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { noiseSeed: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { noiseSeed: $event })"
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
                </div>
              </template>

              <!-- Texture -->
              <template v-else-if="effect.type === 'TEXTURE'">
                <div class="flex items-center gap-1.5">
                  <PanelFieldGroup :label="panels.textureType" class="flex-1">
                    <AppSelect
                      :model-value="effect.textureType ?? 'GRAIN'"
                      :options="textureOptions"
                      :label="panels.textureType"
                      data-property="effect-texture-type"
                      @update:model-value="
                        commitDiscretePropertyListChange(flush, () =>
                          actions.patch(index, { textureType: $event as EffectTextureType })
                        )
                      "
                    />
                  </PanelFieldGroup>
                  <Tip :label="panels.textureScale">
                    <NumberField
                      class="w-20"
                      icon="S"
                      :model-value="effect.textureScale ?? 100"
                      :min="10"
                      :max="500"
                      data-property="effect-texture-scale"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { textureScale: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { textureScale: $event })"
                    />
                  </Tip>
                </div>
              </template>

              <!-- Glass -->
              <template v-else-if="effect.type === 'GLASS'">
                <div class="flex items-center gap-1.5">
                  <Tip :label="panels.refraction">
                    <NumberField
                      class="w-20 flex-1"
                      icon="R"
                      :model-value="effect.refraction ?? 20"
                      :min="0"
                      :max="100"
                      data-property="effect-refraction"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { refraction: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { refraction: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.frosting">
                    <NumberField
                      class="w-20 flex-1"
                      icon="F"
                      :model-value="effect.frosting ?? 10"
                      :min="0"
                      :max="100"
                      data-property="effect-frosting"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { frosting: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { frosting: $event })"
                    />
                  </Tip>
                  <Tip :label="panels.dispersion">
                    <NumberField
                      class="w-20 flex-1"
                      icon="D"
                      :model-value="effect.dispersion ?? 0"
                      :min="0"
                      :max="100"
                      data-property="effect-dispersion"
                      @update:model-value="effectsCtx.scrubEffect(activeNode, index, { dispersion: $event })"
                      @commit="effectsCtx.commitEffect(activeNode, index, { dispersion: $event })"
                    />
                  </Tip>
                </div>
              </template>

              <!-- Plain Blurs (Layer Blur / Background Blur / Foreground Blur) -->
              <NumberField
                v-else
                class="w-24 flex-none"
                icon="B"
                :model-value="effect.radius"
                :min="0"
                data-property="effect-radius"
                @update:model-value="effectsCtx.scrubEffect(activeNode, index, { radius: $event })"
                @commit="effectsCtx.commitEffect(activeNode, index, { radius: $event })"
              />
            </div>
          </div>
        </PropertyItemRow>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
