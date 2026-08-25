<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { COMPONENT_TYPES, nodeIcon } from '@/app/editor/icons'
import Tip from '@/components/ui/Tip.vue'
import LayerTreeActions from './LayerTreeActions.vue'
import LayerTreeDisclosure from './LayerTreeDisclosure.vue'
import LayerTreeDropIndicator from './LayerTreeDropIndicator.vue'

import type { LayerNode } from '@open-pencil/vue'
import type { LayerTreeChrome, LayerTreeItemActions } from './types'

const { node, level, hasChildren, selected, padLeft, expanded, actions, chrome } = defineProps<{
  node: LayerNode
  level: number
  hasChildren: boolean
  selected: boolean
  padLeft: string
  expanded: boolean
  actions: LayerTreeItemActions
  chrome: LayerTreeChrome
}>()

const emit = defineEmits<{
  renameStart: [id: string, name: string]
}>()

const { panels } = useI18n()
</script>

<template>
  <div
    data-test-id="layers-item"
    :data-is-mask="node.isMask || undefined"
    :data-masked="node.masked || undefined"
    class="group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 pr-1 text-left text-xs"
    :class="[
      selected ? 'bg-accent text-white' : 'bg-transparent text-surface hover:bg-hover',
      chrome.draggingId === node.id ? 'opacity-30' : '',
      chrome.instructionTargetId === node.id && chrome.instruction?.type === 'make-child'
        ? 'bg-accent/15 text-surface outline-2 outline-accent outline-offset-[-2px]'
        : '',
      !node.visible ? 'opacity-50' : '',
      node.masked ? 'border-l-2 border-accent/50' : ''
    ]"
    :style="{ paddingLeft: padLeft }"
    @dblclick="emit('renameStart', node.id, node.name)"
  >
    <LayerTreeDisclosure
      :expanded="expanded"
      :visible="hasChildren"
      @toggle="actions.toggleExpand"
    />

    <component
      :is="nodeIcon(node)"
      class="size-3 shrink-0"
      :class="COMPONENT_TYPES.has(node.type) ? 'text-component opacity-100' : 'opacity-70'"
    />
    <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>

    <Tip v-if="node.isMask" :label="panels.mask">
      <icon-lucide-blend
        data-test-id="layers-item-mask-badge"
        class="size-3 shrink-0"
        :class="selected ? 'text-white' : 'text-accent'"
      />
    </Tip>

    <LayerTreeActions
      :node="node"
      :selected="selected"
      @toggle-lock="actions.toggleLock"
      @toggle-visibility="actions.toggleVisibility"
    />

    <LayerTreeDropIndicator
      :active="chrome.instructionTargetId === node.id"
      :instruction="chrome.instruction"
      :level="level"
      :indent="chrome.indent"
    />
  </div>
</template>
