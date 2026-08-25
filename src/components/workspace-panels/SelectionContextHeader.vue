<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useSelectionState } from '@open-pencil/vue'

import { COMPONENT_TYPES, nodeIcon } from '@/app/editor/icons'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'
import Tip from '@/components/ui/Tip.vue'
import SelectionActionsControl from '@/components/properties/SelectionActionsControl.vue'

const { selectedNode: node, selectedCount: multiCount } = useSelectionState()
const showBooleanOperations = computed(() => multiCount.value >= 2)
const isComponentType = computed(() => {
  const type = node.value?.type
  return type ? COMPONENT_TYPES.has(type) : false
})
const selectedIcon = computed(() => (node.value ? nodeIcon(node.value) : undefined))
const { panels } = useI18n()
</script>

<template>
  <PanelHeader v-if="multiCount > 1">
    <template #icon>
      <icon-lucide-layers-3 class="size-panel-icon" aria-hidden="true" />
    </template>
    <span role="heading" aria-level="2">{{ panels.layersCount({ count: String(multiCount) }) }}</span>
    <template #actions>
      <SelectionActionsControl :show-boolean-operations="showBooleanOperations" />
    </template>
  </PanelHeader>

  <template v-else-if="node">
    <PanelHeader :component="isComponentType">
      <template #icon>
        <Tip :label="node.type">
          <span role="img" :aria-label="node.type" class="contents">
            <component :is="selectedIcon" class="size-panel-icon" />
          </span>
        </Tip>
      </template>
      <span role="heading" aria-level="2">{{ node.name }}</span>
      <template #actions>
        <SelectionActionsControl />
      </template>
    </PanelHeader>
  </template>
</template>
