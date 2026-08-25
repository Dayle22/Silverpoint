import type { Ref } from 'vue'

import { PEN_CLOSE_THRESHOLD } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import { constrainToAngleStep } from '@open-pencil/core/vector'

import { createPenDrag, handlePenDragMove } from '#vue/canvas/pen-input/drag'
import {
  getNodeEditState,
  handlePenNodeEditDown,
  hitTestEditSegment,
  hitTestEditVertex,
  isEndpoint,
  NODE_HIT_THRESHOLD
} from '#vue/shared/input/node-edit'
import type { DragState } from '#vue/shared/input/types'

type SetDrag = (drag: DragState) => void

type PenLinkEditor = Partial<{
  penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
  penLinkToEndpoint: (nodeId: string, endpointVertexIndex: number) => void
}>

const CLOSE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M10 3V17M3 10H17" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <path d="M10 4V16M4 10H16" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
  <circle cx="17" cy="17" r="3.5" stroke="#000000" stroke-width="1.5" fill="#ffffff"/>
</svg>`

const CONTINUE_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M10 3V17M3 10H17" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <path d="M10 4V16M4 10H16" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
  <path d="M14 20L20 14" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M14 20L20 14" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

const INSERT_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M10 3V17M3 10H17" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <path d="M10 4V16M4 10H16" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
  <path d="M17 14V20M14 17H20" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M17 14V20M14 17H20" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

export const CLOSE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CLOSE_CURSOR_SVG)}") 10 10, crosshair`
export const CONTINUE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CONTINUE_CURSOR_SVG)}") 10 10, crosshair`
export const INSERT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(INSERT_CURSOR_SVG)}") 10 10, crosshair`

/**
 * Hit-test the "continue" endpoint affordance: either the currently
 * node-edited path's own open endpoint, or - while the pen is idle with no
 * in-progress path - an open endpoint belonging to any other vector on the
 * page. Shared by `penCursor` (to pick the cursor) and `updatePenHover` (to
 * populate `editor.state.penHoverEndpoint` for the overlay highlight), so the
 * hit test is defined once and simply re-run by each caller rather than
 * duplicated.
 */
function hitTestContinueEndpoint(
  editor: Editor,
  cx: number,
  cy: number
): { nodeId: string; vertexIndex: number } | null {
  const iz = 1 / editor.state.zoom
  const nodeEditState = getNodeEditState(editor)

  if (nodeEditState) {
    const vi = hitTestEditVertex(editor, cx, cy)
    if (vi !== null && isEndpoint(vi, nodeEditState.segments)) {
      return { nodeId: nodeEditState.nodeId, vertexIndex: vi }
    }
    return null
  }

  if (editor.state.activeTool === 'PEN') {
    const parentId = editor.state.enteredContainerId ?? editor.state.currentPageId
    const children = editor.graph.getChildren(parentId)
    const threshold = NODE_HIT_THRESHOLD * iz
    for (const child of children) {
      if (child.type === 'VECTOR' && child.vectorNetwork && child.visible && !child.locked) {
        const { vertices, segments } = child.vectorNetwork
        for (let i = 0; i < vertices.length; i++) {
          if (isEndpoint(i, segments)) {
            const vx = child.x + vertices[i].x
            const vy = child.y + vertices[i].y
            if (Math.hypot(cx - vx, cy - vy) < threshold) {
              return { nodeId: child.id, vertexIndex: i }
            }
          }
        }
      }
    }
  }

  return null
}

export function penCursor(editor: Editor, cx: number, cy: number): string {
  const iz = 1 / editor.state.zoom
  const nodeEditState = getNodeEditState(editor)

  if (nodeEditState) {
    if (hitTestContinueEndpoint(editor, cx, cy)) {
      return CONTINUE_CURSOR
    }
    const segHit = hitTestEditSegment(editor, cx, cy)
    if (segHit) {
      return INSERT_CURSOR
    }
    return 'crosshair'
  }

  const penState = editor.state.penState
  if (penState) {
    if (penState.vertices.length > 2) {
      const first = penState.vertices[0]
      const dist = Math.hypot(cx - first.x, cy - first.y)
      if (dist < PEN_CLOSE_THRESHOLD * iz) {
        return CLOSE_CURSOR
      }
    }
    if (hitTestContinueEndpoint(editor, cx, cy)) {
      return CONTINUE_CURSOR
    }
    return 'crosshair'
  }

  if (editor.state.activeTool === 'PEN' && hitTestContinueEndpoint(editor, cx, cy)) {
    return CONTINUE_CURSOR
  }

  return 'crosshair'
}

