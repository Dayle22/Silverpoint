<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { useI18n } from '@open-pencil/vue'
import FloatingPanel from '@/components/Shell/FloatingPanel.vue'
import {
  clampPanelsToOverlay,
  floatContainerIds,
  measurePanelOverlay,
  panelInsertionTarget,
  panelLayout,
  panelOverlayEl,
  panelOverlaySize,
  panelSnapGuides,
  PANEL_EDGE_DOCK_WIDTH
} from '@/app/shell/panels'

const { panels } = useI18n()

function setOverlayEl(el: unknown): void {
  panelOverlayEl.value = el instanceof HTMLElement ? el : null
}

function refresh(): void {
  const size = measurePanelOverlay()
  panelOverlaySize.value = size
  clampPanelsToOverlay(size)
}

onMounted(refresh)
useEventListener(window, 'resize', refresh)
watch(() => floatContainerIds.value.join(','), refresh, { flush: 'post' })

/**
 * A dock that is currently empty has zero rendered width, so it cannot show
 * its own insertion indicator. When the resolved drop target names an empty
 * DOCK (never a float - floats always have a real rendered rect), show one
 * visual band at that edge instead - purely visual, since targeting itself
 * already resolved this from the edge-band rule in `resolveDropTarget()`,
 * not from this element.
 */
const emptyDockTargetSide = computed(() => {
  const target = panelInsertionTarget.value
  if (!target || target.kind !== 'group' || (target.container !== 'left' && target.container !== 'right')) return null
  return panelLayout.value.docks[target.container].length === 0 ? target.container : null
})
</script>

<template>
  <div
    :ref="setOverlayEl"
    data-test-id="panel-overlay"
    class="pointer-events-none absolute inset-0 z-20"
  >
    <div
      v-if="emptyDockTargetSide"
      data-test-id="panel-empty-dock-target"
      :data-side="emptyDockTargetSide"
      :aria-label="panels.dropPanelHere"
      class="absolute inset-y-0 border-2 border-dashed border-accent bg-accent/10"
      :style="
        emptyDockTargetSide === 'left'
          ? { width: `${PANEL_EDGE_DOCK_WIDTH}px`, left: '0px' }
          : { width: `${PANEL_EDGE_DOCK_WIDTH}px`, right: '0px' }
      "
    />

    <div
      v-for="guide in panelSnapGuides"
      :key="`${guide.axis}-${guide.position}`"
      data-test-id="panel-snap-guide"
      class="absolute bg-accent"
      :style="
        guide.axis === 'x'
          ? {
              left: `${guide.position}px`,
              top: `${guide.start}px`,
              height: `${guide.end - guide.start}px`,
              width: '1px'
            }
          : {
              top: `${guide.position}px`,
              left: `${guide.start}px`,
              width: `${guide.end - guide.start}px`,
              height: '1px'
            }
      "
    />

    <FloatingPanel v-for="id in floatContainerIds" :key="id" :container-id="id" />
  </div>
</template>
