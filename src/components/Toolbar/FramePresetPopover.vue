<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import type { Component } from 'vue'

import {
  DEFAULT_DOCUMENT_UNITS,
  DEFAULT_FRAME_GUIDES,
  FRAME_PRESETS,
  formatUnitValue,
  setFrameGuideEdge,
  unitToPx,
  upsertFrameGuides,
  type DocumentUnits,
  type FramePresetDefinition
} from '@open-pencil/core/editor'
import { toolbarToolTestId, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import ToolButton from '@/components/Toolbar/ToolButton.vue'

const { icon, active } = defineProps<{
  icon: Component;
  active: boolean
}>()

const { panels } = useI18n()
const editor = useEditorStore()
const open = ref(false)
const customOpen = ref(false)
const width = ref('')
const height = ref('')
const validationMessage = ref('')
const customWidthInput = useTemplateRef<HTMLInputElement>('customWidthInput')
const printOrientation = ref<'portrait' | 'landscape' | null>(null)

const screenPresets = FRAME_PRESETS.filter((p) => p.group === 'screen')
const printPresets = FRAME_PRESETS.filter((p) => p.group === 'print')

function isValidDimension(value: string) {
  if (!/^\d+$/.test(value)) return false
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0
}

function close() {
  open.value = false
  customOpen.value = false
  validationMessage.value = ''
}

function openPopover() {
  editor.setTool('FRAME')
  open.value = true
  customOpen.value = false
  validationMessage.value = ''
  printOrientation.value = null
}

function setOrientation(orientation: 'portrait' | 'landscape') {
  printOrientation.value = printOrientation.value === orientation ? null : orientation
}

function getPresetDimensions(preset: FramePresetDefinition) {
  if (preset.group === 'screen') {
    return { width: preset.width, height: preset.height }
  }
  let w = preset.width
  let h = preset.height
  if (printOrientation.value === 'landscape') {
    w = Math.max(preset.width, preset.height)
    h = Math.min(preset.width, preset.height)
  } else if (printOrientation.value === 'portrait') {
    w = Math.min(preset.width, preset.height)
    h = Math.max(preset.width, preset.height)
  }
  return { width: w, height: h }
}

function formatPresetDimensions(preset: FramePresetDefinition): string {
  const docUnits = editor.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS
  const displayUnit = docUnits.unit === 'px' ? preset.unit : docUnits.unit
  const dpi = docUnits.dpi > 0 ? docUnits.dpi : 300
  const targetUnits: DocumentUnits = { unit: displayUnit, dpi }

  const { width: authoredW, height: authoredH } = getPresetDimensions(preset)
  const pxW = unitToPx(authoredW, { unit: preset.unit, dpi })
  const pxH = unitToPx(authoredH, { unit: preset.unit, dpi })

  const formattedW = formatUnitValue(pxW, targetUnits)
  const formattedH = formatUnitValue(pxH, targetUnits)

  return `${formattedW} × ${formattedH} ${displayUnit}`
}

function creationPoint(frameWidth: number, frameHeight: number) {
  const viewportCenter = editor.viewportCanvasCenter()
  const center = editor.screenToCanvas(viewportCenter.x, viewportCenter.y)
  const parentId = editor.state.enteredContainerId ?? editor.state.currentPageId
  const parentPosition = editor.graph.getAbsolutePosition(parentId)
  return {
    x: center.x - parentPosition.x - frameWidth / 2,
    y: center.y - parentPosition.y - frameHeight / 2,
    parentId
  }
}

function createFrame(
  frameWidth: number,
  frameHeight: number,
  preset?: FramePresetDefinition
) {
  const point = creationPoint(frameWidth, frameHeight)
  editor.undo.beginBatch('Create frame')
  const nodeId = editor.createShape(
    'FRAME',
    point.x,
    point.y,
    frameWidth,
    frameHeight,
    point.parentId
  )
  if (preset && (preset.margin || preset.bleed)) {
    const documentUnits = editor.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS
    const targetDpi = documentUnits.dpi > 0 ? documentUnits.dpi : 300
    let guides = structuredClone(DEFAULT_FRAME_GUIDES)
    if (preset.margin) {
      const marginPx = unitToPx(preset.margin.value, { unit: preset.margin.unit, dpi: targetDpi })
      guides.margins.enabled = true
      guides = setFrameGuideEdge(guides, 'margins', 'top', marginPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'margins', 'right', marginPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'margins', 'bottom', marginPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'margins', 'left', marginPx, frameWidth, frameHeight)
    }
    if (preset.bleed) {
      const bleedPx = unitToPx(preset.bleed.value, { unit: preset.bleed.unit, dpi: targetDpi })
      guides.bleed.enabled = true
      guides = setFrameGuideEdge(guides, 'bleed', 'top', bleedPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'bleed', 'right', bleedPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'bleed', 'bottom', bleedPx, frameWidth, frameHeight)
      guides = setFrameGuideEdge(guides, 'bleed', 'left', bleedPx, frameWidth, frameHeight)
    }
    const node = editor.graph.getNode(nodeId)
    if (node) {
      const pluginData = upsertFrameGuides(node.pluginData ?? [], guides)
      editor.updateNodeWithUndo(nodeId, { pluginData }, 'Set frame guides')
    }
  }
  editor.select([nodeId])
  editor.setTool('FRAME')
  editor.undo.commitBatch()
  editor.requestRender()
  close()
}

function choosePreset(preset: FramePresetDefinition) {
  const { width: authoredW, height: authoredH } = getPresetDimensions(preset)
  const docUnits = editor.state.documentUnits ?? DEFAULT_DOCUMENT_UNITS
  const dpi = docUnits.dpi > 0 ? docUnits.dpi : 300
  const pxW = unitToPx(authoredW, { unit: preset.unit, dpi })
  const pxH = unitToPx(authoredH, { unit: preset.unit, dpi })
  createFrame(pxW, pxH, preset)
}

function showCustom() {
  customOpen.value = true
  width.value = ''
  height.value = ''
  validationMessage.value = ''
  void nextTick(() => customWidthInput.value?.focus())
}

function cancelCustom() {
  close()
}

function applyCustom() {
  if (!isValidDimension(width.value) || !isValidDimension(height.value)) {
    validationMessage.value = panels.value.customFrameValidation
    return
  }
  createFrame(Number(width.value), Number(height.value))
}

watch(
  () => editor.state.activeTool,
  (tool, previousTool) => {
    if (tool === 'FRAME' && previousTool && previousTool !== 'FRAME') openPopover()
  }
)
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <ToolButton
        :data-test-id="toolbarToolTestId('FRAME')"
        :icon="icon"
        :active="active"
        @click="openPopover"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="center"
        :collision-padding="8"
        class="z-50 w-64 rounded-lg border border-border bg-panel p-1.5 shadow-lg"
        data-test-id="frame-preset-popover"
        @escape-key-down="close"
      >
        <template v-if="!customOpen">
          <div class="flex flex-col gap-0.5">
            <div
              data-test-id="frame-preset-group-screen"
              class="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted uppercase"
            >
              {{ panels.presetGroupScreen }}
            </div>
            <button
              v-for="preset in screenPresets"
              :key="preset.id"
              type="button"
              class="rounded-md px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
              :data-test-id="`frame-preset-${preset.width}x${preset.height}`"
              @click="choosePreset(preset)"
            >
              {{ panels[preset.labelKey as keyof typeof panels] }}
            </button>

            <div data-test-id="frame-preset-separator" class="mx-1 my-1 h-px bg-border" />

            <div
              data-test-id="frame-preset-group-print"
              class="flex items-center justify-between px-2 pt-1 pb-0.5"
            >
              <span class="text-[11px] font-semibold tracking-wider text-muted uppercase">
                {{ panels.presetGroupPrint }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="rounded-md px-1.5 py-0.5 text-[11px] transition-colors"
                  :class="printOrientation === 'portrait' ? 'bg-hover font-medium text-surface' : 'text-muted hover:text-surface'"
                  data-test-id="frame-preset-orientation-portrait"
                  @click="setOrientation('portrait')"
                >
                  {{ panels.portrait }}
                </button>
                <button
                  type="button"
                  class="rounded-md px-1.5 py-0.5 text-[11px] transition-colors"
                  :class="printOrientation === 'landscape' ? 'bg-hover font-medium text-surface' : 'text-muted hover:text-surface'"
                  data-test-id="frame-preset-orientation-landscape"
                  @click="setOrientation('landscape')"
                >
                  {{ panels.landscape }}
                </button>
              </div>
            </div>
            <button
              v-for="preset in printPresets"
              :key="preset.id"
              type="button"
              class="rounded-md px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
              :data-test-id="`frame-preset-${preset.id}`"
              @click="choosePreset(preset)"
            >
              {{ panels[preset.labelKey as keyof typeof panels] }} — {{ formatPresetDimensions(preset) }}
            </button>

            <div class="mx-1 my-1 h-px bg-border" />

            <button
              type="button"
              class="rounded-md px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
              data-test-id="frame-custom"
              @click="showCustom"
            >
              {{ panels.addCustom }}
            </button>
          </div>
        </template>

        <form v-else class="flex flex-col gap-2" @submit.prevent="applyCustom">
          <div class="text-xs font-medium text-surface">{{ panels.customFrame }}</div>
          <label class="flex items-center justify-between gap-2 text-xs text-muted">
            {{ panels.width }}
            <input
              v-model="width"
              type="text"
              inputmode="numeric"
              class="h-7 w-28 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="frame-custom-width"
              :aria-label="panels.width"
              ref="customWidthInput"
            />
          </label>
          <label class="flex items-center justify-between gap-2 text-xs text-muted">
            {{ panels.height }}
            <input
              v-model="height"
              type="text"
              inputmode="numeric"
              class="h-7 w-28 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="frame-custom-height"
              :aria-label="panels.height"
            />
          </label>
          <p v-if="validationMessage" data-test-id="frame-custom-validation" class="text-[11px] text-danger">
            {{ validationMessage }}
          </p>
          <div class="flex justify-end gap-1">
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
              data-test-id="frame-custom-cancel"
              @click="cancelCustom"
            >
              {{ panels.cancel }}
            </button>
            <button
              type="submit"
              class="rounded-md bg-accent px-2 py-1 text-xs text-white disabled:cursor-default disabled:opacity-50"
              data-test-id="frame-custom-apply"
              :disabled="!isValidDimension(width) || !isValidDimension(height)"
            >
              {{ panels.apply }}
            </button>
          </div>
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
