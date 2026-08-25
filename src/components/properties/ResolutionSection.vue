<script setup lang="ts">
import { computed } from 'vue'

import {
  computeEffectiveDpi,
  parseDocumentUnits,
  type EffectiveDpi
} from '@open-pencil/core/units'
import { useI18n, useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { loadDpiThreshold } from '@/app/shell/dpi-threshold'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import type { Fill } from '@open-pencil/scene-graph'

const editor = useEditorStore()
const { selectedNode: node } = useSelectionState()
const { panels } = useI18n()

const rootNode = computed(() => {
  void editor.state.sceneVersion
  return editor.graph.getNode(editor.graph.rootId)
})

const documentUnits = computed(() => {
  void editor.state.sceneVersion
  return parseDocumentUnits(rootNode.value?.pluginData ?? [])
})

const threshold = computed(() => {
  return loadDpiThreshold()
})

interface ImageFillResolution {
  index: number
  fill: Fill
  dpi: EffectiveDpi
}

const imageResolutions = computed<ImageFillResolution[]>(() => {
  void editor.state.sceneVersion
  const activeNode = node.value
  if (!activeNode || !activeNode.fills) return []

  const docDpi = documentUnits.value.dpi
  const currentThreshold = threshold.value

  const results: ImageFillResolution[] = []
  activeNode.fills.forEach((fill, index) => {
    if (fill.type === 'IMAGE') {
      const dpi = computeEffectiveDpi(
        editor.graph,
        activeNode.id,
        index,
        docDpi,
        currentThreshold
      )
      results.push({
        index,
        fill,
        dpi
      })
    }
  })

  return results
})

const hasImageFills = computed(() => {
  const activeNode = node.value
  if (!activeNode || !activeNode.fills) return false
  return activeNode.fills.some((fill) => fill.type === 'IMAGE')
})

function formatScaleMode(mode: string): string {
  switch (mode) {
    case 'FILL':
      return 'Fill'
    case 'FIT':
      return 'Fit'
    case 'CROP':
      return 'Crop'
    case 'TILE':
      return 'Tile'
    default:
      return mode
  }
}

function formatDpi(dpi: EffectiveDpi): string {
  if (dpi.x === null || dpi.y === null) {
    return panels.value.unknown
  }
  if (dpi.x === dpi.y) {
    return panels.value.resolutionDpiSingle({ dpi: String(dpi.x) })
  }
  return panels.value.resolutionDpi({
    x: String(dpi.x),
    y: String(dpi.y),
    min: String(dpi.min ?? Math.min(dpi.x, dpi.y))
  })
}

function formatDimensions(dpi: EffectiveDpi): string {
  if (dpi.sourceWidth === null || dpi.sourceHeight === null) {
    return panels.value.unknown
  }
  return panels.value.resolutionDimensions({
    width: String(dpi.sourceWidth),
    height: String(dpi.sourceHeight)
  })
}
</script>

<template>
  <div v-if="hasImageFills" data-test-id="resolution-section">
    <PanelSection :label="panels.resolution">
      <div class="flex flex-col gap-2">
        <div
          v-for="item in imageResolutions"
          :key="item.index"
          data-test-id="resolution-item-row"
          class="flex flex-col gap-1 rounded-md border border-border bg-panel p-2"
        >
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="font-mono text-surface" data-test-id="resolution-dpi">
              {{ formatDpi(item.dpi) }}
            </span>
            <span
              class="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted"
              data-test-id="resolution-scale-mode"
            >
              {{ formatScaleMode(item.dpi.scaleMode) }}
            </span>
          </div>

          <div class="flex items-center justify-between text-[11px] text-muted">
            <span data-test-id="resolution-source-size">
              {{ formatDimensions(item.dpi) }}
            </span>
          </div>

          <div
            v-if="item.dpi.belowThreshold"
            data-test-id="resolution-warning-row"
            class="mt-1 flex items-center gap-1 rounded-md bg-hover px-1.5 py-1 text-[11px] text-accent"
          >
            <icon-lucide-alert-triangle class="size-3 shrink-0" aria-hidden="true" />
            <span>{{ panels.resolutionWarning({ threshold: String(threshold) }) }}</span>
          </div>
        </div>
      </div>
    </PanelSection>
  </div>
</template>

