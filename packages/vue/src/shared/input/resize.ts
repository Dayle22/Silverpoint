export { constrainToAspectRatio } from '#vue/shared/input/resize/rect'
export { tryStartResize } from '#vue/shared/input/resize/start'
import type { Editor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAbsoluteRotation } from '@open-pencil/scene-graph/coordinate'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { calculateResizeRect } from '#vue/shared/input/resize/rect'
import { scaleVectorNetworkForResize } from '#vue/shared/input/resize/vector'
import type { DragResize, HandlePosition } from '#vue/shared/input/types'

type ResizeSnapCandidate = { delta: number; position: number; from: number; to: number }

function findResizeAxisSnap(
  rect: Rect,
  handle: HandlePosition,
  node: SceneNode,
  siblings: SceneNode[],
  axis: 'x' | 'y'
): ResizeSnapCandidate | null {
  const movesStart = axis === 'x' ? handle.includes('w') : handle.includes('n')
  const movesEnd = axis === 'x' ? handle.includes('e') : handle.includes('s')
  if (!movesStart && !movesEnd) return null

  const movingStart = axis === 'x' ? rect.x : rect.y
  const movingEnd = axis === 'x' ? rect.x + rect.width : rect.y + rect.height
  let best: ResizeSnapCandidate | null = null
  for (const target of siblings) {
    if (target.id === node.id || target.rotation !== 0) continue
    const values =
      axis === 'x'
        ? [target.x, target.x + target.width, target.x + target.width / 2]
        : [target.y, target.y + target.height, target.y + target.height / 2]
    for (const position of values) {
      const delta = position - (movesEnd ? movingEnd : movingStart)
      if (Math.abs(delta) >= 5 || (best && Math.abs(delta) >= Math.abs(best.delta))) continue
      best = {
        delta,
        position,
        from: axis === 'x' ? Math.min(rect.y, target.y) : Math.min(rect.x, target.x),
        to:
          axis === 'x'
            ? Math.max(rect.y + rect.height, target.y + target.height)
            : Math.max(rect.x + rect.width, target.x + target.width)
      }
    }
  }
  return best
}

export function computeResizeSnap(
  rect: Rect,
  handle: HandlePosition,
  node: SceneNode,
  siblings: SceneNode[]
): { rect: Rect; guides: SnapGuide[] } {
  if (node.rotation !== 0) return { rect, guides: [] }
  const next = { ...rect }
  const guides: SnapGuide[] = []
  for (const axis of ['x', 'y'] as const) {
    const best = findResizeAxisSnap(rect, handle, node, siblings, axis)
    if (!best) continue
    if (axis === 'x') {
      if (handle.includes('e')) next.width += best.delta
      else {
        next.x += best.delta
        next.width -= best.delta
      }
    } else if (handle.includes('s')) next.height += best.delta
    else {
      next.y += best.delta
      next.height -= best.delta
    }
    if (next.width <= 0 || next.height <= 0) return { rect, guides: [] }
    guides.push({ kind: 'alignment', axis, position: best.position, from: best.from, to: best.to })
  }
  return { rect: next, guides }
}

function resizeChanges(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  overrideRect?: Rect
) {
  const { origRect } = d
  const newRect =
    overrideRect ?? calculateResizeRect(d.handle, origRect, cx - d.startX, cy - d.startY, constrain)

  const changes: Partial<SceneNode> = { ...newRect }

  const resizedVectorNetwork = scaleVectorNetworkForResize(
    d.origVectorNetwork,
    origRect.width,
    origRect.height,
    newRect.width,
    newRect.height
  )
  if (resizedVectorNetwork) changes.vectorNetwork = resizedVectorNetwork
  return { changes, newRect }
}

export function textResizeModeForHandle(
  node: Pick<SceneNode, 'type' | 'textAutoResize'>,
  handle: HandlePosition
): SceneNode['textAutoResize'] | null {
  if (node.type !== 'TEXT') return null
  if (
    (handle === 'e' || handle === 'w') &&
    node.textAutoResize === 'WIDTH_AND_HEIGHT'
  ) {
    return 'HEIGHT'
  }
  if (
    (handle === 'n' || handle === 's') &&
    (node.textAutoResize === 'WIDTH_AND_HEIGHT' || node.textAutoResize === 'HEIGHT')
  ) {
    return 'NONE'
  }
  return null
}

