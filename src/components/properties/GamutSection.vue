<script setup lang="ts">
import { computed } from 'vue'

import {
  analyzeGraphGamut,
  colorToCSS,
  type GamutFinding,
  type PrintGamutProfile
} from '@open-pencil/core/color'
import type { Color } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { printGamutStorage } from '@/app/shell/print-gamut'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const editorStore = useEditorStore()
const { panels } = useI18n()

const settings = printGamutStorage

const PROFILE_OPTIONS = computed<{ value: PrintGamutProfile; label: string }[]>(() => [
  { value: 'coated', label: panels.value.gamutProfileCoated },
  { value: 'uncoated', label: panels.value.gamutProfileUncoated }
])

const allFindings = computed<GamutFinding[]>(() => {
  if (!settings.value.enabled) return []
  // React to sceneVersion and currentPageId changes
  void editorStore.state.sceneVersion
  const pageId = editorStore.state.currentPageId || editorStore.graph.getPages()[0]?.id
  if (!pageId) return []
  return analyzeGraphGamut(editorStore.graph, pageId, settings.value.profile)
})

const outOfGamutFindings = computed(() =>
  allFindings.value.filter((f) => f.excessChroma >= 0)
)

const unanalysableFindings = computed(() =>
  allFindings.value.filter((f) => f.excessChroma === -1)
)

function selectFindingNode(nodeId: string) {
  editorStore.select([nodeId])
}

function getNodeName(nodeId: string): string {
  return editorStore.graph.getNode(nodeId)?.name ?? panels.value.untitled
}

function getSourceLabel(source: GamutFinding['source']): string {
  switch (source) {
    case 'fill':
      return panels.value.gamutSourceFill
    case 'stroke':
      return panels.value.gamutSourceStroke
    case 'effect':
      return panels.value.gamutSourceEffect
    case 'text-fill':
      return panels.value.gamutSourceTextFill
  }
}

function findingSwatchColor(color: Color): string {
  return colorToCSS(color)
}
</script>

<template>
  <PanelSection :label="panels.gamutWarning" data-test-id="gamut-section">
    <div class="flex flex-col gap-2">
      <!-- Advisory notice (Mandatory on every surface showing warnings) -->
      <div
        data-test-id="gamut-approximate-notice"
        class="rounded-md border border-border bg-panel p-2 text-[11px] text-muted"
      >
        <span class="inline-flex items-center gap-1">
          <icon-lucide-info class="size-3 shrink-0 text-muted" aria-hidden="true" />
          <span>{{ panels.gamutApproximateNotice }}</span>
        </span>
      </div>

      <!-- Controls: Enable checkbox and Profile select -->
      <div class="flex items-center justify-between gap-2 py-0.5">
        <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
          <AppCheckbox
            v-model="settings.enabled"
            :label="panels.gamutEnable"
            data-test-id="gamut-enable-checkbox"
          />
          <span>{{ panels.gamutEnable }}</span>
        </label>
      </div>

      <PanelGrid v-if="settings.enabled" columns="fill">
        <PanelFieldGroup :label="panels.gamutProfile">
          <AppSelect
            v-model="settings.profile"
            :options="PROFILE_OPTIONS"
            :aria-label="panels.gamutProfile"
            data-test-id="gamut-profile-select"
          />
        </PanelFieldGroup>
      </PanelGrid>

      <!-- Active findings list -->
      <template v-if="settings.enabled">
        <div class="flex items-center justify-between border-t border-border pt-2">
          <span
            v-if="outOfGamutFindings.length > 0"
            data-test-id="gamut-count"
            class="text-[11px] text-muted"
          >
            {{ panels.gamutOutOfGamutCount({ count: String(outOfGamutFindings.length) }) }}
          </span>
          <span
            v-else
            data-test-id="gamut-no-issues"
            class="text-[11px] text-muted"
          >
            {{ panels.gamutNoIssues }}
          </span>
        </div>

        <div v-if="outOfGamutFindings.length > 0" class="flex flex-col gap-1">
          <button
            v-for="(finding, idx) in outOfGamutFindings"
            :key="`${finding.nodeId}:${finding.source}:${finding.index}:${idx}`"
            type="button"
            data-test-id="gamut-finding-row"
            class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left hover:bg-hover hover:border-border"
            @click="selectFindingNode(finding.nodeId)"
          >
            <!-- Document colour swatch -->
            <span
              class="size-3.5 shrink-0 rounded-md border border-border"
              :style="{ backgroundColor: findingSwatchColor(finding.color) }"
            />
            <span class="min-w-0 flex-1 truncate text-xs text-surface">
              {{ getNodeName(finding.nodeId) }}
            </span>
            <span class="shrink-0 rounded-md border border-border bg-panel px-1.5 py-0.5 text-[11px] text-muted">
              {{ getSourceLabel(finding.source) }}
            </span>
            <span class="shrink-0 font-mono text-[11px] text-muted">
              +{{ finding.excessChroma.toFixed(2) }}
            </span>
          </button>
        </div>

        <!-- Unanalysable images note -->
        <div
          v-if="unanalysableFindings.length > 0"
          data-test-id="gamut-unanalysable-note"
          class="border-t border-border pt-1 text-[11px] text-muted"
        >
          {{ panels.gamutUnanalysableCount({ count: String(unanalysableFindings.length) }) }}
        </div>
      </template>
    </div>
  </PanelSection>
</template>
