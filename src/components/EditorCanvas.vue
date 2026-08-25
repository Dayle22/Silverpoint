<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X,
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y
} from '@open-pencil/core/constants'
import {
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'

import {
  toolCursor,
  useCanvas,
  useCanvasDrop,
  useCanvasInput,
  useCanvasVirtualReference,
  useI18n,
  useSelectionState,
  useTextEdit
} from '@open-pencil/vue'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import { useCollabInjected } from '@/app/collab/use'
import { getActiveEditorStoreOrNull, useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import { setCanvasSurfaceInfo } from '@/app/shell/hardware-acceleration'
import { prefersHardwareAcceleration } from '@/app/shell/preferences'
import IconLucideAlignHorizontalSpaceBetween from '~icons/lucide/align-horizontal-space-between'
import IconLucideAlignVerticalSpaceBetween from '~icons/lucide/align-vertical-space-between'
import IconLucidePanelBottom from '~icons/lucide/panel-bottom'
import IconLucidePanelLeft from '~icons/lucide/panel-left'
import IconLucidePanelRight from '~icons/lucide/panel-right'
import IconLucidePanelTop from '~icons/lucide/panel-top'
import CanvasMenu from './canvas/CanvasMenu.vue'
import SelectionActionBar from './canvas/SelectionActionBar.vue'
import NumberField from './inputs/NumberField.vue'

const store = useEditorStore()
// EditorView keys this component on the active tab, so one instance serves
// exactly one document for its whole lifetime. Anything that registers with the
// store on mount and deregisters on unmount must hold that tab's concrete store
// rather than the active-store proxy: unmount runs *after* the switch has
// already repointed the proxy, so a proxy-bound teardown would strip the
// renderer and event listeners off the newly activated tab and leave this one
// holding a destroyed SkiaRenderer. Plain reads elsewhere in this file stay on
// the proxy, which resolves to the same store.
const canvasEditor = getActiveEditorStoreOrNull() ?? store
const collab = useCollabInjected()
const { panels } = useI18n()
const sceneCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { updateCursor } = useCanvasCollaborationAwareness(canvasEditor, collab)
const { selectAtContextPoint } = createCanvasContextSelection(canvasRef, store)
const { selectedIds, hasSelection } = useSelectionState()

useCanvas(sceneCanvasRef, canvasEditor, {
  layer: 'scene',
  showRulers: false,
  accelerated: prefersHardwareAcceleration,
  onSurfaceInfo: setCanvasSurfaceInfo,
  onReady: fadeOutGlobalLoader
})
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  canvasEditor,
  {
    layer: 'overlays',
    accelerated: prefersHardwareAcceleration
  }
)
const {
  drag,
  cursorOverride,
  autoLayoutPaddingEdit,
  updateAutoLayoutPaddingEdit,
  commitAutoLayoutPaddingEdit,
  cancelAutoLayoutPaddingEdit,
  autoLayoutSpacingEdit,
  updateAutoLayoutSpacingEdit,
  commitAutoLayoutSpacingEdit,
  cancelAutoLayoutSpacingEdit
} = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  updateCursor
)

useTextEdit(canvasRef, store)
const { isDraggingOver } = useCanvasDrop(canvasRef, store)

const paddingSideIcons = {
  top: IconLucidePanelTop,
  right: IconLucidePanelRight,
  bottom: IconLucidePanelBottom,
  left: IconLucidePanelLeft
} satisfies Record<'top' | 'right' | 'bottom' | 'left', Component>

const paddingEditorAnchor = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  if (!edit) return null
  const node = store.graph.getNode(edit.nodeId)
  if (!node) return null
  const abs = store.graph.getAbsolutePosition(node.id)
  if (edit.side === 'top') return { x: abs.x + node.width / 2, y: abs.y + node.paddingTop / 2 }
  if (edit.side === 'bottom') {
    return { x: abs.x + node.width / 2, y: abs.y + node.height - node.paddingBottom / 2 }
  }
  if (edit.side === 'left') return { x: abs.x + node.paddingLeft / 2, y: abs.y + node.height / 2 }
  return { x: abs.x + node.width - node.paddingRight / 2, y: abs.y + node.height / 2 }
})
const paddingEditorReference = useCanvasVirtualReference(canvasRef, store, paddingEditorAnchor)
const paddingEditorIcon = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  return edit ? paddingSideIcons[edit.side] : IconLucidePanelTop
})

