import type { SkiaRenderer } from '#core/canvas/renderer'
import { fontManager } from '#core/text/fonts'

function clearRetainedSceneState(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function disposePaintResources(r: SkiaRenderer): void {
  if (r.activeStrokeShader) {
    r.activeStrokeShader.delete()
    r.activeStrokeShader = null
  }
  const paints = [
    r.fillPaint,
    r.strokePaint,
    r.selectionPaint,
    r.parentOutlinePaint,
    r.snapPaint,
    r.auxFill,
    r.auxStroke,
    r.opacityPaint,
    r.rulerBgPaint,
    r.rulerTickPaint,
    r.rulerTextPaint,
    r.rulerHlPaint,
    r.rulerBadgePaint,
    r.rulerLabelPaint,
    r.penPathPaint,
    r.penLiveStrokePaint,
    r.penHandlePaint,
    r.penVertexFill,
    r.penVertexStroke,
    r.effectLayerPaint,
    r.adjustmentLayerPaint
  ]
  for (const paint of paints) {
    paint?.delete()
  }
}

function disposeFontResources(r: SkiaRenderer): void {
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
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true

  r.getCacheBudget?.()?.clearAll()
  r.imageCache?.clear()
  r.imageFilterCache?.clear()
  r.maskFilterCache?.clear()
  r.adjustmentRuntimeEffects?.clear()
  r.nodePictureCache?.clear()
  r.subtreePictureCache?.clear()
  r.glyphSilhouetteCache?.clear()
  r.vectorPathCache?.clear()
  r.vectorStrokePathCache?.clear()
  r.vectorStrokeOutlineCache?.clear()
  r.fillGeometryCache?.clear()
  r.strokeGeometryCache?.clear()
  disposePaintResources(r)
  disposeFontResources(r)
  clearRetainedSceneState(r)
  r._flashPaint?.delete()
  r.profiler?.destroy()
  r.surface?.delete()
}
