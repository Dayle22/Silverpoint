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

export function clearSubtreePictureCache(r: SkiaRenderer): void {
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

export function invalidateNodePicture(r: SkiaRenderer, nodeId: string): void {
  r.nodePictureCache.delete(nodeId)
  r.nodePictureCacheGenerations.delete(nodeId)
  r.subtreePictureCache.delete(nodeId)
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
