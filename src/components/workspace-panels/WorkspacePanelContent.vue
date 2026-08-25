<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n, useMask, useSelectionState, useEditorCommands } from '@open-pencil/vue'

import type { PanelId } from '@/app/shell/panels'
import AssetsPanel from '@/components/AssetsPanel.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import CodePanel from '@/components/CodePanel.vue'
import HistoryPanel from '@/components/HistoryPanel.vue'
import LayerTree from '@/components/LayerTree/LayerTree.vue'
import PagesPanel from '@/components/PagesPanel.vue'
import SwatchesPanel from '@/components/SwatchesPanel.vue'
import VariablesDialog from '@/components/variables/VariablesDialog.vue'
import AppearanceSection from '@/components/properties/AppearanceSection.vue'
import BarcodeSection from '@/components/properties/BarcodeSection.vue'
import EffectsSection from '@/components/properties/EffectsSection.vue'
import ExportSection from '@/components/properties/ExportSection.vue'
import FillSection from '@/components/properties/FillSection.vue'
import GamutSection from '@/components/properties/GamutSection.vue'
import GuidesSection from '@/components/properties/GuidesSection.vue'
import LayoutSection from '@/components/properties/LayoutSection/LayoutSection.vue'
import MaskSection from '@/components/properties/MaskSection.vue'
import PageSection from '@/components/properties/PageSection.vue'
import PositionSection from '@/components/properties/PositionSection.vue'
import ResolutionSection from '@/components/properties/ResolutionSection.vue'
import StrokeSection from '@/components/properties/StrokeSection.vue'
import TypographySection from '@/components/properties/TypographySection.vue'
import VariablesSection from '@/components/properties/VariablesSection.vue'
import VariantSection from '@/components/properties/VariantSection.vue'
import VectorPointSection from '@/components/properties/VectorPointSection.vue'
import PanelEmptyState from '@/components/ui/panel/PanelEmptyState.vue'
import SelectionContextHeader from './SelectionContextHeader.vue'

const { panelId } = defineProps<{ panelId: PanelId }>()
const variablesOpen = ref(false)
const { selectedNode: node, selectedCount } = useSelectionState()
const { active: maskActive } = useMask()
const { panels } = useI18n()
const { getCommand } = useEditorCommands()

const scrollClass = 'flex-1 overflow-x-hidden pb-4'

// Every one of these underlying sections renders nothing at all outside its
// own condition (see the T-031b audit) - each empty state below covers
// exactly that condition so a registered panel is never a blank body.
const isTextNode = computed(() => node.value?.type === 'TEXT')
const isFrameForGuides = computed(() => node.value?.type === 'FRAME' && node.value.rotation === 0)
const isInstanceNode = computed(() => node.value?.type === 'INSTANCE')
</script>

<template>
  <PagesPanel v-if="panelId === 'pages'" />
  <HistoryPanel v-else-if="panelId === 'history'" />
  <AssetsPanel v-else-if="panelId === 'assets'" />

  <div v-else-if="panelId === 'layers'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header data-test-id="layers-header" class="shrink-0 px-3 py-2 text-[11px] tracking-wider text-muted uppercase">
      {{ panels.layers }}
    </header>
    <LayerTree data-test-id="layers-tree" />
  </div>

  <SwatchesPanel v-else-if="panelId === 'swatches'" />

  <div v-else-if="panelId === 'export'" :class="scrollClass"><ExportSection /></div>

  <div v-else-if="panelId === 'variables'" :class="scrollClass">
    <VariablesSection @open-dialog="variablesOpen = true" />
    <VariablesDialog v-model:open="variablesOpen" />
  </div>

  <ChatPanel v-else-if="panelId === 'ai'" />
  <CodePanel v-else-if="panelId === 'code'" />

  <div v-else-if="panelId === 'appearance'" :class="scrollClass">
    <PanelEmptyState v-if="selectedCount === 0" :message="panels.emptySelectObject" />
    <template v-else>
      <AppearanceSection />
      <FillSection />
      <ResolutionSection />
      <StrokeSection />
      <EffectsSection />
      <GamutSection />
    </template>
  </div>

  <div v-else-if="panelId === 'transform'" :class="scrollClass">
    <PanelEmptyState v-if="selectedCount === 0" :message="panels.emptySelectObject" />
    <template v-else>
      <SelectionContextHeader />
      <VectorPointSection />
      <PositionSection />
      <BarcodeSection />
      <LayoutSection />
    </template>
  </div>

  <div v-else-if="panelId === 'text'" :class="scrollClass">
    <PanelEmptyState v-if="!isTextNode" :message="panels.emptySelectText" />
    <TypographySection v-else />
  </div>

  <div v-else-if="panelId === 'page'" :class="scrollClass"><PageSection /></div>

  <div v-else-if="panelId === 'guides'" :class="scrollClass">
    <PanelEmptyState v-if="!isFrameForGuides" :message="panels.emptySelectFrame" />
    <GuidesSection v-else />
  </div>

  <div v-else-if="panelId === 'mask'" :class="scrollClass">
    <PanelEmptyState v-if="!maskActive" :message="panels.emptySelectMask" />
    <MaskSection v-else />
  </div>

  <div v-else-if="panelId === 'component'" :class="scrollClass">
    <PanelEmptyState v-if="!isInstanceNode" :message="panels.emptySelectInstance" />
    <template v-else>
      <div class="flex flex-col gap-1 border-b border-border px-3 py-2">
        <button type="button" class="rounded bg-component/10 px-2 py-1 text-left text-[11px] text-component hover:bg-component/20" @click="getCommand('selection.goToMainComponent').run()">
          {{ panels.goToMainComponent }}
        </button>
        <button type="button" class="rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-hover" @click="getCommand('selection.detachInstance').run()">
          {{ panels.detachInstance }}
        </button>
      </div>
      <VariantSection />
    </template>
  </div>
</template>
