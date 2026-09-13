// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ProtectedRoute from './ProtectedRoute'
import * as hooks from '../../hooks'
import type { AuthContextValue } from '../../types/auth'

vi.mock('../../hooks', () => ({
  useAuth: vi.fn(),
}))

describe('ProtectedRoute component', () => {
  const mainWebUrl = (
    import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'
  ).replace(/\/+$/, '')

  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuthValue: AuthContextValue = {
      user: null,
      accessToken: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn().mockImplementation(() => Promise.resolve()),
      ...overrides,
    }
    vi.mocked(hooks.useAuth).mockReturnValue(defaultAuthValue)
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    window.location.href = 'http://localhost:5173/'
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Loading state renders neutral loader and does NOT redirect', () => {
    setAuthMock({
      isLoading: true,
      isAuthenticated: false,
      role: null,
      user: null,
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByTestId('auth-route-loader')).toBeDefined()
    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(window.location.href).toBe('http://localhost:5173/')
  })

  it('2. Unauthenticated user is redirected to VITE_MAIN_WEB_URL', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: false,
      role: null,
      user: null,
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(window.location.href.replace(/\/$/, '')).toBe(mainWebUrl)
  })

  it('3. Regular User is redirected to VITE_MAIN_WEB_URL and cannot see content', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: null, // Non-admin / regular user role
      user: {
        nickname: 'RegularUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(window.location.href.replace(/\/$/, '')).toBe(mainWebUrl)
  })

  it('4. Admin can access the protected content / dashboard and 8. content renders', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByTestId('protected-content')).toBeDefined()
    expect(screen.getByText('Dashboard Content')).toBeDefined()
    expect(window.location.href).toBe('http://localhost:5173/')
  })

  it('5. Owner can access the protected content / dashboard and 9. content renders', () => {
    setAuthMock({
      isLoading: false,
      isAuthenticated: true,
      role: 'Owner',
      user: {
        nickname: 'OwnerUser',
        avatar: null,
        language: 'en',
      },
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByTestId('protected-content')).toBeDefined()
    expect(screen.getByText('Dashboard Content')).toBeDefined()
    expect(window.location.href).toBe('http://localhost:5173/')
  })

  it('6. Redirect uses same-tab navigation and 7. contains no authentication data in URL', () => {
    const openSpy = vi.spyOn(window, 'open')

    setAuthMock({
      isLoading: false,
      isAuthenticated: false,
      accessToken: 'secret-token-do-not-leak',
      role: null,
      user: null,
    })

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard Content</div>
      </ProtectedRoute>
    )

    expect(openSpy).not.toHaveBeenCalled()

    const destination = window.location.href
    const parsed = new URL(destination)
    expect(parsed.origin).toBe(new URL(mainWebUrl).origin)
    expect(parsed.searchParams.has('token')).toBe(false)
    expect(parsed.searchParams.has('jwt')).toBe(false)
    expect(parsed.searchParams.has('accessToken')).toBe(false)
    expect(parsed.hash).toBe('')
    expect(destination).not.toContain('secret-token-do-not-leak')
  })
})
