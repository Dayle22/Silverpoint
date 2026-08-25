<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'

import DockInsertionTarget from '@/components/Shell/DockInsertionTarget.vue'
import PanelGroup from '@/components/Shell/PanelGroup.vue'
import {
  containerGroups,
  effectiveDockWidths,
  panelLayout,
  panelInsertionTarget,
  setDockWidth,
  writePanelLayout,
  type ContainerId
} from '@/app/shell/panels'

/**
 * The shared vertical stack renderer (T-031c / T-070a / T-070c2): iterates
 * panel groups with tab strips + bodies, pixel-plus-grow sizing, draggable
 * height dividers below expanded fill-sized groups, and insertion-seam
 * indicators.
 */
const { containerId } = defineProps<{ containerId: ContainerId }>()
const isDock = computed(() => containerId === 'left' || containerId === 'right')
const groups = computed(() => containerGroups(containerId))
const renderedWidth = computed(() => {
  if (containerId !== 'left' && containerId !== 'right') return null
  return effectiveDockWidths.value[containerId]
})

function isActiveSeam(index: number): boolean {
  const target = panelInsertionTarget.value
  return target?.kind === 'group' && target.container === containerId && target.groupIndex === index
}

function resizeWidth(event: PointerEvent): void {
  if (!isDock.value || event.button !== 0) return
  const side = containerId as 'left' | 'right'
  const startX = event.clientX
  const before = panelLayout.value.dockWidths[side]
  const onMove = (move: PointerEvent) => {
    const direction = side === 'left' ? 1 : -1
    writePanelLayout(setDockWidth(panelLayout.value, side, before + (move.clientX - startX) * direction))
  }
  const stops: Array<() => void> = []
  const done = () => {
    for (const stop of stops) stop()
  }
  stops.push(useEventListener(window, 'pointermove', onMove))
  stops.push(useEventListener(window, 'pointerup', done))
  stops.push(useEventListener(window, 'pointercancel', done))
}
</script>

<template>
  <component
    :is="isDock ? 'aside' : 'div'"
    :data-test-id="isDock ? `dock-stack-${containerId}` : undefined"
    :data-container-id="containerId"
    :aria-hidden="isDock && groups.length === 0 ? 'true' : undefined"
    class="relative flex min-h-0 flex-col overflow-hidden bg-panel"
    :class="[
      isDock ? 'shrink-0 transition-[width,min-width,max-width] motion-reduce:transition-none' : 'flex-1',
      isDock && groups.length > 0 ? (containerId === 'left' ? 'border-r border-border' : 'border-l border-border') : ''
    ]"
    :style="isDock ? { width: `${renderedWidth}px`, minWidth: `${renderedWidth}px`, maxWidth: `${renderedWidth}px` } : undefined"
  >
    <div
      v-if="isDock && groups.length > 0"
      data-test-id="dock-width-divider"
      class="absolute inset-y-0 z-20 w-2 cursor-col-resize"
      :class="containerId === 'left' ? '-right-1' : '-left-1'"
      @pointerdown="resizeWidth"
    />
    <div
      v-if="!isDock || groups.length > 0"
      class="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
    >
      <DockInsertionTarget :container-id="containerId" :index="0" :active="isActiveSeam(0)" />
      <template v-for="(group, index) in groups" :key="`${containerId}-${index}-${group.members[0]}`">
        <PanelGroup :container-id="containerId" :group-index="index" />
        <DockInsertionTarget :container-id="containerId" :index="index + 1" :active="isActiveSeam(index + 1)" />
      </template>
    </div>
  </component>
</template>
