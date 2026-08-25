<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n, useSelectionState, useEditorCommands } from '@open-pencil/vue'

import { COMPONENT_TYPES, nodeIcon } from '@/app/editor/icons'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'
import Tip from '@/components/ui/Tip.vue'

import VariablesDialog from './variables/VariablesDialog.vue'
import AppearanceSection from './properties/AppearanceSection.vue'
import BarcodeSection from './properties/BarcodeSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import GamutSection from './properties/GamutSection.vue'
import GuidesSection from './properties/GuidesSection.vue'
import LayoutSection from './properties/LayoutSection/LayoutSection.vue'
import MaskSection from './properties/MaskSection.vue'
import PageSection from './properties/PageSection.vue'
import PositionSection from './properties/PositionSection.vue'
import ResolutionSection from './properties/ResolutionSection.vue'
import SelectionActionsControl from './properties/SelectionActionsControl.vue'
import StrokeSection from './properties/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'
import VariantSection from './properties/VariantSection.vue'
import VectorPointSection from './properties/VectorPointSection.vue'

const variablesOpen = ref(false)
const { selectedNode: node, selectedCount: multiCount } = useSelectionState()
const showBooleanOperations = computed(() => multiCount.value >= 2)
const { getCommand } = useEditorCommands()
const goToMainComponent = getCommand('selection.goToMainComponent')
const detachInstance = getCommand('selection.detachInstance')
const isComponentType = computed(() => {
  const type = node.value?.type
  return type ? COMPONENT_TYPES.has(type) : false
})
const selectedIcon = computed(() => (node.value ? nodeIcon(node.value) : undefined))
const { panels } = useI18n()
</script>

<template>
  <!-- Multi-select summary -->
  <div
    v-if="multiCount > 1"
    data-test-id="design-panel-multi"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PanelHeader>
      <template #icon>
        <icon-lucide-layers-3 class="size-panel-icon" aria-hidden="true" />
      </template>
      <span role="heading" aria-level="2">
        {{ panels.layersCount({ count: String(multiCount) }) }}
      </span>
      <template #actions>
        <SelectionActionsControl :show-boolean-operations="showBooleanOperations" />
      </template>
    </PanelHeader>
    <VectorPointSection />
    <PositionSection />
    <AppearanceSection />
    <FillSection />
    <StrokeSection />
    <EffectsSection />
    <GamutSection />
    <ExportSection />
  </div>

  <!-- Single selection -->
  <div
    v-else-if="node"
    data-test-id="design-panel-single"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PanelHeader :component="isComponentType">
      <template #icon>
        <Tip :label="node.type">
          <span role="img" :aria-label="node.type" class="contents">
            <component :is="selectedIcon" class="size-panel-icon" />
          </span>
        </Tip>
      </template>
      <span role="heading" aria-level="2">{{ node.name }}</span>
      <template #actions>
        <SelectionActionsControl />
      </template>
    </PanelHeader>

    <!-- Component actions -->
    <div
      v-if="node.type === 'INSTANCE'"
      class="flex flex-col gap-1 border-b border-border px-3 py-2"
    >
      <button
        type="button"
        class="rounded bg-component/10 px-2 py-1 text-left text-[11px] text-component hover:bg-component/20"
        @click="goToMainComponent.run()"
      >
        {{ panels.goToMainComponent }}
      </button>
      <button
        type="button"
        class="rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-hover"
        @click="detachInstance.run()"
      >
        {{ panels.detachInstance }}
      </button>
    </div>

    <VariantSection v-if="node.type === 'INSTANCE'" />

    <VectorPointSection />
    <PositionSection />
    <BarcodeSection />
    <LayoutSection />
    <AppearanceSection />
    <GuidesSection v-if="node.type === 'FRAME' && node.rotation === 0" />
    <MaskSection />
    <TypographySection v-if="node.type === 'TEXT'" />
    <FillSection />
    <ResolutionSection />
    <StrokeSection />
    <EffectsSection />
    <GamutSection />
    <ExportSection />
  </div>

  <div
    v-else
    data-test-id="design-panel-empty"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PageSection />
    <VariablesSection @open-dialog="variablesOpen = true" />
    <GamutSection />
    <ExportSection />
  </div>

  <VariablesDialog v-model:open="variablesOpen" />
</template>
