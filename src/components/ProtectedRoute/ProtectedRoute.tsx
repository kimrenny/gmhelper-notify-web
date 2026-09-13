import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../../hooks'

export interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { role, isAuthenticated, isLoading } = useAuth()

  const mainWebUrl = (
    import.meta.env.VITE_MAIN_WEB_URL ?? 'http://localhost:4200'
  ).replace(/\/+$/, '')

  const isAuthorized = isAuthenticated && (role === 'Admin' || role === 'Owner')

  useEffect(() => {
    if (!isLoading && !isAuthorized) {
      window.location.href = mainWebUrl
    }
  }, [isLoading, isAuthorized, mainWebUrl])

  if (isLoading) {
    return (
      <div
        className="auth-route-loader"
        data-testid="auth-route-loader"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
        }}
      >
        <div className="custom-loader">
          <div className="circle delay2" />
          <div className="circle delay1" />
          <div className="circle" />
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}

export default ProtectedRoute
