import type { SkiaRenderer } from '#core/canvas/renderer'
import { releaseFillShader } from '#core/canvas/fills'
import { releaseStrokeShader } from '#core/canvas/strokes'
import { clearSubtreePictureCache } from '#core/canvas/renderer/state'
import { fontManager } from '#core/text/fonts'

function clearRetainedSceneState(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function clearAdjustmentResources(r: SkiaRenderer): void {
  r.adjustmentLayerPaint.delete()
  for (const effect of r.adjustmentRuntimeEffects.values()) effect.delete()
  r.adjustmentRuntimeEffects.clear()
}

function clearNoiseResources(r: SkiaRenderer): void {
  for (const effect of r.noiseRuntimeEffects.values()) effect.delete()
  r.noiseRuntimeEffects.clear()
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true

  for (const img of r.imageCache.values()) img.delete()
  r.imageCache.clear()
  for (const cache of [
    r.vectorPathCache,
    r.vectorStrokePathCache,
    r.vectorStrokeOutlineCache,
    r.fillGeometryCache,
    r.strokeGeometryCache
  ]) {
    for (const paths of cache.values()) {
      for (const p of paths) p.delete()
    }
    cache.clear()
  }
  releaseFillShader(r)
  releaseStrokeShader(r)
  r.fillPaint.delete()
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.parentOutlinePaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  r.textFont?.delete()
  r.labelFont?.delete()
  r.sizeFont?.delete()
  r.sectionTitleFont?.delete()
  r.componentLabelFont?.delete()
  r.fontMgr?.delete()
  const fontProvider = r.fontProvider
  fontProvider?.delete()
  r.fontProvider = null
  r.fontsLoaded = false
  fontManager.detachProvider(fontProvider)
  r.rulerBgPaint.delete()
  r.rulerTickPaint.delete()
  r.rulerTextPaint.delete()
  r.rulerHlPaint.delete()
  r.rulerBadgePaint.delete()
  r.rulerLabelPaint.delete()
  r.penPathPaint.delete()
  r.penLiveStrokePaint.delete()
  r.penHandlePaint.delete()
  r.penVertexFill.delete()
  r.penVertexStroke.delete()
  r.effectLayerPaint.delete()
  clearAdjustmentResources(r)
  clearNoiseResources(r)
  for (const filter of r.imageFilterCache.values()) filter?.delete()
  r.imageFilterCache.clear()
  for (const filter of r.maskFilterCache.values()) filter?.delete()
  r.maskFilterCache.clear()
  for (const pic of r.nodePictureCache.values()) pic?.delete()
  r.nodePictureCache.clear()
  clearSubtreePictureCache(r)
  clearRetainedSceneState(r)
  r._flashPaint?.delete()
  r.profiler.destroy()
  r.surface.delete()
}
