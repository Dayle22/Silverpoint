import type { NodeType, SceneGraph, SceneNode } from './'
import { getWorldMatrix } from './coordinate'
import Matrix from './matrix'

/**
 * Maximum scene-graph nesting depth traversed in one operation.
 * Beyond this the document is treated as malformed rather than crashing the tab.
 * Real design documents rarely exceed ~40 levels.
 */
export const MAX_TRAVERSAL_DEPTH = 512

export type HitTestCache = Map<string, boolean>

export function createHitTestCache(): HitTestCache {
  return new Map<string, boolean>()
}

const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])
const OPAQUE_CONTAINER_TYPES = new Set<NodeType>(['COMPONENT', 'INSTANCE'])

function hasVisibleFillOrStroke(node: SceneNode): boolean {
  return node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)
}

export function hasTransformedAncestor(
  node: SceneNode,
  graph: SceneGraph,
  cache: HitTestCache
): boolean {
  const cached = cache.get(node.id)
  if (cached !== undefined) return cached

  const visited = new Set<string>()
  const path: string[] = []
  let curr: SceneNode | undefined = node
  let depth = 0
  let isTransformed = false

  while (curr) {
    if (visited.has(curr.id)) {
      console.warn(`[hit-test] Cycle detected in parent chain at node ${curr.id}`)
      for (const id of path) {
        cache.set(id, false)
      }
      return false
    }
    visited.add(curr.id)
    path.push(curr.id)

    const c = cache.get(curr.id)
    if (c !== undefined) {
      isTransformed = c
      break
    }

    if (curr.rotation !== 0 || curr.flipX || curr.flipY) {
      isTransformed = true
      break
    }

    depth++
    if (depth > MAX_TRAVERSAL_DEPTH) {
      console.warn(`[hit-test] Traversal depth exceeded ${MAX_TRAVERSAL_DEPTH} in hasTransformedAncestor`)
      break
    }

    curr = curr.parentId ? graph.getNode(curr.parentId) : undefined
  }

  for (const id of path) {
    cache.set(id, isTransformed)
  }

  return isTransformed
}

export function containsPoint(
  px: number,
  py: number,
  node: SceneNode,
  graph: SceneGraph,
  transformCache: HitTestCache
): boolean {
  if (!hasTransformedAncestor(node, graph, transformCache)) {
    const absolute = graph.getAbsolutePosition(node.id)
    return (
      px >= absolute.x &&
      px <= absolute.x + node.width &&
      py >= absolute.y &&
      py <= absolute.y + node.height
    )
  }

  const m = getWorldMatrix(node, graph)

  const inv = Matrix.invert(m)
  if (!inv) return false

  const [localX, localY] = Matrix.mapPoints(inv, [px, py])
  return localX >= 0 && localX <= node.width && localY >= 0 && localY <= node.height
}

type FrameKind = 'ROOT' | 'OPAQUE' | 'GROUP_DEEP' | 'TRANSPARENT'

interface StackFrame {
  nodeId: string
  node: SceneNode
  kind: FrameKind
  childIndex: number
  depth: number
}

function resolveReturnedHit(
  child: SceneNode,
  childHit: SceneNode | null,
  deep: boolean,
  px: number,
  py: number,
  graph: SceneGraph,
  transformCache: HitTestCache
): SceneNode | null {
  if (OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
    if (childHit || hasVisibleFillOrStroke(child)) return child
    return null
  }
  if (child.type === 'GROUP') {
    return childHit ?? child
  }
  if (childHit) {
    return child.locked ? child : childHit
  }
  if (containsPoint(px, py, child, graph, transformCache) && hasVisibleFillOrStroke(child)) {
    return child
  }
  return null
}

function tryDescendContainer(
  child: SceneNode,
  childId: string,
  deep: boolean,
  depth: number,
  px: number,
  py: number,
  graph: SceneGraph,
  transformCache: HitTestCache,
  onWarn: () => void
): { descend?: StackFrame; directHit?: SceneNode } | null {
  if (OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
    if (!containsPoint(px, py, child, graph, transformCache)) return null
    if (child.clipsContent && !containsPoint(px, py, child, graph, transformCache)) {
      return hasVisibleFillOrStroke(child) ? { directHit: child } : null
    }
    if (depth + 1 > MAX_TRAVERSAL_DEPTH) {
      onWarn()
      return hasVisibleFillOrStroke(child) ? { directHit: child } : null
    }
    return {
      descend: {
        nodeId: childId,
        node: child,
        kind: 'OPAQUE',
        childIndex: child.childIds.length - 1,
        depth: depth + 1
      }
    }
  }

  if (child.type === 'GROUP') {
    if (!containsPoint(px, py, child, graph, transformCache)) return null
    if (!deep) return { directHit: child }
    if (depth + 1 > MAX_TRAVERSAL_DEPTH) {
      onWarn()
      return { directHit: child }
    }
    return {
      descend: {
        nodeId: childId,
        node: child,
        kind: 'GROUP_DEEP',
        childIndex: child.childIds.length - 1,
        depth: depth + 1
      }
    }
  }

  if (child.clipsContent && !containsPoint(px, py, child, graph, transformCache)) {
    return null
  }
  if (depth + 1 > MAX_TRAVERSAL_DEPTH) {
    onWarn()
    if (containsPoint(px, py, child, graph, transformCache) && hasVisibleFillOrStroke(child)) {
      return { directHit: child }
    }
    return null
  }
  return {
    descend: {
      nodeId: childId,
      node: child,
      kind: 'TRANSPARENT',
      childIndex: child.childIds.length - 1,
      depth: depth + 1
    }
  }
}

