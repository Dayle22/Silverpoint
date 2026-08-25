import { applyOverridePatch } from '#core/kiwi/fig/instance-overrides/patches'
import { resolveOverrideTarget } from '#core/kiwi/fig/instance-overrides/resolve'
import type { OverrideContext } from '#core/kiwi/fig/instance-overrides/types'

import { patchFromSymbolOverride } from './patches'

function isActiveInstance(ctx: OverrideContext, nodeId: string | undefined): nodeId is string {
  return nodeId !== undefined && (!ctx.activeNodeIds || ctx.activeNodeIds.has(nodeId))
}

/**
 * Apply symbolOverrides from kiwi data.
 *
 * Handles instance swaps (overriddenSymbolID) and property overrides
 * (fills, text, visibility, etc.). Returns the set of directly
 * overridden node IDs (used as seeds for transitive sync).
 */
export function applySymbolOverrides(ctx: OverrideContext): Set<string> {
  const overriddenNodes = new Set<string>()
  ctx.componentIdRoot.clear()

  for (const [ncId, nc] of ctx.changeMap) {
    if (nc.type !== 'INSTANCE') continue
    const overrides = nc.symbolData?.symbolOverrides
    if (!overrides?.length) continue

    const nodeId = ctx.guidToNodeId.get(ncId)
    if (!isActiveInstance(ctx, nodeId)) continue

    for (const ov of overrides) {
      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, nodeId, guids)
      if (!targetId) continue

      if (targetId === nodeId && ctx.kiwiPropertyNodes.has(nodeId)) continue

      const patch = patchFromSymbolOverride(ctx, targetId, ov)
      if (!patch) continue
      overriddenNodes.add(targetId)
      applyOverridePatch(ctx, patch)
    }
  }
  return overriddenNodes
}
