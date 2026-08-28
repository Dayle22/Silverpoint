import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  checkSession,
  bootstrapProfile,
  resetSession
} from '@/app/auth/session'
import { useAuth } from '@/app/auth/use'

describe('App Auth & Session Management', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    resetSession()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    resetSession()
  })

  it('initialises with idle state', () => {
    const auth = useAuth()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.needsBootstrap.value).toBe(false)
    expect(auth.isSuspended.value).toBe(false)
    expect(auth.currentUser.value).toBeNull()
  })

  it('updates state to authenticated when checkSession returns existing member', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/session/me')) {
        return new Response(
          JSON.stringify({
            user: {
              id: 'usr_123',
              email: 'artist@biosculpture.com',
              displayName: 'Artist Sarah',
              role: 'member'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }
    globalThis.fetch = mockFetch

    const auth = useAuth()
    const user = await checkSession()

    expect(user).not.toBeNull()
    expect(user?.email).toBe('artist@biosculpture.com')
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.needsBootstrap.value).toBe(false)
    expect(auth.currentUser.value?.displayName).toBe('Artist Sarah')
  })

  it('sets needsBootstrap when user needs first-login profile onboarding', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/session/me')) {
        return new Response(
          JSON.stringify({
            user: null,
            needsBootstrap: true,
            email: 'newuser@biosculpture.com',
            suggestedName: 'New User'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }
    globalThis.fetch = mockFetch

    const auth = useAuth()
    const user = await checkSession()

    expect(user).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.needsBootstrap.value).toBe(true)
    expect(auth.state.bootstrapEmail).toBe('newuser@biosculpture.com')
    expect(auth.state.suggestedName).toBe('New User')
  })

  it('transitions from needs_bootstrap to authenticated on successful bootstrap', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/session/bootstrap') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { turnstileToken: string; displayName?: string }
        return new Response(
          JSON.stringify({
            user: {
              id: 'usr_new_789',
              email: 'newuser@biosculpture.com',
              displayName: body.displayName || 'New User',
              role: 'member'
            }
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }
    globalThis.fetch = mockFetch

    const auth = useAuth()
    const user = await bootstrapProfile({
      turnstileToken: 'test_token',
      displayName: 'Sarah Customized'
    })

    expect(user.id).toBe('usr_new_789')
    expect(user.displayName).toBe('Sarah Customized')
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.needsBootstrap.value).toBe(false)
  })

  it('handles 403 suspended status cleanly without storing credentials', async () => {
    const mockFetch: typeof fetch = async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/api/session/me')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'forbidden',
              message: 'Your Bio Sculpture workspace account is suspended'
            }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('Not found', { status: 404 })
    }
    globalThis.fetch = mockFetch

    const auth = useAuth()
    await checkSession()

    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.isSuspended.value).toBe(true)
    expect(auth.state.errorMessage).toContain('suspended')
  })
})
