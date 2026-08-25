import type {
  ComponentPropAssignment,
  ComponentPropRef,
  OverrideContext
} from '#core/kiwi/fig/instance-overrides/types'

export function collectPropRefsMap(ctx: OverrideContext): Map<string, ComponentPropRef[]> {
  const result = new Map<string, ComponentPropRef[]>()
  for (const [figmaId, nc] of ctx.changeMap) {
    if (nc.componentPropRefs?.length) result.set(figmaId, nc.componentPropRefs)
  }
  return result
}

export function collectAssignmentsMap(
  ctx: OverrideContext
): Map<string, ComponentPropAssignment[]> {
  const result = new Map<string, ComponentPropAssignment[]>()
  for (const [figmaId, nc] of ctx.changeMap) {
    if (nc.componentPropAssignments?.length) result.set(figmaId, nc.componentPropAssignments)
  }
  return result
}
