import type { SkiaRenderer } from '#core/canvas/renderer'

export function invalidateScenePicture(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.scenePicture = null
  r.scenePictureVersion = -1
  r.scenePictureFontGeneration = -1
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

const dirtySubtrees = new WeakMap<SkiaRenderer, Set<string>>()
const EMPTY_DIRTY_SUBTREES: ReadonlySet<string> = new Set()

/** Mark a node and, transitively, its ancestors' subtree pictures as stale. */
export function markSubtreeDirty(
  r: SkiaRenderer,
  nodeId: string,
  ancestorIds: readonly string[] = []
): void {
  let dirty = dirtySubtrees.get(r)
  if (!dirty) {
    dirty = new Set<string>()
    dirtySubtrees.set(r, dirty)
  }
  dirty.add(nodeId)
  for (const ancestorId of ancestorIds) {
    dirty.add(ancestorId)
  }
}

/** Evict every cached subtree picture marked dirty, then clear the set. Returns entries evicted. */
export function flushDirtySubtrees(r: SkiaRenderer): number {
  const dirty = dirtySubtrees.get(r)
  if (!dirty || dirty.size === 0) return 0
  let evicted = 0
  if (typeof r.subtreePictureCache?.evictWhere === 'function') {
    evicted = r.subtreePictureCache.evictWhere((nodeId) => dirty.has(nodeId))
  } else if (r.subtreePictureCache) {
    for (const id of dirty) {
      if (r.subtreePictureCache.delete(id)) {
        evicted++
      }
    }
  }
  dirty.clear()
  return evicted
}

/** Diagnostics for F-018k. */
export function peekDirtySubtrees(r: SkiaRenderer): ReadonlySet<string> {
  return dirtySubtrees.get(r) ?? EMPTY_DIRTY_SUBTREES
}

/**
 * Escape hatch for full subtree picture cache invalidation.
 *
 * Do not remove or weaken this: document loads, page switches, and the F-018e degraded path
 * still require a wholesale wipe of the subtree picture cache.
 */
export function clearSubtreePictureCache(r: SkiaRenderer): void {
  dirtySubtrees.get(r)?.clear()
  r.subtreePictureCache.clear()
  r.subtreePictureCachePageId = null
  r.subtreePictureCacheSceneVersion = -1
  r.subtreePictureCachePositionPreviewVersion = -1
  r.subtreePictureCacheFontGeneration = -1
}

export function invalidateAllPictures(r: SkiaRenderer): void {
  invalidateScenePicture(r)
  r.nodePictureCache.clear()
  r.nodePictureCacheGenerations.clear()
  clearSubtreePictureCache(r)
}

export function invalidateNodePicture(
  r: SkiaRenderer,
  nodeId: string,
  ancestorIds: readonly string[] = []
): void {
  r.nodePictureCache.delete(nodeId)
  r.nodePictureCacheGenerations.delete(nodeId)
  r.subtreePictureCache.delete(nodeId)
  markSubtreeDirty(r, nodeId, ancestorIds)
}

/** Evict cached entries for nodes no longer present in the scene. Returns entries evicted. */
export function evictOrphanedCacheEntries(
  r: SkiaRenderer,
  liveNodeIds: ReadonlySet<string>
): number {
  let evicted = 0
  evicted += r.nodePictureCache.evictWhere((nodeId) => !liveNodeIds.has(nodeId))
  evicted += r.subtreePictureCache.evictWhere((nodeId) => !liveNodeIds.has(nodeId))
  return evicted
}

export function flashNode(r: SkiaRenderer, nodeId: string): void {
  r._flashes.push({ nodeId, startTime: performance.now() })
}

export function aiMarkActive(r: SkiaRenderer, nodeIds: string[]): void {
  for (const id of nodeIds) r._aiActiveNodes.add(id)
}

export function aiMarkDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    if (r._aiActiveNodes.delete(id)) {
      r._aiDoneFlashes.push({ nodeId: id, startTime: now })
    }
  }
}

export function aiFlashDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    r._aiDoneFlashes.push({ nodeId: id, startTime: now })
  }
}

export function aiClearActive(r: SkiaRenderer): void {
  r._aiActiveNodes.clear()
}

export function aiClearAll(r: SkiaRenderer): void {
  r._aiActiveNodes.clear()
  r._aiDoneFlashes = []
}

export function hasActiveFlashes(r: SkiaRenderer): boolean {
  return r._flashes.length > 0 || r._aiActiveNodes.size > 0 || r._aiDoneFlashes.length > 0
}
