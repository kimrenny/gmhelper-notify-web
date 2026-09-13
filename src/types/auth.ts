export interface UserDetails {
  avatar: string | null
  nickname: string
  language: string
  twoFactor?: boolean
  alwaysAsk?: boolean
}

export interface RefreshTokenResponse {
  accessToken: string
}

export interface JwtPayload {
  sub?: string
  role?: string
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string
  exp?: number
  [key: string]: unknown
}

export type AuthRole = 'Admin' | 'Owner' | 'User' | string

export interface AuthenticatedSession {
  isAuthenticated: true
  accessToken: string
  role: 'Admin' | 'Owner'
  user: UserDetails
}

export interface UnauthenticatedSession {
  isAuthenticated: false
  accessToken: null
  role: null
  user: null
}

export type AuthSession = AuthenticatedSession | UnauthenticatedSession

export interface AuthContextValue {
  user: UserDetails | null
  accessToken: string | null
  role: 'Admin' | 'Owner' | null
  isAuthenticated: boolean
  isLoading: boolean
  logout: () => Promise<void>
}
