import type { EditorContext } from '#core/editor/types'

export function adoptNodesIntoContainer(
  ctx: EditorContext,
  containerId: string,
  containerType: 'SECTION' | 'FRAME'
) {
  const container = ctx.graph.getNode(containerId)
  if (container?.type !== containerType) return

  const parentId = container.parentId ?? ctx.state.currentPageId
  const siblings = ctx.graph.getChildren(parentId)

  const sx = container.x
  const sy = container.y
  const sx2 = sx + container.width
  const sy2 = sy + container.height

  const toAdopt: string[] = []
  for (const sibling of siblings) {
    if (sibling.id === containerId) continue
    const nx = sibling.x
    const ny = sibling.y
    const nx2 = nx + sibling.width
    const ny2 = ny + sibling.height
    if (nx >= sx && ny >= sy && nx2 <= sx2 && ny2 <= sy2) {
      toAdopt.push(sibling.id)
    }
  }

  if (toAdopt.length === 0) return

  const undoOps: Array<{
    id: string
    oldParent: string
    oldX: number
    oldY: number
    newX: number
    newY: number
  }> = []
  for (const id of toAdopt) {
    const node = ctx.graph.getNode(id)
    if (!node) continue
    const newX = node.x - sx
    const newY = node.y - sy
    undoOps.push({ id, oldParent: parentId, oldX: node.x, oldY: node.y, newX, newY })
    ctx.graph.reparentNode(id, containerId)
    ctx.graph.updateNode(id, { x: newX, y: newY })
  }

  ctx.undo.push({
    label: `Adopt into ${containerType.toLowerCase()}`,
    forward: () => {
      for (const op of undoOps) {
        ctx.graph.reparentNode(op.id, containerId)
        ctx.graph.updateNode(op.id, { x: op.newX, y: op.newY })
      }
    },
    inverse: () => {
      for (const op of undoOps) {
        ctx.graph.reparentNode(op.id, op.oldParent)
        ctx.graph.updateNode(op.id, { x: op.oldX, y: op.oldY })
      }
    }
  })
}

export function adoptNodesIntoSection(ctx: EditorContext, sectionId: string) {
  adoptNodesIntoContainer(ctx, sectionId, 'SECTION')
}

export function adoptNodesIntoFrame(ctx: EditorContext, frameId: string) {
  adoptNodesIntoContainer(ctx, frameId, 'FRAME')
}
