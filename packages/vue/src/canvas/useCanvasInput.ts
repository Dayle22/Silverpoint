import { useEventListener } from '@vueuse/core'
import { ref, watch, type Ref } from 'vue'

import { RULER_SIZE } from '@open-pencil/core/constants'
import { fitTextBoxToContent, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  handleBendHandleMove,
  handleNodeEditMouseUp,
  updateNodeEditHover
} from '#vue/canvas/node-edit-input/use'
import { handlePenDragMove, updatePenHover } from '#vue/canvas/pen-input/use'
import { createCanvasPointer } from '#vue/canvas/pointer/use'
import { createTextEditInput } from '#vue/canvas/text-edit/input'
import { handleToolMouseDown } from '#vue/canvas/tool-input/use'
import { createCanvasTransformInput } from '#vue/canvas/transform-input/use'
import { handleMarqueeUp } from '#vue/canvas/transform-input/marquee'
import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import { createClickCounter } from '#vue/shared/input/click-count'
import {
  cancelTextDraw,
  handleDrawMove,
  handleDrawUp,
  handleFreehandMove,
  handleFreehandUp,
  handleTextDrawMove,
  handleTextDrawUp
} from '#vue/shared/input/draw'
import type { HitTestFns } from '#vue/shared/input/select'

function unwrapPath<T>(path: T): T {
  if (!path) return path
  let current: unknown = path
  while (
    current &&
    typeof current === 'object' &&
    '__v_raw' in (current as { __v_raw?: unknown })
  ) {
    current = (current as { __v_raw?: unknown }).__v_raw
  }
  return current as T
}

function handleShapeBuilderHover(editor: Editor, cx: number, cy: number, altKey: boolean): void {
  if (editor.state.activeTool !== 'SHAPE_BUILDER' || !editor.state.shapeBuilderState?.regions)
    return
  editor.state.shapeBuilderState.isDeleteMode = altKey
  for (const region of editor.state.shapeBuilderState.regions) {
    region.hovered = Boolean(unwrapPath(region.path)?.contains(cx, cy))
  }
}

function handleShapeBuilderDrag(
  editor: Editor,
  d: Extract<DragState, { type: 'shape-builder-drag' }>,
  cx: number,
  cy: number,
  altKey: boolean
): void {
  d.isDeleteMode = altKey
  if (!editor.state.shapeBuilderState?.regions) return
  editor.state.shapeBuilderState.isDeleteMode = altKey
  for (const region of editor.state.shapeBuilderState.regions) {
    if (unwrapPath(region.path)?.contains(cx, cy)) {
      d.draggedRegionIds.add(region.id)
      region.dragged = true
    }
  }
}

function getAutoLayoutHoverCursor(
  hover: ReturnType<typeof resolveAutoLayoutHover>,
  node: SceneNode | null | undefined
): string | null {
  if (!hover || !node) return null
  if (hover.kind === 'padding' || hover.kind === 'padding-value') {
    if (hover.side === 'top' || hover.side === 'bottom') return 'ns-resize'
    if (hover.side === 'left' || hover.side === 'right') return 'ew-resize'
    return null
  }
  if (hover.kind === 'spacing' || hover.kind === 'spacing-value') {
    if (node.layoutMode === 'VERTICAL') return 'ns-resize'
    if (node.layoutMode === 'HORIZONTAL') return 'ew-resize'
    return null
  }
  return null
}

