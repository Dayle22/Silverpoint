<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { exportFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import { useEventListener } from '@vueuse/core'

import { useEditorStore } from '@/app/editor/active-store'
import {
  getHistoryManifest,
  readHistorySnapshotGraph,
  type HistorySnapshotEntry
} from '@/app/document/history'
import { pathHash } from '@/app/document/recent'
import { isTauri } from '@/app/tauri/env'
import PanelEmptyState from '@/components/ui/panel/PanelEmptyState.vue'

const store = useEditorStore()
const { panels } = useI18n()

const entries = ref<HistorySnapshotEntry[]>([])
const loading = ref(false)
const previewingEntry = ref<HistorySnapshotEntry | null>(null)
const capturedLiveGraph = shallowRef<SceneGraph | null>(null)

const isFileBacked = computed(() => isTauri() && !!store.getDocumentFilePath?.())

async function loadHistory() {
  const filePath = store.getDocumentFilePath?.()
  if (!filePath || !isTauri()) {
    entries.value = []
    return
  }
  loading.value = true
  try {
    const list = await getHistoryManifest(pathHash(filePath))
    entries.value = list.slice().reverse()
  } catch (err) {
    console.warn('[HistoryPanel] Failed to load manifest:', err)
    entries.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [store.getDocumentFilePath?.(), store.state.sceneVersion],
  () => {
    if (!previewingEntry.value) {
      void loadHistory()
    }
  },
  { immediate: true }
)

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

async function previewSnapshot(entry: HistorySnapshotEntry) {
  if (previewingEntry.value?.fileKey === entry.fileKey) return

  try {
    // If starting a fresh preview, capture current live graph
    if (!capturedLiveGraph.value) {
      const liveBytes = await exportFigFile(
        store.graph,
        undefined,
        store.renderer ?? undefined,
        store.state.currentPageId
      )
      const liveFile = new File([liveBytes], 'live.fig', { type: 'application/octet-stream' })
      capturedLiveGraph.value = await readFigFile(liveFile, { populate: 'first-page' })
    }

    const previewGraph = await readHistorySnapshotGraph(entry.fileKey)
    if (!previewGraph) return

    const targetPageId = store.state.currentPageId
    const pageId = previewGraph.getNode(targetPageId)
      ? targetPageId
      : previewGraph.getPages()[0]?.id
    if (pageId) computeAllLayouts(previewGraph, pageId)

    store.replaceGraph(previewGraph)
    if (pageId) store.state.currentPageId = pageId
    previewingEntry.value = entry
  } catch (err) {
    console.warn('[HistoryPanel] Failed to preview snapshot:', err)
  }
}

function returnToCurrent() {
  if (!capturedLiveGraph.value) {
    previewingEntry.value = null
    return
  }

  const liveGraph = capturedLiveGraph.value
  const targetPageId = store.state.currentPageId
  const pageId = liveGraph.getNode(targetPageId) ? targetPageId : liveGraph.getPages()[0]?.id
  if (pageId) computeAllLayouts(liveGraph, pageId)

  store.replaceGraph(liveGraph)
  if (pageId) store.state.currentPageId = pageId

  previewingEntry.value = null
  capturedLiveGraph.value = null
}

function restoreSnapshot() {
  if (!capturedLiveGraph.value || !previewingEntry.value) return

  const liveGraph = capturedLiveGraph.value
  const restoredGraph = store.graph

  // Register undo transaction: inverse reverts to captured live graph, forward re-applies restored snapshot
  store.undo.push({
    label: 'Restore version',
    forward: () => {
      const targetPageId = store.state.currentPageId
      const pageId = restoredGraph.getNode(targetPageId)
        ? targetPageId
        : restoredGraph.getPages()[0]?.id
      if (pageId) computeAllLayouts(restoredGraph, pageId)
      store.replaceGraph(restoredGraph)
      if (pageId) store.state.currentPageId = pageId
      store.requestRender()
    },
    inverse: () => {
      const targetPageId = store.state.currentPageId
      const pageId = liveGraph.getNode(targetPageId)
        ? targetPageId
        : liveGraph.getPages()[0]?.id
      if (pageId) computeAllLayouts(liveGraph, pageId)
      store.replaceGraph(liveGraph)
      if (pageId) store.state.currentPageId = pageId
      store.requestRender()
    }
  })

  previewingEntry.value = null
  capturedLiveGraph.value = null
  store.requestRender()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewingEntry.value) {
    event.preventDefault()
    returnToCurrent()
  }
}

useEventListener('keydown', handleKeydown)

onUnmounted(() => {
  if (previewingEntry.value) {
    returnToCurrent()
  }
})
</script>

<template>
  <div data-test-id="history-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between px-3 py-1.5 border-b border-border/50">
      <span data-test-id="history-header" class="text-[11px] tracking-wider text-muted uppercase">
        {{ panels.history }}
      </span>
      <span v-if="isFileBacked && entries.length > 0" class="text-[10px] text-muted">
        {{ entries.length }}
      </span>
    </div>

    <!-- Previewing banner -->
    <div
      v-if="previewingEntry"
      data-test-id="history-preview-banner"
      class="shrink-0 flex flex-col gap-2 p-2.5 bg-accent/10 border-b border-accent/30"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-accent">
          {{ panels.previewingHistory }}
        </span>
        <span class="text-[10px] text-muted font-mono">
          {{ formatRelativeTime(previewingEntry.timestamp) }}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          data-test-id="history-restore-btn"
          class="flex-1 cursor-pointer rounded bg-accent px-2 py-1 text-center text-xs font-medium text-white hover:bg-accent/90"
          @click="restoreSnapshot"
        >
          {{ panels.restore }}
        </button>
        <button
          type="button"
          data-test-id="history-return-btn"
          class="flex-1 cursor-pointer rounded border border-border bg-input px-2 py-1 text-center text-xs text-surface hover:bg-hover"
          @click="returnToCurrent"
        >
          {{ panels.returnToCurrent }}
        </button>
      </div>
    </div>

    <!-- Content area -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <PanelEmptyState v-if="!isFileBacked" :message="panels.emptyHistoryNoFile" />
      <PanelEmptyState v-else-if="entries.length === 0 && !loading" :message="panels.emptyHistoryNoEntries" />

      <div
        v-else
        data-test-id="history-scroll"
        class="scrollbar-thin h-full overflow-x-hidden overflow-y-auto px-1 py-1"
      >
        <button
          v-for="item in entries"
          :key="item.fileKey"
          type="button"
          data-test-id="history-item"
          :title="formatFullDate(item.timestamp)"
          class="group mb-0.5 flex w-full cursor-pointer items-center justify-between rounded border-none px-2.5 py-1.5 text-left text-xs transition-colors"
          :class="
            previewingEntry?.fileKey === item.fileKey
              ? 'bg-accent/20 text-accent font-medium'
              : 'bg-transparent text-surface hover:bg-hover'
          "
          @click="previewSnapshot(item)"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="inline-block size-1.5 rounded-full shrink-0"
              :class="item.label === 'save' ? 'bg-emerald-500' : 'bg-amber-500/80'"
            />
            <span class="truncate">{{ formatRelativeTime(item.timestamp) }}</span>
          </div>

          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-[10px] tracking-wide"
            :class="
              item.label === 'save'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            "
          >
            {{ item.label === 'save' ? panels.saved : panels.autosaved }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
