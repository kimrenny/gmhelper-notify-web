import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapSession,
  extractUserRole,
  isAuthorizedRole,
  isTokenExpired,
  loadUserDetails,
  logout,
  parseJwt,
  refreshToken,
} from './authService'

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${body}.fake_signature`
}

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseJwt & claims', () => {
    it('should correctly parse valid JWT claims', () => {
      const token = createMockJwt({
        sub: 'user-123',
        role: 'Admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      const payload = parseJwt(token)
      expect(payload).not.toBeNull()
      expect(payload?.sub).toBe('user-123')
      expect(payload?.role).toBe('Admin')
    })

    it('should return null for malformed tokens', () => {
      expect(parseJwt('not-a-valid-token')).toBeNull()
      expect(parseJwt('part1.part2')).toBeNull()
      expect(parseJwt('')).toBeNull()
    })

    it('should extract role from both standard claim and URI claim schema', () => {
      const tokenWithRole = createMockJwt({ role: 'Admin' })
      expect(extractUserRole(tokenWithRole)).toBe('Admin')

      const tokenWithUriRole = createMockJwt({
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Owner',
      })
      expect(extractUserRole(tokenWithUriRole)).toBe('Owner')

      const tokenWithoutRole = createMockJwt({ sub: '123' })
      expect(extractUserRole(tokenWithoutRole)).toBeNull()
    })

    it('should correctly detect token expiration and active status', () => {
      const nowSeconds = Math.floor(Date.now() / 1000)

      const activeToken = createMockJwt({ exp: nowSeconds + 600 })
      expect(isTokenExpired(activeToken)).toBe(false)

      const expiredToken = createMockJwt({ exp: nowSeconds - 100 })
      expect(isTokenExpired(expiredToken)).toBe(true)

      const soonExpiringToken = createMockJwt({ exp: nowSeconds + 10 })
      expect(isTokenExpired(soonExpiringToken, 30)).toBe(true)

      const tokenWithoutExp = createMockJwt({ sub: 'user' })
      expect(isTokenExpired(tokenWithoutExp)).toBe(true)
    })

    it('should authorize only Admin and Owner roles and reject User role', () => {
      expect(isAuthorizedRole('Admin')).toBe(true)
      expect(isAuthorizedRole('Owner')).toBe(true)
      expect(isAuthorizedRole('User')).toBe(false)
      expect(isAuthorizedRole('Guest')).toBe(false)
      expect(isAuthorizedRole(null)).toBe(false)
      expect(isAuthorizedRole(undefined)).toBe(false)
    })
  })

  describe('refreshToken()', () => {
    it('should make POST request with credentials include and return access token', async () => {
      const mockToken = createMockJwt({ role: 'Admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: mockToken }),
      } as Response)

      const result = await refreshToken()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toContain('/api/v1/auth/token/refresh')
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
      expect(url).not.toContain(mockToken)
      expect(result.accessToken).toBe(mockToken)
    })

    it('should throw error when refresh fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      await expect(refreshToken()).rejects.toThrow('Token refresh failed with status 401')
    })
  })

  describe('loadUserDetails()', () => {
    it('should send Authorization Bearer header and return formatted user details', async () => {
      const mockToken = 'sample-human-jwt'
      const mockUser = {
        nickname: 'Alice',
        avatar: 'base64rawavatarstring',
        language: 'en',
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      } as Response)

      const user = await loadUserDetails(mockToken)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toContain('/api/v1/user/details')
      expect(url).not.toContain(mockToken)
      expect((init?.headers as Record<string, string>)?.Authorization).toBe(`Bearer ${mockToken}`)
      expect(user.nickname).toBe('Alice')
      expect(user.avatar).toBe('data:image/jpeg;base64,base64rawavatarstring')
    })

    it('should throw when user details request fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

      await expect(loadUserDetails('bad-token')).rejects.toThrow('Failed to load user details with status 403')
    })
  })

  describe('logout()', () => {
    it('should send POST request with credentials include', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
      } as Response)

      await logout()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toContain('/api/v1/auth/logout')
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
    })
  })

  describe('bootstrapSession()', () => {
    it('should return authenticated session when Admin logs in', async () => {
      const adminToken = createMockJwt({
        sub: 'user-admin-1',
        role: 'Admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accessToken: adminToken }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              nickname: 'AdminUser',
              avatar: null,
              language: 'en',
            },
          }),
        } as Response)

      const session = await bootstrapSession()

      expect(session.isAuthenticated).toBe(true)
      if (session.isAuthenticated) {
        expect(session.accessToken).toBe(adminToken)
        expect(session.role).toBe('Admin')
        expect(session.user.nickname).toBe('AdminUser')
      }
    })

    it('should return authenticated session when Owner logs in', async () => {
      const ownerToken = createMockJwt({
        sub: 'user-owner-1',
        role: 'Owner',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accessToken: ownerToken }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              nickname: 'OwnerUser',
              avatar: null,
              language: 'en',
            },
          }),
        } as Response)

      const session = await bootstrapSession()

      expect(session.isAuthenticated).toBe(true)
      if (session.isAuthenticated) {
        expect(session.accessToken).toBe(ownerToken)
        expect(session.role).toBe('Owner')
        expect(session.user.nickname).toBe('OwnerUser')
      }
    })

    it('should return unauthenticated session when regular User logs in', async () => {
      const userToken = createMockJwt({
        sub: 'user-regular-1',
        role: 'User',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: userToken }),
      } as Response)

      const session = await bootstrapSession()

      expect(session.isAuthenticated).toBe(false)
      expect(session.accessToken).toBeNull()
      expect(session.role).toBeNull()
      expect(session.user).toBeNull()
    })

    it('should return unauthenticated session when refresh fails without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const session = await bootstrapSession()

      expect(session.isAuthenticated).toBe(false)
      expect(session.accessToken).toBeNull()
      expect(session.user).toBeNull()
    })

    it('should return unauthenticated session when token is expired', async () => {
      const expiredToken = createMockJwt({
        role: 'Admin',
        exp: Math.floor(Date.now() / 1000) - 500,
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: expiredToken }),
      } as Response)

      const session = await bootstrapSession()

      expect(session.isAuthenticated).toBe(false)
      expect(session.accessToken).toBeNull()
    })
  })
})