const spacingEditorAnchor = computed(() => {
  const edit = autoLayoutSpacingEdit.value
  if (!edit) return null
  const node = store.graph.getNode(edit.nodeId)
  if (!node) return null
  const abs = store.graph.getAbsolutePosition(node.id)
  const children = node.childIds
    .map((id) => store.graph.getNode(id))
    .filter(
      (child): child is NonNullable<typeof child> =>
        !!child && child.visible && child.layoutPositioning !== 'ABSOLUTE'
    )
  if (children.length >= 2) {
    const isRow = node.layoutMode === 'HORIZONTAL'
    const prev = children[0]
    const next = children[1]
    if (isRow) {
      const gapStart = prev.x + prev.width
      const gapEnd = next.x
      return {
        x: abs.x + (gapStart + gapEnd) / 2,
        y: abs.y + (node.paddingTop + (node.height - node.paddingBottom)) / 2
      }
    }
    const gapStart = prev.y + prev.height
    const gapEnd = next.y
    return {
      x: abs.x + (node.paddingLeft + (node.width - node.paddingRight)) / 2,
      y: abs.y + (gapStart + gapEnd) / 2
    }
  }
  return { x: abs.x + node.width / 2, y: abs.y + node.height / 2 }
})
const spacingEditorReference = useCanvasVirtualReference(canvasRef, store, spacingEditorAnchor)
const spacingEditorIcon = computed(() => {
  const edit = autoLayoutSpacingEdit.value
  if (!edit) return IconLucideAlignHorizontalSpaceBetween
  const node = store.graph.getNode(edit.nodeId)
  return node?.layoutMode === 'VERTICAL'
    ? IconLucideAlignHorizontalSpaceBetween
    : IconLucideAlignVerticalSpaceBetween
})

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))

// T-035: floating selection action bar. Shown only for a non-empty selection
// while the select tool is active, and hidden for the duration of any
// move/resize/rotate/radius drag so it never fights the gesture in progress.
const showSelectionActionBar = computed(
  () => hasSelection.value && store.state.activeTool === 'SELECT' && drag.value === null
)
const selectionBounds = computed(() => {
  if (!showSelectionActionBar.value) return null
  const nodes = [...selectedIds.value]
    .map((id) => store.graph.getNode(id))
    .filter((node): node is NonNullable<typeof node> => node != null)
  if (nodes.length === 0) return null
  return computeAbsoluteBounds(nodes, (id) => store.graph.getAbsolutePosition(id))
})
// Anchor for the bar's own popover: full screen-space bounding box of the selection
// so that Popper flips to the bottom edge of the box when near the canvas top edge.
const selectionActionBarReference = computed(() => {
  const bounds = selectionBounds.value
  const canvas = canvasRef.value
  if (!bounds || !canvas) return null

  const zoom = store.state.zoom
  const panX = store.state.panX
  const panY = store.state.panY

  return {
    getBoundingClientRect() {
      const rect = canvas.getBoundingClientRect()
      const x = rect.left + bounds.x * zoom + panX
      const y = rect.top + bounds.y * zoom + panY
      const width = bounds.width * zoom
      const height = bounds.height * zoom
      return new DOMRect(x, y, width, height)
    }
  }
})
// Anchor purely for the overflow menu's hit-test dispatch: the selection's
// own center, so opening the overflow re-affirms (rather than clears) the
// current selection. Deliberately NOT the button's screen position — see
// SelectionActionBar.vue's header comment for why.
const selectionCenterAnchor = computed(() => {
  const bounds = selectionBounds.value
  if (!bounds) return null
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
})
const selectionCenterReference = useCanvasVirtualReference(canvasRef, store, selectionCenterAnchor)

// The overflow button opens the canvas's one real ContextMenu by dispatching
// a synthetic `contextmenu` event on its trigger element, rather than owning
// a second ContextMenuRoot (reka-ui's ContextMenu does not support nesting —
// an earlier version of this feature that nested one broke the canvas's own
// right-click menu; see the regression this fixed in
// tests/e2e/context-menu/basic.spec.ts and SelectionActionBar.vue's header
// comment). Note `ContextMenuTrigger`'s `as-child` merges its own forwarded
// ref onto the slotted child, silently discarding any `ref` declared
// directly on that element in this template — `canvasRef.value.parentElement`
// (the canvas-area div is its direct, unconditional parent) sidesteps that.
//
// `@contextmenu="selectAtContextPoint"` on the same trigger also fires for
// this synthetic event, since it's just another listener on the same DOM
// node — `suppressReselectOnContextMenu` skips that pass-through so opening
// the overflow reads the existing selection as-is rather than re-deriving
// it via hit-testing, which — even aimed at the selection's own center —
// is a strictly riskier way to reach the same "keep what's selected" result.
const suppressReselectOnContextMenu = ref(false)

