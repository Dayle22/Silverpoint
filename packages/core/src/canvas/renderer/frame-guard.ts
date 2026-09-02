export type RenderHealth = 'healthy' | 'degraded' | 'disabled'

export interface FrameGuardState {
  health: RenderHealth
  consecutiveFailures: number
  totalFailures: number
  lastError: string | null
  lastErrorAt: number | null
  /** Frames to skip before retrying after a failure. Grows with backoff. */
  cooldownFrames: number
}

export interface FrameGuardPolicy {
  /** Enter degraded mode after this many consecutive failures. Default 2. */
  degradeAfter: number
  /** Stop attempting renders after this many consecutive failures. Default 10. */
  disableAfter: number
  /** Cap on backoff. Default 60 frames (~1s). */
  maxCooldownFrames: number
}

export const DEFAULT_FRAME_GUARD_POLICY: FrameGuardPolicy = {
  degradeAfter: 2,
  disableAfter: 10,
  maxCooldownFrames: 60,
}

export function createFrameGuardState(): FrameGuardState {
  return {
    health: 'healthy',
    consecutiveFailures: 0,
    totalFailures: 0,
    lastError: null,
    lastErrorAt: null,
    cooldownFrames: 0,
  }
}

/** Record a successful frame. Resets failure counters and restores 'healthy'. */
export function noteFrameSuccess(state: FrameGuardState): void {
  state.consecutiveFailures = 0
  state.cooldownFrames = 0
  state.health = 'healthy'
}

/** Record a failed frame. Advances health and backoff. Returns the new health. */
export function noteFrameFailure(
  state: FrameGuardState,
  error: unknown,
  policy: FrameGuardPolicy = DEFAULT_FRAME_GUARD_POLICY,
): RenderHealth {
  state.consecutiveFailures++
  state.totalFailures++

  let errorMsg: string
  if (error instanceof Error) {
    errorMsg = error.message || error.name || 'Unknown Error'
  } else {
    errorMsg = String(error)
  }
  state.lastError = errorMsg
  state.lastErrorAt = Date.now()

  state.cooldownFrames = Math.min(
    2 ** state.consecutiveFailures,
    policy.maxCooldownFrames
  )

  if (state.consecutiveFailures >= policy.disableAfter) {
    state.health = 'disabled'
  } else if (state.consecutiveFailures >= policy.degradeAfter) {
    state.health = 'degraded'
  } else {
    state.health = 'healthy'
  }

  return state.health
}

/** True when this frame should be skipped because of backoff. Decrements the counter. */
export function shouldSkipFrame(state: FrameGuardState): boolean {
  if (state.cooldownFrames > 0) {
    state.cooldownFrames--
    return true
  }
  return false
}

/** Operator-facing summary. Never include stack traces in production builds. */
export function describeRenderHealth(state: FrameGuardState): string {
  const parts = [
    `Health: ${state.health}`,
    `consecutive failures: ${state.consecutiveFailures}`,
    `total failures: ${state.totalFailures}`,
  ]
  if (state.cooldownFrames > 0) {
    parts.push(`cooldown: ${state.cooldownFrames} frames`)
  }
  if (state.lastError) {
    parts.push(`last error: ${state.lastError}`)
  }
  return parts.join(', ')
}
