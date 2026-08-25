import type { Editor } from '@open-pencil/core/editor'
import { parseFrameGuides } from '@open-pencil/core/editor'
import { computeSelectionBounds, computeSnap } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getAbsoluteRotation } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'

import type { DragMove } from '#vue/shared/input/types'

function getGuidePositions(editor: Editor) {
  const x: number[] = []
  const y: number[] = []
  for (const guide of editor.getPageGuides()) {
    if (guide.axis === 'X') x.push(guide.offset)
    else y.push(guide.offset)
  }

  const firstId = [...editor.state.selectedIds][0]
  const selected = firstId ? editor.graph.getNode(firstId) : null
  const parent = selected?.parentId ? editor.graph.getNode(selected.parentId) : null
  if (parent?.type !== 'FRAME' || getAbsoluteRotation(parent, editor.graph) !== 0) return { x, y }
  const settings = parseFrameGuides(parent.pluginData)
  const origin = editor.graph.getAbsolutePosition(parent.id)
  if (settings.margins.enabled) {
    x.push(origin.x + settings.margins.left, origin.x + parent.width - settings.margins.right)
    y.push(origin.y + settings.margins.top, origin.y + parent.height - settings.margins.bottom)
  }
  if (settings.bleed.enabled) {
    x.push(origin.x - settings.bleed.left, origin.x + parent.width + settings.bleed.right)
    y.push(origin.y - settings.bleed.top, origin.y + parent.height + settings.bleed.bottom)
  }
  return { x, y }
}

function closestGuideDelta(
  values: number[],
  positions: number[]
): { delta: number; position: number } | null {
  let best: { delta: number; position: number } | null = null
  for (const position of positions) {
    for (const value of values) {
      const delta = position - value
      if (Math.abs(delta) >= 5) continue
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, position }
    }
  }
  return best
}

function computeGuideSnap(bounds: Rect, positions: { x: number[]; y: number[] }) {
  const x = closestGuideDelta(
    [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
    positions.x
  )
  const y = closestGuideDelta(
    [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
    positions.y
  )
  const guides: SnapGuide[] = []
  if (x) {
    guides.push({
      kind: 'alignment',
      axis: 'x',
      position: x.position,
      from: bounds.y,
      to: bounds.y + bounds.height
    })
  }
  if (y) {
    guides.push({
      kind: 'alignment',
      axis: 'y',
      position: y.position,
      from: bounds.x,
      to: bounds.x + bounds.width
    })
  }
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides }
}

export function applyMoveSnap(
  d: DragMove,
  dx: number,
  dy: number,
  editor: Editor,
  bypass = false
): { dx: number; dy: number } {
  if (bypass) {
    editor.setSnapGuides([])
    return { dx, dy }
  }
  const selectedNodes: SceneNode[] = []
  for (const [id, orig] of d.originals) {
    const node = editor.graph.getNode(id)
    if (node) {
      const abs = editor.graph.getAbsolutePosition(id)
      const parentAbs = node.parentId
        ? editor.graph.getAbsolutePosition(node.parentId)
        : { x: 0, y: 0 }
      selectedNodes.push({
        ...node,
        x: abs.x - parentAbs.x - node.x + orig.x + dx,
        y: abs.y - parentAbs.y - node.y + orig.y + dy
      })
    }
  }

  const bounds = computeSelectionBounds(selectedNodes)
  if (!bounds) return { dx, dy }

  const firstId = [...d.originals.keys()][0]
  const firstNode = editor.graph.getNode(firstId)
  const parentId = firstNode?.parentId ?? editor.state.currentPageId
  const siblings = editor.graph.getChildren(parentId)
  const parentAbs = !editor.isTopLevel(parentId)
    ? editor.graph.getAbsolutePosition(parentId)
    : { x: 0, y: 0 }
  const absTargets = siblings.map((node) => ({
    ...node,
    x: node.x + parentAbs.x,
    y: node.y + parentAbs.y
  }))
  const absBounds = {
    x: bounds.x + parentAbs.x,
    y: bounds.y + parentAbs.y,
    width: bounds.width,
    height: bounds.height
  }
  const snap = computeSnap(editor.state.selectedIds, absBounds, absTargets)
  if (!editor.state.showRulers) {
    editor.setSnapGuides(snap.guides)
    return { dx: dx + snap.dx, dy: dy + snap.dy }
  }

  const guideSnap = computeGuideSnap(absBounds, getGuidePositions(editor))
  const siblingOwnsX = snap.guides.some((guide) => guide.axis === 'x')
  const siblingOwnsY = snap.guides.some((guide) => guide.axis === 'y')
  const guides = [
    ...snap.guides,
    ...guideSnap.guides.filter(
      (guide) => (guide.axis === 'x' && !siblingOwnsX) || (guide.axis === 'y' && !siblingOwnsY)
    )
  ]
  editor.setSnapGuides(guides)
  return {
    dx: dx + (siblingOwnsX ? snap.dx : guideSnap.dx),
    dy: dy + (siblingOwnsY ? snap.dy : guideSnap.dy)
  }
}
