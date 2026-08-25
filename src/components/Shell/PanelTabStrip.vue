<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/IconButton.vue'
import {
  clampRectToOverlay,
  closeGroup,
  closeRegisteredPanel,
  containerGroups,
  dockGroup,
  floatGroup,
  isFloatId,
  measurePanelOverlay,
  nudgePanel,
  panelDraggingGroupContainer,
  panelDraggingId,
  panelInsertionTarget,
  setActiveTab,
  startGroupDrag,
  startPanelDrag,
  toOverlayRect,
  toggleGroupCollapsed,
  type ContainerId,
  type PanelId
} from '@/app/shell/panels'

const { containerId, groupIndex } = defineProps<{
  containerId: ContainerId
  groupIndex: number
}>()

const { panels } = useI18n()

const group = computed(() => containerGroups(containerId)[groupIndex])
const caretIndex = computed<number | null>(() => {
  const target = panelInsertionTarget.value
  if (
    target?.kind === 'tab' &&
    target.container === containerId &&
    target.groupIndex === groupIndex
  ) {
    return Math.max(0, Math.min(target.tabIndex, group.value?.members.length ?? 0))
  }
  return null
})

const NUDGE_STEP = 1
const NUDGE_STEP_LARGE = 10

function onTabPointerDown(member: PanelId, event: PointerEvent): void {
  event.stopPropagation()
  startPanelDrag(member, event)
}

function onDoubleClick(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('button')) return
  toggleGroupCollapsed(containerId, groupIndex)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggleGroupCollapsed(containerId, groupIndex)
    return
  }

  if (!isFloatId(containerId) || !group.value) return

  const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  nudgePanel(group.value.active, move[0], move[1])
}

function onToggleFloat(event: MouseEvent): void {
  if (isFloatId(containerId)) {
    dockGroup(containerId, groupIndex)
    return
  }
  const panelEl = (event.currentTarget as HTMLElement | null)?.closest('[data-panel-id]')
  const rect =
    panelEl instanceof HTMLElement
      ? clampRectToOverlay(toOverlayRect(panelEl.getBoundingClientRect()), measurePanelOverlay())
      : undefined
  floatGroup(containerId, groupIndex, rect ? { x: rect.x, y: rect.y, width: rect.width } : undefined)
}
</script>

<template>
  <header
    v-if="group"
    :data-test-id="`panel-tab-strip-${containerId}-${groupIndex}`"
    tabindex="0"
    role="tablist"
    :aria-label="panels[group.active]"
    :aria-expanded="!group.collapsed"
    class="flex h-[33px] shrink-0 items-center gap-0 border-b border-border bg-panel px-1 select-none cursor-grab active:cursor-grabbing"
    :class="panelDraggingGroupContainer === containerId ? 'opacity-40' : ''"
    @pointerdown="startGroupDrag(containerId, groupIndex, $event)"
    @dblclick="onDoubleClick"
    @keydown="onKeydown"
  >
    <template v-for="(member, idx) in group.members" :key="member">
      <div
        v-if="caretIndex === idx"
        data-test-id="panel-tab-caret"
        class="pointer-events-none h-[21px] w-[2px] shrink-0 rounded bg-accent"
      />
      <button
        type="button"
        :data-test-id="`panel-tab-${member}`"
        :data-tab-id="member"
        role="tab"
        :aria-selected="member === group.active"
        class="group/paneltab relative flex h-full max-w-40 min-w-0 cursor-pointer items-center gap-1 px-2 text-[11px] font-semibold transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent"
        :class="[
          member === group.active
            ? 'border-b-2 border-b-accent bg-panel text-surface'
            : 'text-muted hover:text-surface',
          panelDraggingId === member ? 'opacity-40' : ''
        ]"
        @pointerdown="onTabPointerDown(member, $event)"
        @click="setActiveTab(containerId, groupIndex, member)"
      >
        <span class="min-w-0 flex-1 truncate">{{ panels[member] }}</span>
        <button
          type="button"
          :data-test-id="`panel-tab-close-${member}`"
          :aria-label="panels.closePanel"
          tabindex="-1"
          class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-hover group-hover/paneltab:opacity-100"
          :class="member === group.active ? 'opacity-100' : ''"
          @click.stop="closeRegisteredPanel(member)"
        >
          <icon-lucide-x class="size-3" />
        </button>
      </button>
    </template>
    <div
      v-if="caretIndex === group.members.length"
      data-test-id="panel-tab-caret"
      class="pointer-events-none h-[21px] w-[2px] shrink-0 rounded bg-accent"
    />
    <div class="min-w-0 flex-1" />
    <IconButton
      :label="isFloatId(containerId) ? panels.dockPanel : panels.floatPanel"
      :data-test-id="`panel-group-float-${containerId}-${groupIndex}`"
      @click="onToggleFloat"
    >
      <icon-lucide-pin-off v-if="isFloatId(containerId)" class="size-3" />
      <icon-lucide-pin v-else class="size-3" />
    </IconButton>
    <IconButton
      :label="group.collapsed ? panels.expandPanel : panels.minimisePanel"
      :aria-expanded="!group.collapsed"
      :data-test-id="`panel-group-collapse-${containerId}-${groupIndex}`"
      @click="toggleGroupCollapsed(containerId, groupIndex)"
    >
      <icon-lucide-chevron-down v-if="group.collapsed" class="size-3" />
      <icon-lucide-minus v-else class="size-3" />
    </IconButton>
    <IconButton
      :label="panels.closePanel"
      :data-test-id="`panel-group-close-${containerId}-${groupIndex}`"
      @click="closeGroup(containerId, groupIndex)"
    >
      <icon-lucide-x class="size-3" />
    </IconButton>
  </header>
</template>
