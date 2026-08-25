<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import { useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

import { useViewportKind, formatShortcut, useI18n } from '@open-pencil/vue'
import { useKeyboard } from '@/app/shell/keyboard/use'
import { openFileFromPath, useMenu } from '@/app/shell/menu/use'
import { useCollab, COLLAB_KEY } from '@/app/collab/use'
import { connectAutomation } from '@/app/automation/bridge/server'
import { spawnMCPIfNeeded } from '@/app/automation/mcp/spawn'
import { isTauri } from '@/app/tauri/env'
import { appMenuShortcut } from '@/app/shell/menu/shortcut'
import { createDemoShapes } from '@/app/demo/document'
import { useEditorStore } from '@/app/editor/active-store'
import {
  createTab,
  activeTab,
  activeTabId,
  getActiveStore,
  getTabsSnapshot,
  openFileInNewTab,
  tabCount,
  useTabsStore
} from '@/app/tabs'
import { restoreRecoverySession } from '@/app/document/recovery'
import {
  PANEL_IDS,
  setPanelHost,
} from '@/app/shell/panels'

import DashboardView from '@/components/DashboardView.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import MobileDrawer from '@/components/MobileDrawer.vue'
import MobileHud from '@/components/MobileHud/MobileHud.vue'
import PanelOverlay from '@/components/Shell/PanelOverlay.vue'
import PanelStack from '@/components/Shell/PanelStack.vue'
import WorkspacePanel from '@/components/Shell/WorkspacePanel.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import TabBar from '@/components/TabBar.vue'
import Tip from '@/components/ui/Tip.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import PreferencesDialog from '@/components/Shell/PreferencesDialog.vue'
import PdfImportDialog from '@/components/Shell/PdfImportDialog.vue'
import IdmlImportDialog from '@/components/Shell/IdmlImportDialog.vue'
import { useDialogUI } from '@/components/ui/dialog'

const route = useRoute()
const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)

const { tabs } = useTabsStore()
const createdInitialTab = tabCount() === 0
const firstTab = createdInitialTab ? createTab() : (activeTab.value ?? createTab())
const store = useEditorStore()
const { dialogs } = useI18n()
const { isMobile } = useViewportKind()
const closePromptOpen = ref(false)
const closePromptBusy = ref(false)
const closePrompt = useDialogUI({ content: 'w-[420px] max-w-[calc(100vw-2rem)]' })

if (createdInitialTab && route.meta.demo && !('test' in params)) {
  createDemoShapes(firstTab.store)
}

useHead({ title: route.meta.demo ? 'Demo' : undefined })
useKeyboard()
useMenu()

const collab = useCollab(getActiveStore)
provide(COLLAB_KEY, collab)

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)

const automationCleanup = ref<(() => void) | null>(null)
const mcpCleanup = ref<(() => void) | null>(null)
const fileAssociationCleanup = ref<(() => void) | null>(null)
const closeWindowCleanup = ref<(() => void) | null>(null)
type PendingOpenFile = {
  path: string
}

async function openPendingAssociatedFiles() {
  const { invoke } = await import('@tauri-apps/api/core')
  const files = await invoke<PendingOpenFile[]>('take_pending_open')
  for (const file of files) {
    await openFileFromPath(file.path)
  }
}

async function bindAssociatedFileOpen() {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  fileAssociationCleanup.value = await listen('open-associated-files', () => {
    void openPendingAssociatedFiles().catch((e) => console.error('[Open With]', e))
  })
  await openPendingAssociatedFiles()
}

async function bindWindowCloseIntercept() {
  if (!isTauri()) return
  const { listen } = await import('@tauri-apps/api/event')
  closeWindowCleanup.value = await listen('window-close-requested', async () => {
    if (closePromptOpen.value || closePromptBusy.value) return

    const hasDirty = tabs.value.some((t) => t.isDirty)
    if (!hasDirty) {
      const { exit } = await import('@tauri-apps/plugin-process')
      await exit(0)
      return
    }

    closePromptOpen.value = true
  })
}

async function closeWithDecision(decision: 'save' | 'discard') {
  closePromptOpen.value = false
  closePromptBusy.value = true

  try {
    if (decision === 'save') {
      const dirtyTabs = getTabsSnapshot().filter((tab) => tab.store.isDirty())
      try {
        await Promise.all(dirtyTabs.map((tab) => tab.store.saveFigFile()))
      } catch (error) {
        console.warn('[CloseRequested] Save before exit failed', error)
        closePromptOpen.value = true
        return
      }
      if (tabs.value.some((tab) => tab.isDirty)) {
        closePromptOpen.value = true
        return
      }
    }

    const { exit } = await import('@tauri-apps/plugin-process')
    await exit(0)
  } finally {
    closePromptBusy.value = false
  }
}

