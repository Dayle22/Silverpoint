<script setup lang="ts">
import { computed } from 'vue'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useUrlSearchParams } from '@vueuse/core'

import Tip from '@/components/ui/Tip.vue'
import AppMenu from '@/components/Shell/AppMenu.vue'
import CollabPanel from '@/components/CollabPanel/CollabPanel.vue'
import ZoomDropdown from '@/components/editor/ZoomDropdown.vue'
import { IS_MACOS, IS_TAURI } from '@/constants'
import { useTabsStore, createTab, reorderTabs } from '@/app/tabs'
import { useI18n, useFlatReorderDrag, useViewportKind } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import { useDocumentNameRename } from '@/app/shell/menu/document-name'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'

const { dialogs, menu: t } = useI18n()

const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()

// Same desktop-chrome gate EditorView.vue uses for its own desktop
// branch (isMobile / no-chrome / showUI). AppMenu previously only rendered
// inside that branch; now that TabBar mounts unconditionally above all four
// layout branches, TabBar must reproduce the gate itself so the app-icon
// menu button stays desktop-only (see T-042 Restrictions).
const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)
const { isMobile } = useViewportKind()

const modelValue = computed({
  get: () => activeTabId.value,
  set: (id: string) => switchTab(id)
})

const store = useEditorStore()
const { rename, editingName, startRename, commitRename } = useDocumentNameRename(store)

// The Tauri build keeps a native menu bar only on macOS, where it lives in the
// system menu bar. On Windows and Linux the in-window menu row is hidden (see
// install_app_menu in desktop/src/menu.rs), so this app-icon menu is the only
// route to File/Edit/View/... there, exactly as in the browser build.
const showAppMenu = computed(
  () => !(IS_TAURI && IS_MACOS) && !isMobile.value && showChrome && store.state.showUI
)

const { setupItem, draggingId, instruction, instructionTargetId } = useFlatReorderDrag({
  items: () => tabs.value,
  onMove: (sourceId, targetIndex) => reorderTabs(sourceId, targetIndex),
  axis: 'horizontal'
})

function onMiddleClick(e: MouseEvent, tabId: string) {
  if (e.button === 1) {
    e.preventDefault()
    closeTab(tabId)
  }
}

function onClose(e: MouseEvent, tabId: string) {
  e.stopPropagation()
  closeTab(tabId)
}

// Double-click-to-rename must only arm when the tab was ALREADY the active
// tab before this click gesture began - a click that itself switches tabs
// (Reka activates on mousedown) must not also start a rename. We snapshot
// "was active" on the first mousedown of a gesture and keep it across the
// second mousedown of the same double-click instead of re-sampling it,
// since by the second mousedown the first click has already activated the
// tab.
let renameGesture: { tabId: string; wasActive: boolean } | null = null
let renameGestureTimer: ReturnType<typeof setTimeout> | undefined

function onLabelMouseDown(tab: { id: string; isActive: boolean }) {
  if (!renameGesture || renameGesture.tabId !== tab.id) {
    renameGesture = { tabId: tab.id, wasActive: tab.isActive }
  }
  clearTimeout(renameGestureTimer)
  renameGestureTimer = setTimeout(() => {
    renameGesture = null
  }, 500)
}

function onLabelDblClick(tab: { id: string; isActive: boolean }) {
  const shouldRename = renameGesture?.tabId === tab.id && renameGesture.wasActive
  clearTimeout(renameGestureTimer)
  renameGesture = null
  if (shouldRename) startRename()
}
</script>

<template>
  <TabsRoot
    v-model="modelValue"
    activation-mode="automatic"
    class="scrollbar-none flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-panel"
  >
    <AppMenu v-if="showAppMenu" />
    <Tip label="Dashboard">
      <button
        data-test-id="tabbar-home"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted transition-colors hover:text-surface"
        :class="{ 'bg-panel text-surface': activeTabId === 'dashboard' }"
        aria-label="Dashboard"
        @click="activeTabId = 'dashboard'"
      >
        <icon-lucide-home class="size-3.5" />
      </button>
    </Tip>
    <TabsList class="flex h-full items-end">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :ref="
          (el) =>
            setupItem(editingName && tab.isActive ? null : (el as HTMLElement | null), () => tab)
        "
        :value="tab.id"
        data-test-id="tabbar-tab"
        class="group/tab relative flex h-full max-w-48 min-w-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent data-[state=active]:bg-panel data-[state=active]:text-surface data-[state=inactive]:text-muted data-[state=inactive]:hover:text-surface"
        :class="[
          draggingId === tab.id ? 'opacity-40' : '',
          instructionTargetId === tab.id && instruction?.operation === 'reorder-before'
            ? 'border-l-2 border-l-accent'
            : '',
          instructionTargetId === tab.id && instruction?.operation === 'reorder-after'
            ? 'border-r-2 border-r-accent'
            : ''
        ]"
        @mousedown="onMiddleClick($event, tab.id)"
      >
        <icon-lucide-file class="size-3 shrink-0 opacity-50" />
        <input
          v-if="editingName && tab.isActive"
          :ref="(el) => rename.focusInput(el as HTMLInputElement | null)"
          data-test-id="app-document-name-input"
          class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-xs text-surface outline-none"
          :value="store.state.documentName"
          @mousedown.stop
          @click.stop
          @blur="commitRename($event)"
          @keydown="rename.onKeydown"
        />
        <span
          v-else
          data-test-id="app-document-name"
          class="min-w-0 flex-1 truncate"
          @mousedown="onLabelMouseDown(tab)"
          @dblclick="onLabelDblClick(tab)"
          >{{ tab.name }}</span
        >
        <span
          v-if="tab.isDirty"
          data-test-id="tab-dirty-indicator"
          class="size-1.5 shrink-0 rounded-full bg-accent"
        />
        <Tip :label="dialogs.closeTab({ name: tab.name })">
          <button
            data-test-id="tabbar-close"
            class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-hover data-[state=active]:opacity-100"
            :class="tab.isActive ? 'opacity-100' : ''"
            :aria-label="dialogs.closeTab({ name: tab.name })"
            tabindex="-1"
            @click="onClose($event, tab.id)"
          >
            <icon-lucide-x class="size-3" />
          </button>
        </Tip>
      </TabsTrigger>
    </TabsList>
    <Tip :label="dialogs.newTab">
      <button
        data-test-id="tabbar-new"
        class="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:text-surface"
        :aria-label="dialogs.newTab"
        @click="createTab()"
      >
        <icon-lucide-plus class="size-3.5" />
      </button>
    </Tip>
    <div class="min-w-0 flex-1" />
    <div
      data-test-id="desktop-shell-chrome"
      class="flex shrink-0 items-center gap-2 self-center px-2"
    >
      <CollabPanel />
      <ZoomDropdown />
      <Tip :label="`${t.toggleUI} (${appMenuShortcutLabel('toggle-ui')})`">
        <button
          data-test-id="app-toggle-ui"
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="store.state.showUI = !store.state.showUI"
        >
          <icon-lucide-sidebar class="size-3.5" />
        </button>
      </Tip>
    </div>
  </TabsRoot>
</template>
