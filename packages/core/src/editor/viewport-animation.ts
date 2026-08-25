import { prefersReducedMotion } from '#core/constants'

import type { EditorContext } from './types'

export const VIEWPORT_ANIMATION_DURATION_MS = 260

export interface ViewportAnimationOptions {
  animate?: boolean
}

export interface ViewportTarget {
  panX: number
  panY: number
  zoom: number
}

export function shouldAnimate(
  start: ViewportTarget,
  target: ViewportTarget,
  options?: ViewportAnimationOptions
): boolean {
  if (options?.animate === false) return false
  if (typeof requestAnimationFrame === 'undefined') return false
  if (prefersReducedMotion()) return false

  const zoomRatioDelta = start.zoom !== 0 ? Math.abs(target.zoom - start.zoom) / start.zoom : 0
  const isZoomNegligible = zoomRatioDelta < 0.005
  const isPanXNegligible = Math.abs(target.panX - start.panX) < 1
  const isPanYNegligible = Math.abs(target.panY - start.panY) < 1

  if (isZoomNegligible && isPanXNegligible && isPanYNegligible) {
    return false
  }

  return true
}

function emitViewportChanged(ctx: EditorContext, previous: ViewportTarget) {
  const next = { panX: ctx.state.panX, panY: ctx.state.panY, zoom: ctx.state.zoom }
  if (next.panX !== previous.panX || next.panY !== previous.panY || next.zoom !== previous.zoom) {
    ctx.emitEditorEvent('viewport:changed', next, previous)
  }
}

function resolveTimestamp(timestamp?: number): number {
  if (typeof timestamp === 'number') return timestamp
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

export function createViewportAnimator(ctx: EditorContext) {
  let rafHandle: number | null = null
  let targetViewport: ViewportTarget | null = null
  let initialPrevious: ViewportTarget | null = null

  function isAnimating(): boolean {
    return rafHandle !== null
  }

  function cancel() {
    if (rafHandle !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafHandle)
      }
      rafHandle = null
      const prev = initialPrevious
      targetViewport = null
      initialPrevious = null
      if (prev) {
        emitViewportChanged(ctx, prev)
      }
    }
  }

  function settle() {
    if (rafHandle !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafHandle)
      }
      rafHandle = null
      const target = targetViewport
      const prev = initialPrevious
      targetViewport = null
      initialPrevious = null
      if (target) {
        ctx.state.panX = target.panX
        ctx.state.panY = target.panY
        ctx.state.zoom = target.zoom
        ctx.requestRepaint()
      }
      if (prev) {
        emitViewportChanged(ctx, prev)
      }
    }
  }

  function animateTo(
    target: ViewportTarget,
    previous: ViewportTarget,
    options?: ViewportAnimationOptions
  ) {
    cancel()

    const start: ViewportTarget = {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom
    }

    if (!shouldAnimate(start, target, options)) {
      ctx.state.panX = target.panX
      ctx.state.panY = target.panY
      ctx.state.zoom = target.zoom
      ctx.requestRepaint()
      emitViewportChanged(ctx, previous)
      return
    }

    const { width: viewW, height: viewH } = ctx.getViewportSize()
    const c0x = (viewW / 2 - start.panX) / start.zoom
    const c0y = (viewH / 2 - start.panY) / start.zoom
    const c1x = (viewW / 2 - target.panX) / target.zoom
    const c1y = (viewH / 2 - target.panY) / target.zoom

    targetViewport = { ...target }
    initialPrevious = { ...previous }

    let startTimestamp: number | null = null

    const step = (timestamp?: number) => {
      const ts = resolveTimestamp(timestamp)

      if (startTimestamp === null) {
        startTimestamp = ts
      }
      const elapsed = ts - startTimestamp
      const progress = Math.min(1, Math.max(0, elapsed / VIEWPORT_ANIMATION_DURATION_MS))

      if (progress < 1) {
        const e = 1 - (1 - progress) ** 3
        const currentZoom = start.zoom * (target.zoom / start.zoom) ** e
        const currentCenterX = c0x + (c1x - c0x) * e
        const currentCenterY = c0y + (c1y - c0y) * e

        ctx.state.zoom = currentZoom
        ctx.state.panX = viewW / 2 - currentCenterX * currentZoom
        ctx.state.panY = viewH / 2 - currentCenterY * currentZoom
        ctx.requestRepaint()

        if (typeof requestAnimationFrame === 'function') {
          rafHandle = requestAnimationFrame(step)
        } else {
          settle()
        }
      } else {
        rafHandle = null
        const finalTarget = targetViewport ?? target
        const prev = initialPrevious ?? previous
        targetViewport = null
        initialPrevious = null

        ctx.state.panX = finalTarget.panX
        ctx.state.panY = finalTarget.panY
        ctx.state.zoom = finalTarget.zoom
        ctx.requestRepaint()
        emitViewportChanged(ctx, prev)
      }
    }

    if (typeof requestAnimationFrame === 'function') {
      rafHandle = requestAnimationFrame(step)
    } else {
      ctx.state.panX = target.panX
      ctx.state.panY = target.panY
      ctx.state.zoom = target.zoom
      ctx.requestRepaint()
      emitViewportChanged(ctx, previous)
    }
  }

  return {
    animateTo,
    cancel,
    settle,
    isAnimating
  }
}
