// Auth types for Bio Sculpture Access identity & onboarding

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string
  role: 'member' | 'admin'
}

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'needs_bootstrap'
  | 'suspended'
  | 'unauthenticated'
  | 'error'

export interface SessionState {
  user: AuthenticatedUser | null
  status: AuthStatus
  needsBootstrap: boolean
  bootstrapEmail: string | null
  suggestedName: string | null
  errorMessage: string | null
}

export interface BootstrapPayload {
  turnstileToken: string
  displayName?: string
}
