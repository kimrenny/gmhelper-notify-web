import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authService } from '../services/authService'
import type { AuthContextValue, AuthSession } from '../types/auth'
import { AuthContext } from './authContextBase'

export { AuthContext } from './authContextBase'

const initialSession: AuthSession = {
  isAuthenticated: false,
  accessToken: null,
  role: null,
  user: null,
}

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession>(initialSession)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const initializeAuth = async () => {
      setIsLoading(true)
      try {
        const bootstrappedSession = await authService.bootstrapSession(
          abortController.signal
        )
        if (isMounted) {
          setSession(bootstrappedSession)
        }
      } catch {
        if (isMounted) {
          setSession(initialSession)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initializeAuth()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // Clear state even if logout request fails
    } finally {
      setSession(initialSession)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      accessToken: session.accessToken,
      role: session.role,
      isAuthenticated: session.isAuthenticated,
      isLoading,
      logout,
    }),
    [session, isLoading, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