function handleSelectHover(
  editor: Editor,
  cx: number,
  cy: number,
  hitFns: HitTestFns,
  cursorOverride: Ref<string | null>
): void {
  if (editor.state.activeTool !== 'SELECT') return
  const hover = resolveAutoLayoutHover(cx, cy, editor)
  const node = hover ? editor.graph.getNode(hover.nodeId) : null
  const hoverCursor = updateHoverCursor(cx, cy, editor, hitFns)
  cursorOverride.value = hoverCursor ?? getAutoLayoutHoverCursor(hover, node)
  editor.setAutoLayoutHover(hover)
}
import { handleMoveMove, handleMoveUp } from '#vue/shared/input/move'
import { handleNodeEditMove } from '#vue/shared/input/node-edit'
import {
  findPageGuideAtScreenPoint,
  getPageGuideAxisFromRuler,
  getPageGuideOffset
} from '#vue/shared/input/page-guides'
import { setupPanZoom } from '#vue/shared/input/pan-zoom'
import {
  applyGradientDrag,
  cancelGradientDrag,
  commitGradientDrag
} from '#vue/shared/input/gradient'
import {
  applyProgressiveBlurDrag,
  cancelProgressiveBlurDrag,
  commitProgressiveBlurDrag
} from '#vue/shared/input/progressive-blur'
import { applyRadiusDrag, cancelRadiusDrag, commitRadiusDrag } from '#vue/shared/input/radius'
import { applyResize, commitResizePreview, tryStartResize } from '#vue/shared/input/resize'
import { updateHoverCursor } from '#vue/shared/input/select'
import { useSpaceHeld } from '#vue/shared/input/space-key'
import {
  applySpacingDrag,
  cancelSpacingDrag,
  commitSpacingDrag,
  tryStartSpacingDrag
} from '#vue/shared/input/spacing-drag'
import type { DragPageGuide, DragState } from '#vue/shared/input/types'

/**
 * Wires pointer and mouse interaction to an OpenPencil canvas.
 *
 * This composable coordinates selection, dragging, resizing, rotation,
 * panning, drawing tools, scoped hit testing, and text-edit interaction.
 * It is primarily intended for editor shell components that own the canvas.
 */
