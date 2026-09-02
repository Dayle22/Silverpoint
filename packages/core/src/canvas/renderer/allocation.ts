export type AllocationKind = 'surface' | 'snapshot' | 'picture' | 'image'

export interface AllocationRequest {
  kind: AllocationKind
  widthPx: number
  heightPx: number
  bytesPerPixel?: number
}

export type AllocationDecision =
  | { allow: true; bytes: number }
  | { allow: false; bytes: number; reason: 'exceeds-pixel-cap' | 'exceeds-byte-cap' | 'invalid-dimensions' }

export interface AllocationLimits {
  maxDevicePixels: number
  maxBytesPerAllocation: number
}

export interface AllocationHealth {
  failures: number
  lastFailureAt: number | null
  /** Frames remaining before the retained backing may be attempted again. */
  cooldownFrames: number
  /** Device pixel budget currently in use. Reduced after each failure. */
  currentPixelBudget: number
}

export interface CacheBudgetLike {
  totalBytes(): number
  trimTo(targetBytes: number): number
}

export const DEFAULT_MAX_SCENE_BACKING_DEVICE_PIXELS = 16_000_000
export const DEFAULT_MAX_BYTES_PER_ALLOCATION = 128 * 1024 * 1024 // 128 MB
export const MAX_ALLOCATION_COOLDOWN_FRAMES = 600

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function defaultAllocationLimits(deviceMemoryGb?: number): AllocationLimits {
  const memory =
    typeof deviceMemoryGb === 'number' && Number.isFinite(deviceMemoryGb) && deviceMemoryGb > 0
      ? deviceMemoryGb
      : 8
  const factor = clamp(memory / 8, 0.25, 1.5)
  return {
    maxDevicePixels: Math.round(DEFAULT_MAX_SCENE_BACKING_DEVICE_PIXELS * factor),
    maxBytesPerAllocation: Math.round(DEFAULT_MAX_BYTES_PER_ALLOCATION * factor)
  }
}

export function checkAllocation(
  req: AllocationRequest,
  limits: AllocationLimits
): AllocationDecision {
  if (
    !Number.isFinite(req.widthPx) ||
    !Number.isFinite(req.heightPx) ||
    req.widthPx <= 0 ||
    req.heightPx <= 0
  ) {
    return {
      allow: false,
      bytes: 0,
      reason: 'invalid-dimensions'
    }
  }

  const bpp = req.bytesPerPixel ?? 4
  if (!Number.isFinite(bpp) || bpp <= 0) {
    return {
      allow: false,
      bytes: 0,
      reason: 'invalid-dimensions'
    }
  }

  const pixels = Math.ceil(req.widthPx) * Math.ceil(req.heightPx)
  const bytes = Math.ceil(pixels * bpp)

  if (pixels > limits.maxDevicePixels) {
    return {
      allow: false,
      bytes,
      reason: 'exceeds-pixel-cap'
    }
  }

  if (bytes > limits.maxBytesPerAllocation) {
    return {
      allow: false,
      bytes,
      reason: 'exceeds-byte-cap'
    }
  }

  return {
    allow: true,
    bytes
  }
}

/**
 * Run an allocation, returning null instead of throwing on failure.
 * Never let a CanvasKit allocation throw into the render path.
 */
export function tryAllocate<T>(label: string, fn: () => T | null): T | null {
  try {
    const res = fn()
    if (res == null) {
      console.warn(`[Allocation] ${label} returned null`)
      return null
    }
    return res
  } catch (error) {
    console.warn(`[Allocation] ${label} threw during allocation:`, error)
    return null
  }
}

export function createAllocationHealth(initialPixelBudget: number): AllocationHealth {
  return {
    failures: 0,
    lastFailureAt: null,
    cooldownFrames: 0,
    currentPixelBudget: initialPixelBudget
  }
}

export function recordAllocationFailure(
  health: AllocationHealth,
  maxBudget: number,
  cacheBudget?: CacheBudgetLike | null
): void {
  health.failures += 1
  health.lastFailureAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

  // 1. Halve currentPixelBudget, floored at one quarter of the configured maximum.
  const minBudget = Math.floor(maxBudget * 0.25)
  health.currentPixelBudget = Math.max(minBudget, Math.floor(health.currentPixelBudget / 2))

  // 2. Call cacheBudget.trimTo(totalBytes / 2) to release WASM memory immediately.
  if (cacheBudget && typeof cacheBudget.trimTo === 'function') {
    const total = typeof cacheBudget.totalBytes === 'function' ? cacheBudget.totalBytes() : 0
    cacheBudget.trimTo(Math.floor(total / 2))
  }

  // 3. Set cooldownFrames using exponential backoff, capped at 600 frames.
  health.cooldownFrames = Math.min(2 ** health.failures, MAX_ALLOCATION_COOLDOWN_FRAMES)
}

export function recordAllocationSuccess(
  health: AllocationHealth,
  maxBudget: number
): void {
  // On a subsequent successful allocation, step currentPixelBudget back up by 25 percent per success
  // until it reaches the configured maximum.
  const step = Math.floor(maxBudget * 0.25)
  health.currentPixelBudget = Math.min(maxBudget, health.currentPixelBudget + step)
  if (health.currentPixelBudget >= maxBudget) {
    health.failures = 0
  }
  health.cooldownFrames = 0
}

export function stepAllocationCooldown(health: AllocationHealth): boolean {
  if (health.cooldownFrames > 0) {
    health.cooldownFrames -= 1
    return true
  }
  return false
}