onMounted(async () => {
  try {
    const restored = await restoreRecoverySession(openFileInNewTab)
    if (restored.length > 0) {
      const active = activeTab.value
      if (active?.store) {
        active.store.state.actionToast =
          restored.length === 1
            ? dialogs.value.restoredUnsavedSessionOne({ name: restored[0] })
            : dialogs.value.restoredUnsavedSessionMany({ count: restored.length })
      }
    } else if (tabCount() === 0) {
      activeTabId.value = 'dashboard'
    }
  } catch (e) {
    console.warn('[Recovery]', e)
  }

  try {
    await bindWindowCloseIntercept()
  } catch (e) {
    console.error('[CloseRequested]', e)
  }

  try {
    const mcp = await spawnMCPIfNeeded()
    mcpCleanup.value = mcp?.disconnect ?? null
    const tauri = isTauri()
    if (import.meta.env.DEV || tauri) {
      automationCleanup.value = connectAutomation(getActiveStore, mcp?.authToken ?? null).disconnect
    }
  } catch (e) {
    console.warn('[MCP]', e)
  }

  try {
    await bindAssociatedFileOpen()
  } catch (e) {
    console.error('[Open With]', e)
  }
})

onUnmounted(() => {
  mcpCleanup.value?.()
  automationCleanup.value?.()
  fileAssociationCleanup.value?.()
  closeWindowCleanup.value?.()
})
</script>

<template>
  <div data-test-id="editor-root" class="flex h-screen w-screen flex-col">
    <DialogRoot v-model:open="closePromptOpen">
      <DialogPortal>
        <DialogOverlay :class="closePrompt.overlay" />
        <DialogContent
          data-test-id="close-changes-dialog"
          :class="closePrompt.content"
          :aria-describedby="undefined"
        >
          <div class="border-b border-border px-4 py-3">
            <DialogTitle class="text-sm font-semibold text-surface">
              {{ dialogs.unsavedChangesTitle }}
            </DialogTitle>
            <DialogDescription class="mt-1 text-xs text-muted">
              {{ dialogs.unsavedChangesDescription }}
            </DialogDescription>
          </div>
          <div class="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              class="rounded px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              :disabled="closePromptBusy"
              @click="closePromptOpen = false"
            >
              {{ dialogs.cancel }}
            </button>
            <button
              type="button"
              class="rounded border border-border px-3 py-1.5 text-xs text-surface transition-colors hover:bg-hover"
              :disabled="closePromptBusy"
              @click="closeWithDecision('discard')"
            >
              {{ dialogs.unsavedChangesDiscard }}
            </button>
            <button
              type="button"
              class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              :disabled="closePromptBusy"
              @click="closeWithDecision('save')"
            >
              {{ dialogs.unsavedChangesSave }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <PreferencesDialog />
    <PdfImportDialog />
    <IdmlImportDialog />
    <SafariBanner />
    <TabBar />

    <!-- Dashboard layout -->
    <DashboardView v-if="activeTabId === 'dashboard'" />

    <template v-else>
      <!-- Desktop layout -->
      <div
        v-if="!isMobile && showChrome && store.state.showUI"
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div data-test-id="editor-panels" class="relative flex min-h-0 flex-1 overflow-hidden">
          <PanelStack container-id="left" />
          <div class="relative flex min-w-0 flex-1">
            <!-- Keyed on the active tab. useCanvas binds its renderer and render
                 loop to whichever store was active when it mounted, so without a
                 remount a new or switched tab keeps the previous document's
                 surface: it never receives that tab's render requests and the
                 tab's own store is left with no renderer at all. The mobile,
                 collapsed and bare layouts below get the same remount from the
                 key on their branch. -->
            <EditorCanvas :key="activeTab?.id" />
            <Toolbar />
          </div>
          <PanelStack container-id="right" />
          <PanelOverlay />
          <div v-for="id in PANEL_IDS" :key="`parking-${id}`" :ref="setPanelHost(id, 'parking')" class="hidden" />
          <WorkspacePanel v-for="id in PANEL_IDS" :key="id" :panel-id="id" />
        </div>
      </div>

      <!-- Mobile layout -->
      <div
        v-else-if="isMobile && showChrome && store.state.showUI"
        :key="'mobile-' + activeTab?.id"
        class="flex flex-1 overflow-hidden"
      >
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <MobileHud />
          <Toolbar />
        </div>
        <MobileDrawer />
      </div>

      <!-- Collapsed UI (showUI=false) -->
      <div
        v-else-if="showChrome"
        :key="'collapsed-' + activeTab?.id"
        class="flex flex-1 overflow-hidden"
      >
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <div
            v-if="!isMobile"
            class="absolute top-7 left-7 z-10 flex items-center gap-2 rounded-lg border border-border bg-panel px-2 py-1 shadow-sm"
          >
            <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
            <span data-test-id="editor-document-name" class="text-xs text-surface">{{
              store.state.documentName
            }}</span>
            <Tip
              :label="
                dialogs.showUI({ shortcut: formatShortcut(appMenuShortcut('toggle-ui')) ?? '' })
              "
            >
              <button
                data-test-id="editor-show-ui"
                class="ml-1 flex size-6 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
                @click="store.state.showUI = true"
              >
                <icon-lucide-sidebar class="size-3.5" />
              </button>
            </Tip>
          </div>
        </div>
      </div>

      <!-- Bare canvas (no chrome, e.g. ?no-chrome) -->
      <div v-else :key="'bare-' + activeTab?.id" class="flex flex-1 overflow-hidden">
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
        </div>
      </div>
    </template>
  </div>
</template>