function openSelectionOverflowMenu() {
  const trigger = canvasRef.value?.parentElement
  const point = selectionCenterReference.value?.getBoundingClientRect()
  if (!trigger || !point) return
  suppressReselectOnContextMenu.value = true
  trigger.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y
    })
  )
  suppressReselectOnContextMenu.value = false
}

function handleCanvasContextMenu(event: MouseEvent) {
  if (suppressReselectOnContextMenu.value) return
  selectAtContextPoint(event)
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="handleCanvasContextMenu">
      <div
        data-test-id="canvas-area"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <canvas
          ref="sceneCanvasRef"
          data-test-id="scene-canvas-element"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 size-full outline-none"
        />
        <canvas
          ref="canvasRef"
          data-test-id="canvas-element"
          tabindex="0"
          role="application"
          :aria-label="panels.canvasArea"
          :style="{ cursor }"
          class="absolute inset-0 block size-full touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        />
        <Transition
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-150"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isDraggingOver"
            class="pointer-events-none absolute inset-0 z-40 border-2 border-dashed border-accent/60 bg-accent/5"
          />
        </Transition>
        <PopoverRoot :open="showSelectionActionBar">
          <PopoverPortal>
            <PopoverContent
              v-if="showSelectionActionBar && selectionActionBarReference"
              :reference="selectionActionBarReference"
              side="top"
              align="center"
              :side-offset="8"
              :collision-boundary="canvasRef"
              :collision-padding="{ top: 48, bottom: 8, left: 8, right: 8 }"
              :avoid-collisions="true"
              class="z-10"
              data-test-id="selection-action-bar-popover"
              @open-auto-focus.prevent
              @close-auto-focus.prevent
            >
              <SelectionActionBar @overflow="openSelectionOverflowMenu" />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <PopoverRoot :open="!!autoLayoutPaddingEdit">
          <PopoverPortal>
            <PopoverContent
              v-if="autoLayoutPaddingEdit && paddingEditorReference"
              :reference="paddingEditorReference"
              side="top"
              align="center"
              :side-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y"
              :align-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X"
              :collision-padding="8"
              class="z-50 w-20 rounded-md bg-panel p-1 shadow-lg"
              data-test-id="auto-layout-padding-editor"
              @keydown.escape.prevent="cancelAutoLayoutPaddingEdit"
              @open-auto-focus.prevent
            >
              <NumberField
                :model-value="autoLayoutPaddingEdit.value"
                :min="0"
                :step="1"
                data-test-id="auto-layout-padding-input"
                @update:model-value="updateAutoLayoutPaddingEdit"
                @commit="(value: number) => commitAutoLayoutPaddingEdit(value)"
                @editing-change="
                  (editing: boolean) =>
                    !editing &&
                    autoLayoutPaddingEdit &&
                    commitAutoLayoutPaddingEdit(autoLayoutPaddingEdit.value)
                "
              >
                <template #icon>
                  <component :is="paddingEditorIcon" class="size-3.5" />
                </template>
              </NumberField>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <PopoverRoot :open="!!autoLayoutSpacingEdit">
          <PopoverPortal>
            <PopoverContent
              v-if="autoLayoutSpacingEdit && spacingEditorReference"
              :reference="spacingEditorReference"
              side="top"
              align="center"
              :side-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y"
              :align-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X"
              :collision-padding="8"
              class="z-50 w-20 rounded-md bg-panel p-1 shadow-lg"
              data-test-id="auto-layout-spacing-editor"
              @keydown.escape.prevent="cancelAutoLayoutSpacingEdit"
              @open-auto-focus.prevent
            >
              <NumberField
                :model-value="autoLayoutSpacingEdit.value"
                :min="0"
                :step="1"
                data-test-id="auto-layout-spacing-input"
                @update:model-value="updateAutoLayoutSpacingEdit"
                @commit="(value: number) => commitAutoLayoutSpacingEdit(value)"
                @editing-change="
                  (editing: boolean) =>
                    !editing &&
                    autoLayoutSpacingEdit &&
                    commitAutoLayoutSpacingEdit(autoLayoutSpacingEdit.value)
                "
              >
                <template #icon>
                  <component :is="spacingEditorIcon" class="size-3.5" />
                </template>
              </NumberField>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
          <div
            v-if="store.state.loading"
            data-test-id="canvas-loading"
            class="absolute inset-0 z-50 flex items-center justify-center bg-canvas"
          >
            <icon-lucide-pencil-line class="size-8 text-surface opacity-45" />
            <div
              class="absolute bottom-1/2 left-1/2 h-0.5 w-25 -translate-x-1/2 translate-y-10 overflow-hidden rounded-full bg-surface/8"
            >
              <div
                class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-surface/25"
              />
            </div>
          </div>
        </Transition>
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
