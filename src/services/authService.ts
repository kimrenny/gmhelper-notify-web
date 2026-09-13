import type {
  AuthSession,
  JwtPayload,
  RefreshTokenResponse,
  UserDetails,
} from '../types/auth'

const MAIN_API_BASE_URL =
  import.meta.env.VITE_MAIN_API_BASE_URL ?? 'http://localhost:7057'

export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )

    return JSON.parse(jsonPayload) as JwtPayload
  } catch {
    return null
  }
}

export function extractUserRole(token: string): string | null {
  const payload = parseJwt(token)
  if (!payload) return null

  return (
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    payload.role ??
    null
  )
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = parseJwt(token)
  if (!payload || typeof payload.exp !== 'number') {
    return true
  }

  const expirationTimeMs = payload.exp * 1000
  const bufferTimeMs = bufferSeconds * 1000
  return Date.now() >= expirationTimeMs - bufferTimeMs
}

export function isAuthorizedRole(
  role: string | null | undefined
): role is 'Admin' | 'Owner' {
  return role === 'Admin' || role === 'Owner'
}

export async function refreshToken(
  signal?: AbortSignal
): Promise<RefreshTokenResponse> {
  const url = `${MAIN_API_BASE_URL}/api/v1/auth/token/refresh`

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request: '' }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed with status ${response.status}`)
  }

  const data = await response.json()
  const tokenData = (data?.data ?? data) as RefreshTokenResponse

  if (!tokenData?.accessToken) {
    throw new Error('Invalid token refresh response')
  }

  return tokenData
}

export async function loadUserDetails(
  accessToken: string,
  signal?: AbortSignal
): Promise<UserDetails> {
  const url = `${MAIN_API_BASE_URL}/api/v1/user/details`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to load user details with status ${response.status}`)
  }

  const result = await response.json()
  const user = (result?.data ?? result) as UserDetails

  if (!user || typeof user.nickname !== 'string') {
    throw new Error('Invalid user details payload')
  }

  if (user.avatar && !user.avatar.startsWith('data:') && !user.avatar.startsWith('http')) {
    user.avatar = `data:image/jpeg;base64,${user.avatar}`
  }

  return user
}

export async function logout(signal?: AbortSignal): Promise<void> {
  const url = `${MAIN_API_BASE_URL}/api/v1/auth/logout`

  await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal,
  }).catch(() => {
    // Graceful logout even if network request encounters an issue
  })
}

export async function bootstrapSession(
  signal?: AbortSignal
): Promise<AuthSession> {
  try {
    const refreshResult = await refreshToken(signal)
    const { accessToken } = refreshResult

    if (!accessToken || isTokenExpired(accessToken)) {
      return {
        isAuthenticated: false,
        accessToken: null,
        role: null,
        user: null,
      }
    }

    const role = extractUserRole(accessToken)
    if (!isAuthorizedRole(role)) {
      return {
        isAuthenticated: false,
        accessToken: null,
        role: null,
        user: null,
      }
    }

    const user = await loadUserDetails(accessToken, signal)

    return {
      isAuthenticated: true,
      accessToken,
      role,
      user,
    }
  } catch {
    return {
      isAuthenticated: false,
      accessToken: null,
      role: null,
      user: null,
    }
  }
}

export const authService = {
  parseJwt,
  extractUserRole,
  isTokenExpired,
  isAuthorizedRole,
  refreshToken,
  loadUserDetails,
  logout,
  bootstrapSession,
}
