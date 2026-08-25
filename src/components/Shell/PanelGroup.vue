<script setup lang="ts">
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'

import PanelTabStrip from '@/components/Shell/PanelTabStrip.vue'
import {
  containerGroups,
  panelInsertionTarget,
  setGroupHeight,
  setPanelHost,
  PANEL_REGISTRY_BY_ID,
  type ContainerId
} from '@/app/shell/panels'

const { containerId, groupIndex } = defineProps<{
  containerId: ContainerId
  groupIndex: number
}>()

const groups = computed(() => containerGroups(containerId))
const group = computed(() => groups.value[groupIndex])
const isDock = computed(() => containerId === 'left' || containerId === 'right')
const isDropRingActive = computed(() => {
  const target = panelInsertionTarget.value
  return (
    target?.kind === 'tab' &&
    target.container === containerId &&
    target.groupIndex === groupIndex
  )
})

const lastNullFillGroupIndex = computed(() => {
  let lastIdx: number | null = null
  for (let i = 0; i < groups.value.length; i++) {
    const g = groups.value[i]
    if (!g.collapsed && PANEL_REGISTRY_BY_ID[g.active].sizing === 'fill' && g.height === null) {
      lastIdx = i
    }
  }
  return lastIdx
})

function groupStyle(): Record<string, string> {
  if (!group.value) return {}
  if (group.value.collapsed) {
    return { flex: '0 0 33px', height: '33px' }
  }
  const entry = PANEL_REGISTRY_BY_ID[group.value.active]
  if (entry.sizing === 'content') {
    return { flex: '0 0 auto' }
  }
  if (group.value.height !== null) {
    return { flex: `0 0 ${group.value.height}px` }
  }
  if (groupIndex === lastNullFillGroupIndex.value) {
    return { flex: '1 1 0', minHeight: '160px' }
  }
  return { flex: `0 0 ${entry.defaultHeight}px` }
}

function resizeGroup(event: PointerEvent): void {
  if (event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  const sectionEl = event.currentTarget.closest('section')
  const startHeight = sectionEl
    ? sectionEl.getBoundingClientRect().height
    : (group.value?.height ?? (group.value ? PANEL_REGISTRY_BY_ID[group.value.active].defaultHeight : 200))
  const startY = event.clientY

  const onMove = (move: PointerEvent) => {
    const delta = move.clientY - startY
    const nextHeight = Math.round(startHeight + delta)
    setGroupHeight(containerId, groupIndex, nextHeight)
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
  <section
    v-if="group"
    :data-group-index="groupIndex"
    :data-test-id="isDropRingActive ? 'panel-group-drop-ring' : `stack-member-${group.active}`"
    :data-panel-id="group.active"
    class="relative flex min-h-0 flex-col overflow-hidden"
    :class="isDropRingActive ? 'ring-2 ring-accent ring-inset' : ''"
    :style="groupStyle()"
  >
    <PanelTabStrip :container-id="containerId" :group-index="groupIndex" />
    <div
      v-for="member in group.members"
      :key="member"
      :ref="setPanelHost(member, isDock ? 'docked' : 'floating')"
      v-show="member === group.active"
      class="flex min-h-0 min-w-0 flex-1 flex-col"
    />
    <div
      v-if="
        groupIndex < groups.length - 1 &&
        !group.collapsed &&
        PANEL_REGISTRY_BY_ID[group.active].sizing === 'fill' &&
        !groups[groupIndex + 1].collapsed
      "
      :data-test-id="`panel-member-divider-${containerId}-${group.active}`"
      class="absolute inset-x-0 bottom-0 z-10 h-2 cursor-row-resize"
      @pointerdown="resizeGroup($event)"
    >
      <div
        class="pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border"
      />
    </div>
  </section>
</template>
