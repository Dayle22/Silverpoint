<script setup lang="ts">
import { computed } from 'vue'

import {
  containerMembers,
  floatContainer,
  panelLayout,
  startPanelResize,
  RESIZE_CURSORS,
  type FloatId,
  type ResizeHandle
} from '@/app/shell/panels'
import FloatTitleBar from '@/components/Shell/FloatTitleBar.vue'
import PanelStack from '@/components/Shell/PanelStack.vue'

const { containerId } = defineProps<{ containerId: FloatId }>()

const HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

const HANDLE_CLASS: Record<ResizeHandle, string> = {
  n: 'top-0 right-2 left-2 h-1.5 -translate-y-1/2',
  s: 'right-2 bottom-0 left-2 h-1.5 translate-y-1/2',
  e: 'top-2 right-0 bottom-2 w-1.5 translate-x-1/2',
  w: 'top-2 bottom-2 left-0 w-1.5 -translate-x-1/2',
  ne: 'top-0 right-0 size-3 translate-x-1/3 -translate-y-1/3',
  nw: 'top-0 left-0 size-3 -translate-x-1/3 -translate-y-1/3',
  se: 'right-0 bottom-0 size-3 translate-x-1/3 translate-y-1/3',
  sw: 'bottom-0 left-0 size-3 -translate-x-1/3 translate-y-1/3'
}

const container = computed(() => floatContainer(containerId))
const members = computed(() => containerMembers(panelLayout.value, containerId))
/** A container with every member collapsed shrinks to exactly its stacked title rails (CSS `auto`), same as a single collapsed panel did pre-T-031c. */
const allCollapsed = computed(() => members.value.length > 0 && members.value.every((id) => panelLayout.value.panels[id].collapsed))

const style = computed(() => {
  const entry = container.value
  if (!entry) return {}
  return {
    left: `${entry.x}px`,
    top: `${entry.y}px`,
    width: `${entry.width}px`,
    height: allCollapsed.value ? 'auto' : `${entry.height}px`,
    zIndex: String(entry.z)
  }
})

/**
 * Whole-window drag now lives in `FloatTitleBar.vue`. A body press outside a
 * member title bar or resize handle must not move the window.
 */
</script>

<template>
  <div
    v-if="container"
    :data-container-id="containerId"
    :data-test-id="`floating-panel-${containerId}`"
    :data-collapsed="allCollapsed ? '' : undefined"
    class="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
    :style="style"
  >
    <FloatTitleBar :container-id="containerId" />
    <PanelStack :container-id="containerId" />
    <template v-if="!allCollapsed">
      <div
        v-for="handle in HANDLES"
        :key="handle"
        :data-test-id="`floating-panel-${containerId}-resize-${handle}`"
        class="absolute z-10"
        :class="HANDLE_CLASS[handle]"
        :style="{ cursor: RESIZE_CURSORS[handle] }"
        @pointerdown="startPanelResize(containerId, handle, $event)"
      />
    </template>
  </div>
</template>