function handleReturnStep(
  frame: StackFrame,
  returnedHit: SceneNode | null,
  deep: boolean,
  px: number,
  py: number,
  graph: SceneGraph,
  transformCache: HitTestCache
): { resolvedHit?: SceneNode } | null {
  const childId = frame.node.childIds[frame.childIndex]
  const child = childId ? graph.nodes.get(childId) : undefined
  if (child) {
    const resolved = resolveReturnedHit(
      child,
      returnedHit,
      deep,
      px,
      py,
      graph,
      transformCache
    )
    if (resolved) return { resolvedHit: resolved }
  }
  return null
}

export function hitTestChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  deep = false,
  transformCache: HitTestCache = createHitTestCache()
): SceneNode | null {
  const rootNode = graph.nodes.get(parentId)
  if (!rootNode) return null

  if (rootNode.clipsContent && !containsPoint(px, py, rootNode, graph, transformCache)) {
    return null
  }

  let warned = false
  const onWarn = () => {
    if (!warned) {
      console.warn(`[hit-test] Traversal depth exceeded ${MAX_TRAVERSAL_DEPTH} in hitTestChildren`)
      warned = true
    }
  }

  const stack: StackFrame[] = [
    {
      nodeId: parentId,
      node: rootNode,
      kind: 'ROOT',
      childIndex: rootNode.childIds.length - 1,
      depth: 0
    }
  ]

  let returnedHit: SceneNode | null = null
  let hasReturn = false

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]

    if (hasReturn) {
      const childHit: SceneNode | null = returnedHit
      hasReturn = false
      returnedHit = null

      const returnResult = handleReturnStep(
        frame,
        childHit,
        deep,
        px,
        py,
        graph,
        transformCache
      )
      if (returnResult?.resolvedHit) {
        stack.pop()
        returnedHit = returnResult.resolvedHit
        hasReturn = true
        continue
      }

      frame.childIndex--
      continue
    }

    if (frame.childIndex < 0) {
      stack.pop()
      returnedHit = null
      hasReturn = true
      continue
    }

    const childId = frame.node.childIds[frame.childIndex]
    const child = childId ? graph.nodes.get(childId) : undefined

    if (!child || child.internalOnly || !child.visible) {
      frame.childIndex--
      continue
    }

    if (CONTAINER_TYPES.has(child.type)) {
      const result = tryDescendContainer(
        child,
        childId,
        deep,
        frame.depth,
        px,
        py,
        graph,
        transformCache,
        onWarn
      )
      if (!result) {
        frame.childIndex--
        continue
      }
      if (result.directHit) {
        stack.pop()
        returnedHit = result.directHit
        hasReturn = true
        continue
      }
      if (result.descend) {
        stack.push(result.descend)
        continue
      }
    }

    if (containsPoint(px, py, child, graph, transformCache)) {
      stack.pop()
      returnedHit = child
      hasReturn = true
      continue
    }

    frame.childIndex--
  }

  return returnedHit
}

export function hitTest(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, false)
}

export function hitTestDeep(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, true)
}

export function hitTestFrameChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  offsetX = 0,
  offsetY = 0,
  excludeIds: Set<string> = new Set()
): SceneNode | null {
  const rootParent = graph.nodes.get(parentId)
  if (!rootParent) return null

  let best: SceneNode | null = null
  let warned = false

  interface FrameStackFrame {
    nodeId: string
    offsetX: number
    offsetY: number
    childIndex: number
    depth: number
  }

  const stack: FrameStackFrame[] = [
    {
      nodeId: parentId,
      offsetX,
      offsetY,
      childIndex: 0,
      depth: 0
    }
  ]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    const parent = graph.nodes.get(frame.nodeId)
    if (!parent || frame.childIndex >= parent.childIds.length) {
      stack.pop()
      continue
    }

    const childId = parent.childIds[frame.childIndex]
    frame.childIndex++

    if (excludeIds.has(childId)) continue
    const child = graph.nodes.get(childId)
    if (!child || child.internalOnly || !child.visible) continue

    const ax = frame.offsetX + child.x
    const ay = frame.offsetY + child.y

    if (!CONTAINER_TYPES.has(child.type)) continue
    if (px < ax || px > ax + child.width || py < ay || py > ay + child.height) continue

    best = child

    if (frame.depth + 1 > MAX_TRAVERSAL_DEPTH) {
      if (!warned) {
        console.warn(`[hit-test] Traversal depth exceeded ${MAX_TRAVERSAL_DEPTH} in hitTestFrameChildren`)
        warned = true
      }
      continue
    }

    stack.push({
      nodeId: childId,
      offsetX: ax,
      offsetY: ay,
      childIndex: 0,
      depth: frame.depth + 1
    })
  }

  return best
}

export function hitTestFrame(
  graph: SceneGraph,
  px: number,
  py: number,
  excludeIds: Set<string>,
  scopeId?: string
): SceneNode | null {
  return hitTestFrameChildren(graph, px, py, scopeId ?? graph.rootId, 0, 0, excludeIds)
}
