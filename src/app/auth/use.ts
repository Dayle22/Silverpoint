// Composable for Bio Sculpture Access authentication & onboarding

import { computed } from 'vue'
import {
  bootstrapProfile,
  checkSession,
  getSessionState,
  resetSession
} from './session'
import type { BootstrapPayload } from './types'

export {
  bootstrapProfile,
  checkSession,
  getSessionState,
  resetSession
}

export function useAuth() {
  const state = getSessionState()

  const isAuthenticated = computed(() => state.status === 'authenticated' && state.user !== null)
  const isSuspended = computed(() => state.status === 'suspended')
  const needsBootstrap = computed(() => state.needsBootstrap || state.status === 'needs_bootstrap')
  const isLoading = computed(() => state.status === 'loading')
  const currentUser = computed(() => state.user)

  return {
    state,
    isAuthenticated,
    isSuspended,
    needsBootstrap,
    isLoading,
    currentUser,
    checkSession,
    bootstrapProfile: (payload: BootstrapPayload, apiBase = '') => bootstrapProfile(payload, apiBase),
    resetSession
  }
}
