<script setup lang="ts">
import type { ContainerId } from '@/app/shell/panels'

/**
 * Purely visual seam indicator between (or above/below) stack members, for
 * a dock OR a float container.
 *
 * Targeting itself is resolved geometrically in `drag.ts` from live panel
 * rects (see `resolveDropTarget` in `drop-target.ts`) - this component has no
 * pointer handlers and is not part of hit-testing. It only reflects whichever
 * seam `panelInsertionTarget` currently names, so what lights up is always
 * exactly what a release will commit.
 */
const { containerId, index, active } = defineProps<{
  containerId: ContainerId
  index: number
  active: boolean
}>()
</script>

<template>
  <div
    data-test-id="dock-insertion-target"
    data-dock-insertion-target
    :data-container-id="containerId"
    :data-index="index"
    :data-active="active ? '' : undefined"
    class="relative z-10 shrink-0 overflow-hidden transition-[height] motion-reduce:transition-none"
    :class="active ? 'h-[3px]' : 'h-0'"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded bg-accent transition-opacity"
      :class="active ? 'opacity-100' : 'opacity-0'"
    />
  </div>
</template>
