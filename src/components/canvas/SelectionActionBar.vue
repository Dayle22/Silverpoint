<script setup lang="ts">
import type { Component } from 'vue'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import IconButton from '@/components/ui/IconButton.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import IconCopyPlus from '~icons/lucide/copy-plus'
import IconGroup from '~icons/lucide/group'
import IconLock from '~icons/lucide/lock'
import IconMoreHorizontal from '~icons/lucide/more-horizontal'
import IconTrash2 from '~icons/lucide/trash-2'
import IconUngroup from '~icons/lucide/ungroup'

// T-035: floating selection action bar. Every action below comes from the
// existing editor command registry (label/enabled/run) — this component
// never defines its own action list, label text or enabled logic.
//
// The overflow button does NOT own a second ContextMenu instance: reka-ui's
// ContextMenu is not designed to nest, and an earlier version of this
// component that wrapped its own <ContextMenuRoot> around the "more" button
// broke the canvas's own right-click menu (context-group stayed disabled/
// unclickable — see tests/e2e/context-menu/basic.spec.ts regression). It
// instead emits `overflow` with the trigger's screen position; the parent
// (EditorCanvas.vue) dispatches a synthetic `contextmenu` event on the SAME
// single canvas ContextMenuTrigger that real right-clicks use, so there is
// exactly one ContextMenuRoot and exactly one source of menu content.

type ActionItem = {
  id: EditorCommandId
  icon: Component
}

const ACTION_ITEMS: ActionItem[] = [
  { id: 'selection.duplicate', icon: IconCopyPlus },
  { id: 'selection.delete', icon: IconTrash2 },
  { id: 'selection.toggleLock', icon: IconLock },
  { id: 'selection.group', icon: IconGroup },
  { id: 'selection.ungroup', icon: IconUngroup }
]

const { getCommand } = useEditorCommands()
const { panels } = useI18n()

const actions = ACTION_ITEMS.map((item) => ({ ...item, command: getCommand(item.id) }))

function actionTestId(id: EditorCommandId) {
  const suffix = id.split('.')[1] ?? id
  return `selection-bar-${suffix.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
}

const moreButtonClass = useIconButtonUI({ size: 'sm' }).base

const emit = defineEmits<{ overflow: [] }>()
</script>

<template>
  <div
    data-test-id="selection-action-bar"
    class="flex items-center gap-0.5 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md"
  >
    <IconButton
      v-for="item in actions"
      :key="item.id"
      :label="item.command.label"
      :disabled="!item.command.enabled.value"
      :data-test-id="actionTestId(item.id)"
      @click="item.command.run()"
    >
      <component :is="item.icon" class="size-3.5" />
    </IconButton>

    <div class="mx-1 h-4 w-px bg-border" />

    <Tip :label="panels.selectionActionsMore">
      <button
        type="button"
        data-slot="icon-button"
        data-test-id="selection-bar-more"
        :class="moreButtonClass"
        @click="emit('overflow')"
      >
        <IconMoreHorizontal class="size-3.5" />
      </button>
    </Tip>
  </div>
</template>