export function applyResize(
  d: DragResize,
  cx: number,
  cy: number,
  constrain: boolean,
  editor: Editor,
  bypass = false
) {
  const raw = resizeChanges(d, cx, cy, constrain)
  const currentNode = editor.graph.getNode(d.nodeId)
  const parentId = currentNode?.parentId ?? editor.state.currentPageId
  const siblings = currentNode ? editor.graph.getChildren(parentId) : []
  const snapped =
    !bypass &&
    currentNode &&
    editor.state.selectedIds.size === 1 &&
    getAbsoluteRotation(currentNode, editor.graph) === 0
      ? computeResizeSnap(raw.newRect, d.handle, currentNode, siblings)
      : { rect: raw.newRect, guides: [] }
  editor.setSnapGuides(bypass ? [] : snapped.guides)
  const { changes, newRect } = resizeChanges(d, cx, cy, constrain, snapped.rect)
  editor.graph.updateNodePreview(d.nodeId, changes)

  if (d.origChildren && d.origRect.width > 0 && d.origRect.height > 0) {
    const sx = newRect.width / d.origRect.width
    const sy = newRect.height / d.origRect.height
    for (const [childId, orig] of d.origChildren) {
      const childWidth = Math.round(Math.max(1, orig.width * sx))
      const childHeight = Math.round(Math.max(1, orig.height * sy))
      const childChanges: Partial<SceneNode> = {
        x: Math.round(orig.x * sx),
        y: Math.round(orig.y * sy),
        width: childWidth,
        height: childHeight
      }
      if (orig.vectorNetwork) {
        const scaledVN = scaleVectorNetworkForResize(
          orig.vectorNetwork,
          orig.width,
          orig.height,
          childWidth,
          childHeight
        )
        if (scaledVN) childChanges.vectorNetwork = scaledVN
      }
      editor.graph.updateNodePreview(childId, childChanges)
      editor.renderer?.invalidateVectorPath(childId)
    }
  }

  const node = editor.graph.getNode(d.nodeId)
  if (node?.layoutMode !== 'NONE') {
    editor.graph.runPreviewUpdates(() => computeLayout(editor.graph, d.nodeId))
  }
  editor.requestRepaint()
}

export function commitResizePreview(d: DragResize, editor: Editor) {
  editor.setSnapGuides([])
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  if (
    node.x === d.origRect.x &&
    node.y === d.origRect.y &&
    node.width === d.origRect.width &&
    node.height === d.origRect.height
  ) {
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    return
  }
  const finalChanges: Partial<SceneNode> = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  }
  const textResizeMode = textResizeModeForHandle(node, d.handle)
  if (textResizeMode) finalChanges.textAutoResize = textResizeMode
  if (node.vectorNetwork) finalChanges.vectorNetwork = node.vectorNetwork

  if (d.origChildren) {
    const finalChildren = new Map<string, Partial<SceneNode>>()
    for (const [childId] of d.origChildren) {
      const child = editor.graph.getNode(childId)
      if (!child) continue
      const final: Partial<SceneNode> = {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height
      }
      if (child.vectorNetwork) final.vectorNetwork = child.vectorNetwork
      finalChildren.set(childId, final)
    }
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    for (const [childId, orig] of d.origChildren) {
      editor.graph.updateNodePreview(childId, orig)
    }
    editor.updateNode(d.nodeId, finalChanges)
    for (const [childId, final] of finalChildren) {
      editor.updateNode(childId, final)
    }
    editor.commitGroupResize(d.nodeId, d.origRect, d.origChildren)
    editor.requestRepaint()
  } else {
    editor.graph.updateNodePreview(d.nodeId, d.origRect)
    editor.updateNode(d.nodeId, finalChanges)
    editor.commitResize(d.nodeId, {
      ...d.origRect,
      ...(d.origVectorNetwork || node.vectorNetwork ? { vectorNetwork: d.origVectorNetwork } : {})
    })
  }
}