export function startPenInput(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: SetDrag,
  cursorOverride: Ref<string | null>
): boolean {
  editor.state.penCursorX = null
  editor.state.penCursorY = null

  const nodeEditState = editor.state.nodeEditState
  if (nodeEditState) {
    handlePenNodeEditDown(e, cx, cy, editor)
    return true
  }

  const rawCx = cx
  const rawCy = cy

  const penState = editor.state.penState
  if (penState && penState.vertices.length > 0 && e.shiftKey) {
    const last = penState.vertices[penState.vertices.length - 1]
    const snapped = constrainToAngleStep(cx - last.x, cy - last.y, 45)
    cx = last.x + snapped.x
    cy = last.y + snapped.y
  }

  const iz = 1 / editor.state.zoom
  if (penState && penState.vertices.length > 2) {
    const first = penState.vertices[0]
    const dist = Math.hypot(cx - first.x, cy - first.y)
    if (dist < PEN_CLOSE_THRESHOLD * iz) {
      editor.penSetPendingClose(true)
      editor.penSetClosingToFirst(true)
      setDrag(createPenDrag(first.x, first.y))
      cursorOverride.value = penCursor(editor, cx, cy)
      return true
    }
  }

  const link = hitTestContinueEndpoint(editor, rawCx, rawCy)
  if (link) {
    const linkEditor = editor as Editor & PenLinkEditor
    if (penState) {
      linkEditor.penLinkToEndpoint?.(link.nodeId, link.vertexIndex)
    } else {
      linkEditor.penResumeFromEndpoint?.(link.nodeId, link.vertexIndex)
    }
    cursorOverride.value = 'crosshair'
    return true
  }

  editor.penSetPendingClose(false)
  editor.penAddVertex(cx, cy)
  setDrag(createPenDrag(cx, cy))
  cursorOverride.value = 'crosshair'
  return true
}

export function updatePenHover(
  cx: number,
  cy: number,
  editor: Editor,
  cursorOverride?: Ref<string | null>
): boolean {
  if (editor.state.activeTool !== 'PEN' && !editor.state.nodeEditState) {
    if (editor.state.penHoverIntent) {
      editor.state.penHoverIntent = null
      editor.state.penHoverInsertPoint = null
      editor.state.penHoverEndpoint = null
      editor.requestRepaint()
    }
    return false
  }

  const cursor = penCursor(editor, cx, cy)
  if (cursorOverride && editor.state.activeTool === 'PEN') {
    cursorOverride.value = cursor
  }

  let hoverIntent: 'close' | 'continue' | 'insert' | null = null
  if (cursor === CLOSE_CURSOR) {
    hoverIntent = 'close'
  } else if (cursor === CONTINUE_CURSOR) {
    hoverIntent = 'continue'
  } else if (cursor === INSERT_CURSOR) {
    hoverIntent = 'insert'
  }
  editor.state.penHoverIntent = hoverIntent

  if (hoverIntent === 'insert') {
    const segHit = hitTestEditSegment(editor, cx, cy)
    editor.state.penHoverInsertPoint = segHit?.point ?? null
  } else {
    editor.state.penHoverInsertPoint = null
  }

  if (hoverIntent === 'continue') {
    editor.state.penHoverEndpoint = hitTestContinueEndpoint(editor, cx, cy)
  } else {
    editor.state.penHoverEndpoint = null
  }

  if (editor.state.activeTool === 'PEN' && editor.state.penState) {
    editor.state.penCursorX = cx
    editor.state.penCursorY = cy

    if (editor.state.penState.vertices.length > 2) {
      const first = editor.state.penState.vertices[0]
      const iz = 1 / editor.state.zoom
      const dist = Math.hypot(cx - first.x, cy - first.y)
      editor.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD * iz)
    }
    editor.requestRepaint()
    return true
  }

  editor.requestRepaint()
  return true
}

export { handlePenDragMove }
