<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import IconChevronDown from '~icons/lucide/chevron-down'

import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId,
  vTestId,
  ToolbarItem
} from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const {
  tool,
  activeTool,
  toolIcons,
  toolLabels,
  toolShortcuts,
  ui,
  mobile = false
} = defineProps<{
  tool: EditorToolDef
  activeTool: Tool
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Record<Tool, string>
  ui?: ToolbarUI
  mobile?: boolean
}>()

const emit = defineEmits<{
  select: [tool: Tool]
}>()

defineSlots<{
  default(props: { label: string }): unknown
}>()

function isActiveTool(key: Tool) {
  return (
    tool.key === activeTool || (tool.flyout?.includes(activeTool) ?? false) || key === activeTool
  )
}

function activeKeyForTool() {
  return tool.flyout?.includes(activeTool) ? activeTool : tool.key
}
</script>

<template>
  <div class="group flex items-center rounded-lg transition-colors p-0.5">
    <slot :label="`${toolLabels[activeKeyForTool()]} (${tool.shortcut})`">
      <ToolButton
        :data-test-id="toolbarToolTestId(activeKeyForTool(), mobile)"
        :icon="toolIcons[activeKeyForTool()]"
        :active="isActiveTool(activeKeyForTool())"
        :mobile="mobile"
        @click="emit('select', activeKeyForTool())"
      />
    </slot>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button
          v-test-id="toolbarFlyoutTestId(tool.key, mobile)"
          class="flex h-8 w-3.5 cursor-pointer items-center justify-center border-none transition-all duration-150 select-none -ml-0.5"
          :class="[
            mobile ? 'rounded-[6px]' : 'rounded-r-md',
            isActiveTool(activeKeyForTool())
              ? 'text-accent/90 hover:text-accent hover:bg-accent/10'
              : mobile
                ? 'bg-transparent text-muted/70 active:bg-hover'
                : 'bg-transparent text-muted/70 hover:bg-hover hover:text-surface'
          ]"
        >
          <IconChevronDown class="size-2.5 transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          :side-offset="8"
          align="start"
          :class="[
            'z-50 min-w-36 rounded-xl border border-border/80 bg-panel/95 p-1 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95',
            ui?.flyoutContent
          ]"
        >
          <ToolbarItem
            v-for="sub in tool.flyout"
            :key="sub"
            v-slot="{ active: subActive, actions }"
            :tool="sub"
          >
            <DropdownMenuItem
              v-test-id="toolbarFlyoutItemTestId(sub, mobile)"
              :class="[
                'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer outline-none select-none',
                subActive
                  ? 'bg-accent text-white font-medium shadow-xs'
                  : 'text-surface/90 hover:bg-hover hover:text-surface'
              ]"
              @select="actions.select"
            >
              <component :is="toolIcons[sub]" class="size-4 shrink-0 stroke-[1.75]" />
              <span class="flex-1">{{ toolLabels[sub] }}</span>
              <AppShortcutText v-if="!mobile && toolShortcuts[sub]">
                {{ toolShortcuts[sub] }}
              </AppShortcutText>
            </DropdownMenuItem>
          </ToolbarItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
