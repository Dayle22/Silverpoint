<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  DEFAULT_DOCUMENT_UNITS,
  formatUnitValue,
  parseFrameGuides,
  resolveUnitCommitPx,
  setFrameGuideEdge,
  setFrameGuideLinked,
  upsertFrameGuides,
  type FrameGuideEdge,
  type FrameGuideKind,
  type FrameGuides
} from '@open-pencil/core/editor'
import type { PluginDataEntry } from '@open-pencil/scene-graph'
import { useI18n, useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelRail from '@/components/ui/panel/PanelRail.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const store = useEditorStore()
const { selectedNode } = useSelectionState()
const { panels } = useI18n()
const previewOriginal = ref<PluginDataEntry[] | null>(null)

const node = computed(() => {
  const selected = selectedNode.value
  return selected?.type === 'FRAME' && selected.rotation === 0 ? selected : null
})
const guides = computed(() => {
  void store.state.sceneVersion
  return parseFrameGuides(node.value?.pluginData ?? [])
})
const units = computed(() => store.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS)

const sides: FrameGuideEdge[] = ['top', 'right', 'bottom', 'left']
const sideLabels = computed<Record<FrameGuideEdge, string>>(() => ({
  top: panels.value.top,
  right: panels.value.right,
  bottom: panels.value.bottom,
  left: panels.value.left
}))

function displayGuideValue(storedPx: number): number {
  return Number(formatUnitValue(storedPx, units.value))
}

function writeWithUndo(next: FrameGuides, label: string) {
  const selected = node.value
  if (!selected) return
  const pluginData = upsertFrameGuides(selected.pluginData, next)
  store.updateNodeWithUndo(selected.id, { pluginData }, label)
}

function toggleEnabled(kind: FrameGuideKind) {
  const next = structuredClone(guides.value)
  next[kind].enabled = !next[kind].enabled
  writeWithUndo(next, kind === 'margins' ? 'Toggle margins' : 'Toggle bleed')
}

function toggleLinked(kind: FrameGuideKind) {
  const selected = node.value
  if (!selected) return
  writeWithUndo(
    setFrameGuideLinked(
      guides.value,
      kind,
      !guides.value[kind].linked,
      selected.width,
      selected.height
    ),
    kind === 'margins' ? 'Link margin sides' : 'Link bleed sides'
  )
}

function previewEdge(kind: FrameGuideKind, edge: FrameGuideEdge, inputUnitValue: number) {
  const selected = node.value
  if (!selected || !Number.isFinite(inputUnitValue)) return
  previewOriginal.value ??= structuredClone(selected.pluginData)
  const currentPx = guides.value[kind][edge]
  const targetPx = resolveUnitCommitPx(inputUnitValue, currentPx, units.value)
  const next = setFrameGuideEdge(guides.value, kind, edge, targetPx, selected.width, selected.height)
  store.updateNode(selected.id, { pluginData: upsertFrameGuides(selected.pluginData, next) })
}

function commitEdge(kind: FrameGuideKind, edge: FrameGuideEdge, inputUnitValue: number) {
  const selected = node.value
  if (!selected || !Number.isFinite(inputUnitValue)) return
  const original = previewOriginal.value ?? structuredClone(selected.pluginData)
  const parsedGuides = parseFrameGuides(selected.pluginData)
  const currentPx = parsedGuides[kind][edge]
  const targetPx = resolveUnitCommitPx(inputUnitValue, currentPx, units.value)
  const next = setFrameGuideEdge(
    parsedGuides,
    kind,
    edge,
    targetPx,
    selected.width,
    selected.height
  )
  const nextPluginData = upsertFrameGuides(selected.pluginData, next)
  store.updateNode(selected.id, { pluginData: original })
  store.updateNodeWithUndo(
    selected.id,
    { pluginData: nextPluginData },
    kind === 'margins' ? 'Update margins' : 'Update bleed'
  )
  previewOriginal.value = null
}
</script>

<template>
  <PanelSection v-if="node" :label="panels.guides">
    <div
      v-for="kind in ['margins', 'bleed'] as FrameGuideKind[]"
      :key="kind"
      :data-property="`frame-guides-${kind}`"
      class="mb-panel last:mb-0"
    >
      <div class="mb-1 flex items-center justify-between">
        <span class="text-[11px] font-medium">{{
          kind === 'margins' ? panels.margins : panels.bleed
        }}</span>
        <div class="flex gap-0.5">
          <IconButton
            :label="guides[kind].enabled ? panels.hide : panels.show"
            :active="guides[kind].enabled"
            @click="toggleEnabled(kind)"
          >
            <icon-lucide-eye v-if="guides[kind].enabled" class="size-3.5" />
            <icon-lucide-eye-off v-else class="size-3.5" />
          </IconButton>
          <IconButton
            :label="guides[kind].linked ? panels.unlinkSides : panels.linkSides"
            :active="guides[kind].linked"
            @click="toggleLinked(kind)"
          >
            <icon-lucide-link v-if="guides[kind].linked" class="size-3.5" />
            <icon-lucide-unlink v-else class="size-3.5" />
          </IconButton>
        </div>
      </div>

      <PanelGrid v-if="guides[kind].linked" columns="fill-rail">
        <PanelFieldGroup :label="kind === 'margins' ? panels.margins : panels.bleed">
          <NumberField
            :suffix="units.unit"
            :aria-label="kind === 'margins' ? panels.margins : panels.bleed"
            :model-value="displayGuideValue(guides[kind].top)"
            :min="0"
            :max="100000"
            @update:model-value="previewEdge(kind, 'top', $event)"
            @commit="(value: number) => commitEdge(kind, 'top', value)"
          />
        </PanelFieldGroup>
        <PanelRail>
          <span class="text-[10px] text-muted">{{ units.unit }}</span>
        </PanelRail>
      </PanelGrid>

      <PanelGrid v-else columns="two">
        <PanelFieldGroup v-for="side in sides" :key="side" :label="sideLabels[side]">
          <NumberField
            :suffix="units.unit"
            :aria-label="sideLabels[side]"
            :model-value="displayGuideValue(guides[kind][side])"
            :min="0"
            :max="100000"
            @update:model-value="previewEdge(kind, side, $event)"
            @commit="(value: number) => commitEdge(kind, side, value)"
          />
        </PanelFieldGroup>
      </PanelGrid>
    </div>
  </PanelSection>
</template>
