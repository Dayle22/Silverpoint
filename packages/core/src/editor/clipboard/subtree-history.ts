import type { NodeType, SceneNode } from '@open-pencil/scene-graph'

export interface SubtreeGraphTarget {
  getNode(id: string): SceneNode | undefined
  createNode(type: NodeType, parentId: string, overrides?: Partial<SceneNode>): SceneNode
}

export function collectSubtrees(graph: SubtreeGraphTarget, rootIds: string[]): SceneNode[] {
  const result: SceneNode[] = []
  function walk(id: string) {
    const node = graph.getNode(id)
    if (!node) return
    result.push(structuredClone(node))
    for (const childId of node.childIds) walk(childId)
  }
  for (const id of rootIds) walk(id)
  return result
}

export function snapshotSubtree(graph: SubtreeGraphTarget, rootId: string): Map<string, SceneNode> {
  const index = new Map<string, SceneNode>()
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    index.set(id, structuredClone(node))
    for (const childId of node.childIds) walk(childId)
  }
  walk(rootId)
  return index
}

export function restoreSubtree(
  graph: SubtreeGraphTarget,
  snapshot: SceneNode,
  parentId: string,
  index: Map<string, SceneNode>
): void {
  const { parentId: _parentId, childIds, ...rest } = snapshot
  graph.createNode(snapshot.type, parentId, { ...rest, id: snapshot.id })
  for (const childId of childIds) {
    const child = index.get(childId)
    if (child) restoreSubtree(graph, child, snapshot.id, index)
  }
}
