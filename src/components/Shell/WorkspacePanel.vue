<script setup lang="ts">
import { computed } from 'vue'

import { isFloatId, panelContainerId, panelHost, type PanelId } from '@/app/shell/panels'
import { activeTab } from '@/app/tabs'
import WorkspacePanelContent from '@/components/workspace-panels/WorkspacePanelContent.vue'

const { panelId } = defineProps<{ panelId: PanelId }>()
const host = panelHost(panelId)
const floating = computed(() => {
  const container = panelContainerId(panelId)
  return container !== null && isFloatId(container)
})
</script>

<template>
  <Teleport v-if="host" :to="host">
    <aside
      :data-test-id="`workspace-panel-${panelId}`"
      :data-panel-id="panelId"
      class="flex min-w-0 flex-1 flex-col overflow-hidden bg-panel"
      :class="floating ? 'rounded-[inherit]' : 'border-r border-border'"
      style="contain: paint layout style"
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkspacePanelContent :panel-id="panelId" :key="`${panelId}-${activeTab?.id ?? 'none'}`" />
      </div>
    </aside>
  </Teleport>
</template>
