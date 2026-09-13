// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider } from './AuthContext'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'
import type { AuthSession } from '../types/auth'

function TestConsumer() {
  const { user, accessToken, role, isAuthenticated, isLoading, logout } = useAuth()

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="role">{role ?? 'none'}</div>
      <div data-testid="user">{user ? user.nickname : 'none'}</div>
      <div data-testid="token">{accessToken ?? 'none'}</div>
      <button onClick={() => void logout()}>Logout</button>
    </div>
  )
}

describe('AuthContext & useAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Provider starts in loading state', () => {
    // Keep bootstrap unresolved
    vi.spyOn(authService, 'bootstrapSession').mockImplementation(
      () => new Promise<AuthSession>(() => {})
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading').textContent).toBe('loading')
    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('token').textContent).toBe('none')
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('2. Successful Admin bootstrap', async () => {
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: 'jwt-admin-token-123',
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated')
    expect(screen.getByTestId('role').textContent).toBe('Admin')
    expect(screen.getByTestId('user').textContent).toBe('AdminUser')
    expect(screen.getByTestId('token').textContent).toBe('jwt-admin-token-123')
  })

  it('3. Successful Owner bootstrap', async () => {
    const ownerSession: AuthSession = {
      isAuthenticated: true,
      accessToken: 'jwt-owner-token-456',
      role: 'Owner',
      user: {
        nickname: 'OwnerUser',
        avatar: 'data:image/png;base64,sample',
        language: 'fr',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(ownerSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated')
    expect(screen.getByTestId('role').textContent).toBe('Owner')
    expect(screen.getByTestId('user').textContent).toBe('OwnerUser')
    expect(screen.getByTestId('token').textContent).toBe('jwt-owner-token-456')
  })

  it('4. Unauthenticated bootstrap', async () => {
    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue({
      isAuthenticated: false,
      accessToken: null,
      role: null,
      user: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('token').textContent).toBe('none')
  })

  it('handles bootstrapSession rejection gracefully without throwing into UI', async () => {
    vi.spyOn(authService, 'bootstrapSession').mockRejectedValue(new Error('Network failure'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('token').textContent).toBe('none')
  })

  it('5. useAuth() exposes the current session', async () => {
    const contextRef: { current: ReturnType<typeof useAuth> | null } = { current: null }

    function ContextCapture() {
      contextRef.current = useAuth()
      return null
    }

    const session: AuthSession = {
      isAuthenticated: true,
      accessToken: 'sample-token',
      role: 'Admin',
      user: {
        nickname: 'Alice',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(session)

    render(
      <AuthProvider>
        <ContextCapture />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(contextRef.current?.isLoading).toBe(false)
    })

    expect(contextRef.current?.isAuthenticated).toBe(true)
    expect(contextRef.current?.accessToken).toBe('sample-token')
    expect(contextRef.current?.role).toBe('Admin')
    expect(contextRef.current?.user?.nickname).toBe('Alice')
    expect(typeof contextRef.current?.logout).toBe('function')
  })

  it('6. logout() clears authentication state', async () => {
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: 'jwt-admin-token-123',
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    }

    const logoutSpy = vi.spyOn(authService, 'logout').mockResolvedValue()
    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated')

    await act(async () => {
      screen.getByRole('button', { name: /logout/i }).click()
    })

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('token').textContent).toBe('none')
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('7. Authentication state is cleared even when authService.logout() rejects', async () => {
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: 'jwt-admin-token-123',
      role: 'Admin',
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'logout').mockRejectedValue(new Error('Logout network error'))
    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready')
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated')

    await act(async () => {
      screen.getByRole('button', { name: /logout/i }).click()
    })

    expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('token').textContent).toBe('none')
    expect(screen.getByTestId('role').textContent).toBe('none')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('8. The access token is available through context', async () => {
    const secretToken = 'secret-access-token-999'
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: secretToken,
      role: 'Admin',
      user: {
        nickname: 'TokenUser',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe(secretToken)
    })
  })

  it('9. The access token is not persisted to localStorage', async () => {
    const secretToken = 'secret-access-token-local-check'
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: secretToken,
      role: 'Admin',
      user: {
        nickname: 'TokenUser',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe(secretToken)
    })

    expect(localStorage.length).toBe(0)
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('jwt')).toBeNull()
  })

  it('10. The access token is not persisted to sessionStorage', async () => {
    const secretToken = 'secret-access-token-session-check'
    const adminSession: AuthSession = {
      isAuthenticated: true,
      accessToken: secretToken,
      role: 'Admin',
      user: {
        nickname: 'TokenUser',
        avatar: null,
        language: 'en',
      },
    }

    vi.spyOn(authService, 'bootstrapSession').mockResolvedValue(adminSession)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe(secretToken)
    })

    expect(sessionStorage.length).toBe(0)
    expect(sessionStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(sessionStorage.getItem('jwt')).toBeNull()
  })

  it('throws an error when useAuth() is used outside AuthProvider', () => {
    // Suppress console.error in React for boundary throw
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleErrorSpy.mockRestore()
  })
})
