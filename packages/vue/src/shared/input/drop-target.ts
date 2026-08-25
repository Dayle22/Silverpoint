import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

export function findMoveDropTarget(cx: number, cy: number, editor: Editor): SceneNode | null {
  let dropTarget = editor.graph.hitTestFrame(
    cx,
    cy,
    editor.state.selectedIds,
    editor.state.currentPageId
  )
  const movingSection = [...editor.state.selectedIds].some(
    (id) => editor.graph.getNode(id)?.type === 'SECTION'
  )
  if (
    movingSection &&
    dropTarget &&
    dropTarget.type !== 'SECTION' &&
    dropTarget.type !== 'CANVAS'
  ) {
    dropTarget = null
  }
  return dropTarget
}

function isContainerFrameOrSection(node: SceneNode | null | undefined): boolean {
  return node?.type === 'FRAME' || node?.type === 'SECTION'
}

function isOutsideParent(
  relX: number,
  relY: number,
  width: number,
  height: number,
  parent: SceneNode
): boolean {
  return relX + width < 0 || relX > parent.width || relY + height < 0 || relY > parent.height
}

function resolveOutsideTargetParentId(node: SceneNode, editor: Editor): string | null {
  if (!node.parentId || editor.isTopLevel(node.parentId)) return null

  let currentParent = editor.graph.getNode(node.parentId)
  if (!isContainerFrameOrSection(currentParent)) return null

  let relX = node.x
  let relY = node.y
  let targetParentId: string | null = null

  while (currentParent && isContainerFrameOrSection(currentParent)) {
    if (!isOutsideParent(relX, relY, node.width, node.height, currentParent)) {
      break
    }

    const nextParentId = currentParent.parentId ?? editor.state.currentPageId
    targetParentId = nextParentId

    if (editor.isTopLevel(nextParentId)) {
      break
    }

    const nextParent = editor.graph.getNode(nextParentId)
    if (!isContainerFrameOrSection(nextParent)) {
      break
    }

    relX += currentParent.x
    relY += currentParent.y
    currentParent = nextParent
  }

  return targetParentId && targetParentId !== node.parentId ? targetParentId : null
}

export function reparentOutsideNodes(editor: Editor) {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue
    const targetParentId = resolveOutsideTargetParentId(node, editor)
    if (targetParentId) {
      editor.graph.reparentNode(id, targetParentId)
    }
  }
}


