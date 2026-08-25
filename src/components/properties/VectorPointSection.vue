<script setup lang="ts">
import { computed } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

const store = useEditorStore()

// `store.state` is shallowReactive, so mutations *inside* `nodeEditState` -
// vertex selection and per-vertex mirroring - are invisible to Vue on their
// own. Every node-edit action calls `requestRepaint()`, which bumps the
// top-level `renderVersion`, so each computed opts in to it the same way the
// editor store's computed refs opt in to `sceneVersion`.
const nodeEditState = computed(() => {
  void store.state.renderVersion
  return store.state.nodeEditState
})
const active = computed(() => {
  void store.state.renderVersion
  const es = store.state.nodeEditState
  return !!es && es.selectedVertexIndices.size > 0
})

const mirroringOptions = [
  { value: 'NONE', label: 'Sharp' },
  { value: 'ANGLE_AND_LENGTH', label: 'Smooth' },
  { value: 'ANGLE', label: 'Disjoint' }
]

const currentMirroring = computed<string>(() => {
  void store.state.renderVersion
  const es = nodeEditState.value
  if (!es || es.selectedVertexIndices.size === 0) return ''

  const indices = [...es.selectedVertexIndices]
  const firstMode = es.vertices[indices[0]]?.handleMirroring ?? 'NONE'

  for (let i = 1; i < indices.length; i++) {
    const mode = es.vertices[indices[i]]?.handleMirroring ?? 'NONE'
    if (mode !== firstMode) {
      return ''
    }
  }

  return firstMode
})

function setMirroring(mode: string) {
  if (mode === 'NONE' || mode === 'ANGLE_AND_LENGTH' || mode === 'ANGLE') {
    store.nodeEditSetMirroring(mode)
  }
}
</script>

<template>
  <PanelSection v-if="active" label="Vector point">
    <PanelFieldGroup label="Handle mirroring">
      <SegmentedControl
        :model-value="currentMirroring"
        :options="mirroringOptions"
        label="Handle mirroring"
        data-property="vector-point-mirroring"
        @change="setMirroring"
      />
    </PanelFieldGroup>
  </PanelSection>
</template>
