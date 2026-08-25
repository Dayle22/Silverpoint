<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import {
  DPI_PRESETS,
  normalizeDocumentUnits,
  parseDocumentUnits,
  upsertDocumentUnits,
  type DocumentUnit,
  type DocumentUnits
} from '@open-pencil/core/editor'
import type { Color, Fill } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const editor = useEditorStore()
const { panels } = useI18n()

const pageColor = computed(() => editor.state.pageColor)
const pageFill = computed<Fill>(() => ({
  type: 'SOLID',
  color: pageColor.value,
  opacity: 1,
  visible: true
}))

const rootNode = computed(() => {
  void editor.state.sceneVersion
  return editor.graph.getNode(editor.graph.rootId)
})

const documentUnits = computed<DocumentUnits>(() => {
  void editor.state.sceneVersion
  return parseDocumentUnits(rootNode.value?.pluginData ?? [])
})

const currentUnit = computed({
  get: () => documentUnits.value.unit,
  set: (nextUnit: DocumentUnit) => {
    writeUnitsWithUndo(
      { unit: nextUnit, dpi: documentUnits.value.dpi },
      'Change document unit'
    )
  }
})

const currentDpi = computed(() => documentUnits.value.dpi)

const UNIT_OPTIONS: { value: DocumentUnit; label: string }[] = [
  { value: 'px', label: 'px' },
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'in' }
]

const dpiMenuOpen = ref(false)
const menuCls = useMenuUI({ content: 'min-w-[6rem]' })
const itemCls = menuItem({ justify: 'between' })

function writeUnitsWithUndo(next: DocumentUnits, label: string) {
  const root = rootNode.value
  if (!root) return
  const normalized = normalizeDocumentUnits(next)
  const pluginData = upsertDocumentUnits(root.pluginData, normalized)
  editor.state.documentUnits = normalized
  editor.updateNodeWithUndo(root.id, { pluginData }, label)
  editor.requestRender()
}

function updatePageAlpha(alpha: number) {
  editor.setPageColor({ ...pageColor.value, a: alpha })
}

function updatePageColor(color: Color) {
  editor.setPageColor(color)
}

function previewDpi(dpi: number) {
  const normalized = normalizeDocumentUnits({ unit: documentUnits.value.unit, dpi })
  editor.state.documentUnits = normalized
  editor.requestRender()
}

function commitDpi(dpi: number) {
  writeUnitsWithUndo({ unit: documentUnits.value.unit, dpi }, 'Change document DPI')
}

function selectDpiPreset(preset: number) {
  dpiMenuOpen.value = false
  writeUnitsWithUndo({ unit: documentUnits.value.unit, dpi: preset }, 'Change document DPI')
}
</script>

<template>
  <PanelSection :label="panels.page">
    <PaintField
      :opacity="pageColor.a"
      :opacity-label="panels.opacity"
      @update:opacity="updatePageAlpha"
    >
      <template #preview>
        <ColorPicker :color="pageColor" @update="updatePageColor">
          <template #trigger>
            <button
              type="button"
              :aria-label="panels.pageBackground"
              class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            >
              <FillSwatch :fill="pageFill" class="size-full" />
            </button>
          </template>
        </ColorPicker>
      </template>
      <template #value>
        <PaintValue :color="pageColor" :label="panels.pageBackground" @update="updatePageColor" />
      </template>
    </PaintField>

    <PanelGrid columns="two" class="mt-panel">
      <PanelFieldGroup :label="panels.unit">
        <AppSelect
          v-model="currentUnit"
          :options="UNIT_OPTIONS"
          :aria-label="panels.unit"
          data-property="document-unit"
        />
      </PanelFieldGroup>
      <PanelFieldGroup :label="panels.dpi">
        <NumberField
          :model-value="currentDpi"
          :min="1"
          :max="2400"
          :aria-label="panels.dpi"
          data-property="document-dpi"
          @update:model-value="previewDpi"
          @commit="(v: number) => commitDpi(v)"
        >
          <template #suffix>
            <DropdownMenuRoot v-model:open="dpiMenuOpen">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  :aria-label="panels.dpiPresets"
                  class="flex h-full items-center px-1 text-muted hover:text-surface"
                  @pointerdown.stop
                >
                  <icon-lucide-chevron-down class="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  :side-offset="4"
                  :class="menuCls.content"
                >
                  <DropdownMenuItem
                    v-for="preset in DPI_PRESETS"
                    :key="preset"
                    :class="itemCls"
                    @select="selectDpiPreset(preset)"
                  >
                    <span class="text-[11px]">{{ preset }} DPI</span>
                    <icon-lucide-check
                      v-if="currentDpi === preset"
                      class="size-3 text-accent"
                    />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </template>
        </NumberField>
      </PanelFieldGroup>
    </PanelGrid>
  </PanelSection>
</template>
