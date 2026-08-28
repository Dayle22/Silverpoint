// Reactive session store and API bridge for Bio Sculpture Access identity

import { reactive, readonly } from 'vue'
import type { AuthenticatedUser, BootstrapPayload, SessionState } from './types'

const state = reactive<SessionState>({
  user: null,
  status: 'idle',
  needsBootstrap: false,
  bootstrapEmail: null,
  suggestedName: null,
  errorMessage: null
})

export function getSessionState() {
  return readonly(state)
}

export function setSessionState(partial: Partial<SessionState>) {
  Object.assign(state, partial)
}

export async function checkSession(apiBase = ''): Promise<AuthenticatedUser | null> {
  state.status = 'loading'
  state.errorMessage = null

  try {
    const res = await fetch(`${apiBase}/api/session/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    if (res.status === 200) {
      const data = (await res.json()) as {
        user: AuthenticatedUser | null
        needsBootstrap?: boolean
        email?: string
        suggestedName?: string
      }

      if (data.needsBootstrap) {
        state.user = null
        state.needsBootstrap = true
        state.bootstrapEmail = data.email || null
        state.suggestedName = data.suggestedName || null
        state.status = 'needs_bootstrap'
        return null
      }

      if (data.user) {
        state.user = data.user
        state.needsBootstrap = false
        state.bootstrapEmail = null
        state.suggestedName = null
        state.status = 'authenticated'
        return data.user
      }
    }

    if (res.status === 401) {
      state.user = null
      state.status = 'unauthenticated'
      state.errorMessage = 'Cloudflare Access authentication required'
      return null
    }

    if (res.status === 403) {
      const errData = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      const message = errData?.error?.message || 'Access to Bio Sculpture workspace is restricted'
      state.user = null
      state.status = 'suspended'
      state.errorMessage = message
      return null
    }

    state.user = null
    state.status = 'error'
    state.errorMessage = `Session check returned HTTP ${res.status}`
    return null
  } catch (err: unknown) {
    state.user = null
    state.status = 'error'
    state.errorMessage = err instanceof Error ? err.message : 'Network error checking session'
    return null
  }
}

export async function bootstrapProfile(payload: BootstrapPayload, apiBase = ''): Promise<AuthenticatedUser> {
  state.status = 'loading'
  state.errorMessage = null

  try {
    const res = await fetch(`${apiBase}/api/session/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        turnstileToken: payload.turnstileToken,
        displayName: payload.displayName
      })
    })

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      const message = errData?.error?.message || `Bootstrap failed with HTTP ${res.status}`
      state.errorMessage = message
      state.status = res.status === 403 && message.toLowerCase().includes('suspended')
        ? 'suspended'
        : 'needs_bootstrap'
      throw new Error(message)
    }

    const data = (await res.json()) as { user: AuthenticatedUser }
    state.user = data.user
    state.needsBootstrap = false
    state.bootstrapEmail = null
    state.suggestedName = null
    state.status = 'authenticated'
    state.errorMessage = null

    return data.user
  } catch (err: unknown) {
    if (state.status !== 'suspended') {
      state.status = 'needs_bootstrap'
    }
    const message = err instanceof Error ? err.message : 'Bootstrap request failed'
    state.errorMessage = message
    throw err
  }
}

export function resetSession() {
  state.user = null
  state.status = 'idle'
  state.needsBootstrap = false
  state.bootstrapEmail = null
  state.suggestedName = null
  state.errorMessage = null
}