export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null,
  onCursorMove?: (cx: number, cy: number) => void
) {
  const drag = ref<DragState | null>(null)
  const cursorOverride = ref<string | null>(null)
  const autoLayoutPaddingEdit = ref<{
    nodeId: string
    side: 'top' | 'right' | 'bottom' | 'left'
    value: number
    previous: number
    previousOpposite: number
    paired: boolean
  } | null>(null)
  const autoLayoutSpacingEdit = ref<{
    nodeId: string
    value: number
    previous: number
  } | null>(null)
  const selectedIdsBeforeClickSequence = ref<ReadonlySet<string>>(new Set())
  const spaceHeld = useSpaceHeld()
  const { recordClick, getClickCount } = createClickCounter()

  const { getCoords, canvasToLocal, hitTestInScope, hitFns } = createCanvasPointer(
    canvasRef,
    editor,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  )

  function setDrag(d: DragState) {
    drag.value = d
    if (d.type === 'radius' || d.type === 'progressive-blur' || d.type === 'gradient-handle') {
      cursorOverride.value = 'grabbing'
    }
  }

  const { handleTextEditClick, onDblClick: onTextDblClick } = createTextEditInput({
    editor,
    getCoords,
    hitTestInScope,
    hitTestSectionTitle,
    hitTestComponentLabel,
    getClickCount,
    wasSelectedBeforeClickSequence: (id) => selectedIdsBeforeClickSequence.value.has(id),
    setDrag
  })

  const {
    tryStartRotation,
    handlePanMove,
    handleRotateMove,
    handleTextSelectMove,
    handleMarqueeMove
  } = createCanvasTransformInput(editor, canvasToLocal, setDrag)

  function paddingValue(node: SceneNode, side: 'top' | 'right' | 'bottom' | 'left') {
    if (side === 'top') return node.paddingTop
    if (side === 'right') return node.paddingRight
    if (side === 'bottom') return node.paddingBottom
    return node.paddingLeft
  }

  function paddingKey(side: 'top' | 'right' | 'bottom' | 'left') {
    if (side === 'top') return 'paddingTop' as const
    if (side === 'right') return 'paddingRight' as const
    if (side === 'bottom') return 'paddingBottom' as const
    return 'paddingLeft' as const
  }

  function oppositePaddingSide(
    side: 'top' | 'right' | 'bottom' | 'left'
  ): 'top' | 'right' | 'bottom' | 'left' {
    if (side === 'top') return 'bottom'
    if (side === 'bottom') return 'top'
    if (side === 'left') return 'right'
    return 'left'
  }

  function startAutoLayoutPaddingEdit(e: MouseEvent): boolean {
    const { cx, cy } = getCoords(e)
    const hover = resolveAutoLayoutHover(cx, cy, editor)
    if (hover?.kind !== 'padding' && hover?.kind !== 'padding-value') return false
    if (!hover.side) return false
    const node = editor.graph.getNode(hover.nodeId)
    if (!node) return false
    const value = paddingValue(node, hover.side)
    const oppSide = oppositePaddingSide(hover.side)
    const previousOpposite = paddingValue(node, oppSide)
    autoLayoutPaddingEdit.value = {
      nodeId: node.id,
      side: hover.side,
      value,
      previous: value,
      previousOpposite,
      paired: e.altKey
    }
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  function updateAutoLayoutPaddingEdit(value: number) {
    const edit = autoLayoutPaddingEdit.value
    if (!edit || !Number.isFinite(value)) return
    const next = Math.max(0, value)
    autoLayoutPaddingEdit.value = { ...edit, value: next }
    if (edit.paired) {
      if (edit.side === 'top' || edit.side === 'bottom') {
        editor.updateNode(edit.nodeId, { paddingTop: next, paddingBottom: next })
      } else {
        editor.updateNode(edit.nodeId, { paddingLeft: next, paddingRight: next })
      }
    } else {
      editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: next })
    }
  }

  function commitAutoLayoutPaddingEdit(value: number) {
    const edit = autoLayoutPaddingEdit.value
    if (!edit || !Number.isFinite(value)) {
      autoLayoutPaddingEdit.value = null
      return
    }
    const next = Math.max(0, value)
    if (edit.paired) {
      if (edit.side === 'top' || edit.side === 'bottom') {
        editor.updateNode(edit.nodeId, {
          paddingTop: edit.side === 'top' ? edit.previous : edit.previousOpposite,
          paddingBottom: edit.side === 'bottom' ? edit.previous : edit.previousOpposite
        })
        editor.updateNodeWithUndo(
          edit.nodeId,
          { paddingTop: next, paddingBottom: next },
          'Change vertical padding'
        )
      } else {
        editor.updateNode(edit.nodeId, {
          paddingLeft: edit.side === 'left' ? edit.previous : edit.previousOpposite,
          paddingRight: edit.side === 'right' ? edit.previous : edit.previousOpposite
        })
        editor.updateNodeWithUndo(
          edit.nodeId,
          { paddingLeft: next, paddingRight: next },
          'Change horizontal padding'
        )
      }
    } else {
      editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: edit.previous })
      editor.updateNodeWithUndo(edit.nodeId, { [paddingKey(edit.side)]: next }, 'Update padding')
    }
    autoLayoutPaddingEdit.value = null
  }

  function cancelAutoLayoutPaddingEdit() {
    const edit = autoLayoutPaddingEdit.value
    if (edit) {
      if (edit.paired) {
        if (edit.side === 'top' || edit.side === 'bottom') {
          editor.updateNode(edit.nodeId, {
            paddingTop: edit.side === 'top' ? edit.previous : edit.previousOpposite,
            paddingBottom: edit.side === 'bottom' ? edit.previous : edit.previousOpposite
          })
        } else {
          editor.updateNode(edit.nodeId, {
            paddingLeft: edit.side === 'left' ? edit.previous : edit.previousOpposite,
            paddingRight: edit.side === 'right' ? edit.previous : edit.previousOpposite
          })
        }
      } else {
        editor.updateNode(edit.nodeId, { [paddingKey(edit.side)]: edit.previous })
      }
    }
    autoLayoutPaddingEdit.value = null
  }

  function startAutoLayoutSpacingEdit(e: MouseEvent): boolean {
    const { cx, cy } = getCoords(e)
    const hover = resolveAutoLayoutHover(cx, cy, editor)
    if (hover?.kind !== 'spacing' && hover?.kind !== 'spacing-value') return false
    const node = editor.graph.getNode(hover.nodeId)
    if (!node) return false
    const value = node.itemSpacing
    autoLayoutSpacingEdit.value = {
      nodeId: node.id,
      value,
      previous: value
    }
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  function updateAutoLayoutSpacingEdit(value: number) {
    const edit = autoLayoutSpacingEdit.value
    if (!edit || !Number.isFinite(value)) return
    const next = Math.max(0, value)
    autoLayoutSpacingEdit.value = { ...edit, value: next }
    editor.updateNode(edit.nodeId, { itemSpacing: next })
  }

  function commitAutoLayoutSpacingEdit(value: number) {
    const edit = autoLayoutSpacingEdit.value
    if (!edit || !Number.isFinite(value)) {
      autoLayoutSpacingEdit.value = null
      return
    }
    const next = Math.max(0, value)
    editor.updateNode(edit.nodeId, { itemSpacing: edit.previous })
    editor.updateNodeWithUndo(edit.nodeId, { itemSpacing: next }, 'Update item spacing')
    autoLayoutSpacingEdit.value = null
  }

  function cancelAutoLayoutSpacingEdit() {
    const edit = autoLayoutSpacingEdit.value
    if (edit) editor.updateNode(edit.nodeId, { itemSpacing: edit.previous })
    autoLayoutSpacingEdit.value = null
  }

  function startPageGuideDrag(sx: number, sy: number, event: MouseEvent): boolean {
    if (!editor.state.showRulers) return false
    const guides = editor.getPageGuides()
    let axis = getPageGuideAxisFromRuler(sx, sy, RULER_SIZE)
    let index: number | null = null
    let created = false

    if (axis) {
      const offset = getPageGuideOffset(
        axis,
        sx,
        sy,
        axis === 'X' ? editor.state.panX : editor.state.panY,
        editor.state.zoom
      )
      editor.addPageGuide(axis, offset)
      index = editor.getPageGuides().length - 1
      created = true
    } else {
      index = findPageGuideAtScreenPoint(
        guides,
        'X',
        sx,
        sy,
        editor.state.panX,
        editor.state.panY,
        editor.state.zoom
      )
      axis = index === null ? 'Y' : 'X'
      if (index === null) {
        index = findPageGuideAtScreenPoint(
          guides,
          'Y',
          sx,
          sy,
          editor.state.panX,
          editor.state.panY,
          editor.state.zoom
        )
      }
    }

    if (index === null) return false
    const guide = editor.getPageGuides().at(index)
    if (!guide) return false
    drag.value = {
      type: 'page-guide',
      axis,
      index,
      previousOffset: guide.offset,
      created
    }
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  function finishPageGuideDrag(d: DragPageGuide, event?: MouseEvent) {
    const release = event ? getCoords(event) : null
    if (release && getPageGuideAxisFromRuler(release.sx, release.sy, RULER_SIZE)) {
      if (d.created) editor.undo.undo()
      else editor.removePageGuide(d.index)
      return
    }
    if (release) {
      const offset = getPageGuideOffset(
        d.axis,
        release.sx,
        release.sy,
        d.axis === 'X' ? editor.state.panX : editor.state.panY,
        editor.state.zoom
      )
      editor.setPageGuideOffset(d.index, offset)
    }
    editor.commitPageGuideMove(d.index, d.previousOffset)
  }

  function cancelPageGuideDrag(d: DragPageGuide) {
    if (d.created) editor.undo.undo()
    else editor.setPageGuideOffset(d.index, d.previousOffset)
  }

  function onDblClick(e: MouseEvent) {
    const { cx, cy } = getCoords(e)
    const resizeHit = tryStartResize(cx, cy, editor)
    if (resizeHit) {
      const node = editor.graph.getNode(resizeHit.nodeId)
      if (node?.type === 'TEXT') {
        fitTextBoxToContent(resizeHit.nodeId, editor)
        return
      }
    }

    if (startAutoLayoutPaddingEdit(e)) return
    if (startAutoLayoutSpacingEdit(e)) return
    onTextDblClick(e)
  }

  function onMouseDown(e: MouseEvent) {
    const paddingEdit = autoLayoutPaddingEdit.value
    if (paddingEdit) {
      commitAutoLayoutPaddingEdit(paddingEdit.value)
    }
    const spacingEdit = autoLayoutSpacingEdit.value
    if (spacingEdit) {
      commitAutoLayoutSpacingEdit(spacingEdit.value)
    }
    if (!editor.state.editingTextId) canvasRef.value?.focus()
    editor.setHoveredNode(null)
    const { sx, sy, cx, cy } = getCoords(e)

    if (startPageGuideDrag(sx, sy, e)) return

    if (editor.state.activeTool === 'SHAPE_BUILDER' && editor.state.shapeBuilderState?.regions) {
      const hitRegion = editor.state.shapeBuilderState.regions.find((r) =>
        unwrapPath(r.path)?.contains(cx, cy)
      )
      if (hitRegion) {
        hitRegion.dragged = true
        setDrag({
          type: 'shape-builder-drag',
          draggedRegionIds: new Set([hitRegion.id]),
          isDeleteMode: e.altKey
        })
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }

    const spacingDrag = tryStartSpacingDrag(cx, cy, editor)
    if (spacingDrag) {
      setDrag(spacingDrag)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    const selectedIdsBeforeMouseDown = new Set(editor.state.selectedIds)
    const clickCount = recordClick(sx, sy)
    if (clickCount === 1) selectedIdsBeforeClickSequence.value = selectedIdsBeforeMouseDown
    handleToolMouseDown({
      event: e,
      cx,
      cy,
      sx,
      sy,
      editor,
      hitFns,
      cursorOverride,
      setDrag,
      tryStartRotation,
      handleTextEditClick
    })
  }

  /**
   * Tail of the drag dispatch: the control handles drawn inside a node's
   * bounds, and the marquee every unclaimed drag falls through to.
   */
  function handleRemainingDragMove(d: DragState, cx: number, cy: number, e: MouseEvent): void {
    if (d.type === 'radius') {
      applyRadiusDrag(d, cx, cy, editor)
      return
    }
    if (d.type === 'progressive-blur') {
      applyProgressiveBlurDrag(d, cx, cy, editor, e.shiftKey)
      return
    }
    if (d.type === 'gradient-handle') {
      applyGradientDrag(d, cx, cy, editor, e.shiftKey)
      return
    }
    if (d.type === 'marquee') handleMarqueeMove(d, cx, cy)
  }

  function onMouseMove(e: MouseEvent) {
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    if (!drag.value) {
      const { cx, cy } = getCoords(e)
      updatePenHover(cx, cy, editor, cursorOverride)
      updateNodeEditHover(editor, cx, cy)
      handleShapeBuilderHover(editor, cx, cy, e.altKey)
      handleSelectHover(editor, cx, cy, hitFns, cursorOverride)
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'shape-builder-drag') {
      const { cx, cy } = getCoords(e)
      handleShapeBuilderDrag(editor, d, cx, cy, e.altKey)
      return
    }

    if (d.type === 'pan') {
      handlePanMove(d, e)
      return
    }

    const { sx, sy, cx, cy } = getCoords(e)

    if (d.type === 'spacing-drag') {
      applySpacingDrag(d, cx, cy, editor)
      return
    }
    if (d.type === 'rotate') {
      handleRotateMove(d, cx, cy, e.shiftKey)
      return
    }
    if (d.type === 'move') {
      handleMoveMove(d, cx, cy, sx, sy, editor, e.ctrlKey)
      return
    }
    if (d.type === 'page-guide') {
      const offset = getPageGuideOffset(
        d.axis,
        sx,
        sy,
        d.axis === 'X' ? editor.state.panX : editor.state.panY,
        editor.state.zoom
      )
      editor.setPageGuideOffset(d.index, offset)
      return
    }
    if (d.type === 'text-select') {
      handleTextSelectMove(cx, cy)
      return
    }
    if (d.type === 'resize') {
      applyResize(d, cx, cy, e.shiftKey, editor, e.ctrlKey)
      return
    }
    if (d.type === 'pen-drag') {
      handlePenDragMove(d, cx, cy, spaceHeld.value, e, editor)
      return
    }

    if (d.type === 'freehand') {
      handleFreehandMove(d, cx, cy, e)
      return
    }

    if (d.type === 'edit-node' || d.type === 'edit-handle') {
      handleNodeEditMove(d, cx, cy, editor, e.altKey, e.metaKey || e.ctrlKey, e.shiftKey)
      return
    }

    if (d.type === 'bend-handle') {
      handleBendHandleMove(d, cx, cy, e, editor)
      return
    }

    if (d.type === 'text-draw') {
      handleTextDrawMove(d, cx, cy, sx, sy, e.shiftKey, editor)
      return
    }

    if (d.type === 'draw') {
      handleDrawMove(d, cx, cy, e.shiftKey, editor)
      return
    }

    handleRemainingDragMove(d, cx, cy, e)
  }

  function onMouseUp(e?: MouseEvent) {
    if (!drag.value) return
    const d = drag.value

    if (handleNodeEditMouseUp(drag, editor)) return

    if (d.type === 'shape-builder-drag') {
      editor.commitShapeBuilder(d.draggedRegionIds, d.isDeleteMode)
      drag.value = null
      cursorOverride.value = null
      return
    }

    if (d.type === 'move') handleMoveUp(d, editor)
    else if (d.type === 'page-guide') finishPageGuideDrag(d, e)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') commitResizePreview(d, editor)
    else if (d.type === 'radius') commitRadiusDrag(d, editor)
    else if (d.type === 'progressive-blur') commitProgressiveBlurDrag(d, editor)
    else if (d.type === 'gradient-handle') commitGradientDrag(d, editor)
    else if (d.type === 'spacing-drag') commitSpacingDrag(d, editor)
    else if (d.type === 'pen-drag') {
      const penState = editor.state.penState as
        | (typeof editor.state.penState & {
            pendingClose?: boolean
          })
        | null
      if (penState?.pendingClose) {
        editor.penCommit(true)
      }
      drag.value = null
      return
    } else if (d.type === 'freehand') {
      handleFreehandUp(d, editor)
    } else if (d.type === 'rotate') {
      const preview = editor.state.rotationPreview
      if (preview) {
        editor.updateNode(d.nodeId, { rotation: preview.angle })
        editor.commitRotation(d.nodeId, d.origRotation)
      }
      editor.setRotationPreview(null)
    } else if (d.type === 'text-draw') handleTextDrawUp(d, editor)
    else if (d.type === 'draw') handleDrawUp(d, editor)
    else if (d.type === 'marquee') handleMarqueeUp(editor, e)

    drag.value = null
    cursorOverride.value = null
  }

  watch(
    () => [editor.state.activeTool, editor.state.selectedIds] as const,
    ([tool]) => {
      if (tool === 'SHAPE_BUILDER') {
        editor.initializeShapeBuilder()
      } else {
        editor.clearShapeBuilder()
      }
    },
    { immediate: true }
  )

  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'pointerdown', onMouseDown)
  useEventListener(canvasRef, 'pointermove', onMouseMove)
  useEventListener(canvasRef, 'pointerup', onMouseUp)
  useEventListener(canvasRef, 'mouseleave', () => {
    if (!drag.value) {
      editor.setHoveredNode(null)
    }
  })
  useEventListener(window, 'pointerup', (event) => {
    if (drag.value) onMouseUp(event)
  })
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.code !== 'Escape') return
    if (drag.value?.type === 'shape-builder-drag') {
      if (editor.state.shapeBuilderState?.regions) {
        for (const r of editor.state.shapeBuilderState.regions) {
          r.dragged = false
        }
      }
      drag.value = null
      cursorOverride.value = null
      e.preventDefault()
      return
    }
    if (!drag.value) return
    if (drag.value.type === 'radius') cancelRadiusDrag(drag.value, editor)
    else if (drag.value.type === 'progressive-blur')
      cancelProgressiveBlurDrag(drag.value, editor)
    else if (drag.value.type === 'gradient-handle')
      cancelGradientDrag(drag.value, editor)
    else if (drag.value.type === 'spacing-drag') cancelSpacingDrag(drag.value, editor)
    else if (drag.value.type === 'page-guide') cancelPageGuideDrag(drag.value)
    else if (drag.value.type === 'text-draw') cancelTextDraw(drag.value, editor)
    else return
    drag.value = null
    cursorOverride.value = null
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  })

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp)
  return {
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
  }
}
