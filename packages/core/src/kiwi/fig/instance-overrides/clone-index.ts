import type { OverrideContext } from './types'

export function buildCloneIndex(ctx: OverrideContext): Map<string, string[]> {
  const clonesBySource = new Map<string, string[]>()
  for (const node of ctx.graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    if (ctx.activeNodeIds && !ctx.activeNodeIds.has(node.id)) continue
    const clones = clonesBySource.get(node.componentId)
    if (clones) clones.push(node.id)
    else clonesBySource.set(node.componentId, [node.id])
  }
  return clonesBySource
}

export function instanceAndClones(
  instanceNodeId: string,
  clonesBySource: Map<string, string[]>,
  cache: Map<string, string[]>
): string[] {
  const cached = cache.get(instanceNodeId)
  if (cached) return cached
  const result: string[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    result.push(id)
    for (const cloneId of clonesBySource.get(id) ?? []) visit(cloneId)
  }
  visit(instanceNodeId)
  cache.set(instanceNodeId, result)
  return result
}
