<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

import {
  getRecentProjects,
  removeRecentProject,
  type RecentProject
} from '@/app/document/recent'
import { readCacheBytes } from '@/app/cache'
import { createTab, allTabs, switchTab } from '@/app/tabs'
import { openFileDialog, openFileFromPath } from '@/app/shell/menu/use'
import { isTauri } from '@/app/tauri/env'
import Tip from '@/components/ui/Tip.vue'

interface DisplayProject extends RecentProject {
  thumbnailUrl?: string
}

const projects = ref<DisplayProject[]>([])
const loading = ref(true)
const objectUrlsToRevoke: string[] = []

async function loadProjects() {
  loading.value = true
  const list = await getRecentProjects()
  const displayList: DisplayProject[] = []

  for (const item of list) {
    let thumbnailUrl: string | undefined
    if (item.thumbnailKey) {
      try {
        const bytes = await readCacheBytes(item.thumbnailKey)
        if (bytes && bytes.byteLength > 0) {
          const blob = new Blob([bytes], { type: 'image/png' })
          thumbnailUrl = URL.createObjectURL(blob)
          objectUrlsToRevoke.push(thumbnailUrl)
        }
      } catch (err) {
        console.warn('[Dashboard] Thumbnail load failed:', err)
      }
    }
    displayList.push({ ...item, thumbnailUrl })
  }

  projects.value = displayList
  loading.value = false
}

function handleOpenProject(item: RecentProject) {
  const existingTab = allTabs.value.find((t) => {
    const tabObj = t as { id: string; path?: string | null }
    return tabObj.path === item.path
  })
  if (existingTab) {
    switchTab(existingTab.id)
    return
  }
  void openFileFromPath(item.path)
}

function handleNewFile() {
  createTab()
}

function handleOpenLocalFile() {
  void openFileDialog()
}

async function handleRemove(item: RecentProject, e: MouseEvent) {
  e.stopPropagation()
  await removeRecentProject(item.path)
  await loadProjects()
}

async function handleShowInExplorer(item: RecentProject, e: MouseEvent) {
  e.stopPropagation()
  if (!isTauri()) return
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(item.path)
  } catch {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(item.path)
    } catch (err) {
      console.warn('[Dashboard] Could not open explorer:', err)
    }
  }
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

onMounted(() => {
  void loadProjects()
})

onUnmounted(() => {
  for (const url of objectUrlsToRevoke) {
    URL.revokeObjectURL(url)
  }
})
</script>

<template>
  <div data-test-id="dashboard-root" class="flex flex-1 flex-col overflow-y-auto bg-canvas p-8">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <!-- Header Banner -->
      <div class="flex items-center justify-between border-b border-border/50 pb-6">
        <div class="flex items-center gap-3">
          <img src="/favicon-32.png" class="size-8" alt="Silverpoint" />
          <div>
            <h1 class="text-xl font-semibold tracking-tight text-surface">Silverpoint</h1>
            <p class="text-xs text-muted">Vector & Layout Design Studio</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            data-test-id="dashboard-new-file"
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
            @click="handleNewFile"
          >
            <icon-lucide-plus class="size-4" />
            <span>New Design File</span>
          </button>

          <button
            data-test-id="dashboard-open-file"
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-xs font-medium text-surface transition-colors hover:bg-hover"
            @click="handleOpenLocalFile"
          >
            <icon-lucide-folder-open class="size-4" />
            <span>Open Local File...</span>
          </button>
        </div>
      </div>

      <!-- Recent Projects Section -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-surface">Recent Projects</h2>
          <span v-if="projects.length > 0" class="text-xs text-muted"
            >{{ projects.length }} of 20 max</span
          >
        </div>

        <!-- Empty state -->
        <div
          v-if="!loading && projects.length === 0"
          data-test-id="dashboard-empty-state"
          class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-panel/20 py-16 text-center"
        >
          <icon-lucide-layout-grid class="size-12 text-muted/40" />
          <h3 class="mt-4 text-sm font-medium text-surface">No Recent Projects</h3>
          <p class="mt-1 text-xs text-muted">Create a new design file or open an existing file to get started.</p>
          <button
            class="mt-4 cursor-pointer text-xs text-accent hover:underline"
            @click="handleNewFile"
          >
            Create New Design File
          </button>
        </div>

        <!-- Projects Grid -->
        <div
          v-else
          data-test-id="dashboard-projects-grid"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <div
            v-for="item in projects"
            :key="item.path"
            data-test-id="dashboard-project-card"
            class="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-panel/40 p-3 transition-all hover:-translate-y-0.5 hover:border-border hover:bg-panel hover:shadow-lg backdrop-blur-md"
            @click="handleOpenProject(item)"
          >
            <!-- Canvas Thumbnail Preview -->
            <div
              class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-border/30 bg-canvas/60"
            >
              <img
                v-if="item.thumbnailUrl"
                :src="item.thumbnailUrl"
                class="size-full object-contain transition-transform group-hover:scale-105"
                alt="Thumbnail"
              />
              <icon-lucide-file-text v-else class="size-8 text-muted/30" />
            </div>

            <!-- Metadata -->
            <div class="mt-3 flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <span class="truncate text-xs font-medium text-surface">{{ item.name }}</span>
                <span class="shrink-0 text-[10px] text-muted">{{ formatTime(item.lastOpened) }}</span>
              </div>
              <Tip :label="item.path">
                <span class="truncate text-[10px] text-muted/70">{{ item.path }}</span>
              </Tip>
            </div>

            <!-- Hover action buttons -->
            <div
              class="absolute top-4 right-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Tip v-if="isTauri()" label="Show in File Explorer">
                <button
                  aria-label="Show in File Explorer"
                class="flex size-6 cursor-pointer items-center justify-center rounded-md bg-canvas/80 text-muted shadow-sm hover:text-surface"
                @click="handleShowInExplorer(item, $event)"
                >
                  <icon-lucide-folder class="size-3" />
                </button>
              </Tip>

              <Tip label="Remove from Recents">
                <button
                  aria-label="Remove from Recents"
                class="flex size-6 cursor-pointer items-center justify-center rounded-md bg-canvas/80 text-muted shadow-sm hover:text-red-400"
                @click="handleRemove(item, $event)"
                >
                  <icon-lucide-trash-2 class="size-3" />
                </button>
              </Tip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
