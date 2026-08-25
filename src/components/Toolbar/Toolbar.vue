<script setup lang="ts">
import { computed } from 'vue'
import { EDITOR_TOOLS } from '@open-pencil/core/editor'

import DesktopToolbar from '@/components/Toolbar/DesktopToolbar.vue'
import MobileToolbar from '@/components/Toolbar/MobileToolbar.vue'
import { useToolbarActions } from '@/components/Toolbar/actions'
import { useActionToast } from '@/app/shell/toast/action'
import { isSimple } from '@/app/shell/capability'
import { simpleToolSet } from '@/components/Toolbar/capability-tools'
import { useEditorStore } from '@/app/editor/active-store'
import { toolIcons } from '@/app/editor/icons'
import { useMenuUI } from '@/components/ui/menu'
import {
  ToolbarRoot,
  useEditorCommands,
  useI18n,
  useToolbarState,
  useViewportKind
} from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { ToolbarActionItem } from '@/components/Toolbar/types'

const store = useEditorStore()
const { isMobile } = useViewportKind()
const { getCommand } = useEditorCommands()
const { showActionToast } = useActionToast()
const { menu, tools: toolTexts } = useI18n()

const toolLabels = computed<Record<Tool, string>>(() => ({
  SELECT: toolTexts.value.move,
  FRAME: toolTexts.value.frame,
  SECTION: toolTexts.value.section,
  SLICE: toolTexts.value.slice,
  RECTANGLE: toolTexts.value.rectangle,
  ELLIPSE: toolTexts.value.ellipse,
  LINE: toolTexts.value.line,
  POLYGON: toolTexts.value.polygon,
  STAR: toolTexts.value.star,
  PEN: toolTexts.value.pen,
  PENCIL: toolTexts.value.pencil,
  BRUSH: toolTexts.value.brush,
  TEXT: toolTexts.value.text,
  HAND: toolTexts.value.hand,
  SHAPE_BUILDER: toolTexts.value.shapeBuilder,
  BARCODE: toolTexts.value.barcode,
  BARCODE_EAN13: toolTexts.value.barcodeEan13
}))

const toolShortcuts: Record<Tool, string> = {
  SELECT: 'V',
  FRAME: 'F',
  SECTION: 'Shift+S',
  SLICE: 'S',
  RECTANGLE: 'R',
  ELLIPSE: 'O',
  LINE: 'L',
  POLYGON: '',
  STAR: '',
  PEN: 'P',
  PENCIL: 'N',
  BRUSH: 'B',
  TEXT: 'T',
  HAND: 'H',
  SHAPE_BUILDER: 'Shift+M',
  BARCODE: '',
  BARCODE_EAN13: ''
}

const flyoutMenuCls = useMenuUI({ content: 'min-w-32' })
const toolbarUi = { flyoutContent: flyoutMenuCls.content }
const { editActions, arrangeActions } = useToolbarActions({ store, getCommand, menu })

const { mobileCategory, slideDirection, hasPrev, hasNext, goPrev, goNext } = useToolbarState()

function onActionTap(item: ToolbarActionItem) {
  item.action()
  showActionToast(item.label)
}
</script>

<template>
  <ToolbarRoot :tools="isSimple ? simpleToolSet(EDITOR_TOOLS) : EDITOR_TOOLS" v-slot="{ tools, activeTool, actions }">
    <DesktopToolbar
      v-if="!isMobile"
      :tools="tools"
      :active-tool="activeTool"
      :tool-icons="toolIcons"
      :tool-labels="toolLabels"
      :tool-shortcuts="toolShortcuts"
      :ui="toolbarUi"
      @set-tool="actions.setTool"
    />

    <MobileToolbar
      v-else
      :tools="tools"
      :active-tool="activeTool"
      :tool-icons="toolIcons"
      :tool-labels="toolLabels"
      :tool-shortcuts="toolShortcuts"
      :ui="toolbarUi"
      :mobile-category="mobileCategory"
      :slide-direction="slideDirection"
      :has-prev="hasPrev"
      :has-next="hasNext"
      :edit-actions="editActions"
      :arrange-actions="arrangeActions"
      @set-tool="actions.setTool"
      @prev="goPrev"
      @next="goNext"
      @action="onActionTap"
    />
  </ToolbarRoot>
</template>
