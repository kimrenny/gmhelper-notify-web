// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  apiClient,
  ApiError,
  buildUrl,
  createApiClient,
  NOTIFY_API_BASE_URL,
  request,
} from './apiClient'
import { useApiClient } from '../hooks/useApiClient'
import * as useAuthModule from '../hooks/useAuth'

describe('apiClient & ApiError', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  function cleanup() {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  }

  describe('buildUrl', () => {
    it('normalizes endpoint leading slashes and base url', () => {
      expect(buildUrl('http://localhost:8080', '/api/v1/templates')).toBe(
        'http://localhost:8080/api/v1/templates'
      )
      expect(buildUrl('http://localhost:8080', 'api/v1/templates')).toBe(
        'http://localhost:8080/api/v1/templates'
      )
    })

    it('safely serializes query params without including sensitive auth tokens', () => {
      const url = buildUrl('http://localhost:8080', '/api/v1/templates', {
        search: 'welcome',
        page: 1,
        active: true,
        empty: undefined,
        nullVal: null,
      })

      const parsed = new URL(url)
      expect(parsed.searchParams.get('search')).toBe('welcome')
      expect(parsed.searchParams.get('page')).toBe('1')
      expect(parsed.searchParams.get('active')).toBe('true')
      expect(parsed.searchParams.has('empty')).toBe(false)
      expect(parsed.searchParams.has('nullVal')).toBe(false)
      expect(parsed.searchParams.has('token')).toBe(false)
      expect(parsed.searchParams.has('accessToken')).toBe(false)
    })
  })

  describe('request & HTTP methods', () => {
    it('1. Authenticated GET adds the Bearer token in the Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: '1', name: 'Template 1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const token = 'human-jwt-access-token-123'
      const client = createApiClient(token)
      const data = await client.get<Array<{ id: string; name: string }>>('/api/v1/templates')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toBe(`${NOTIFY_API_BASE_URL}/api/v1/templates`)
      expect(calledOptions.method).toBe('GET')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(data).toEqual([{ id: '1', name: 'Template 1' }])
    })

    it('2. POST sends JSON body and Content-Type correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'new-id', name: 'Created' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const token = 'sample-token'
      const client = createApiClient(token)
      const payload = { templateKey: 'welcome_email', name: 'Welcome Email' }

      const result = await client.post('/api/v1/templates', payload)

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toBe(`${NOTIFY_API_BASE_URL}/api/v1/templates`)
      expect(calledOptions.method).toBe('POST')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(calledOptions.body).toBe(JSON.stringify(payload))
      expect(result).toEqual({ id: 'new-id', name: 'Created' })
    })

    it('supports PUT, PATCH, and DELETE methods', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', updated: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: '1', patched: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 204,
          })
        )
      globalThis.fetch = mockFetch

      const client = createApiClient('test-token')

      const putRes = await client.put('/api/v1/templates/1', { name: 'Updated' })
      expect(putRes).toEqual({ id: '1', updated: true })
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT')

      const patchRes = await client.patch('/api/v1/templates/1', { status: 'active' })
      expect(patchRes).toEqual({ id: '1', patched: true })
      expect(mockFetch.mock.calls[1][1].method).toBe('PATCH')

      const delRes = await client.delete('/api/v1/templates/1')
      expect(delRes).toBeUndefined()
      expect(mockFetch.mock.calls[2][1].method).toBe('DELETE')
    })

    it('3. Successful JSON response is parsed and 204 returns undefined', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ count: 42 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 204,
          })
        )
      globalThis.fetch = mockFetch

      const jsonResult = await request<{ count: number }>('/test')
      expect(jsonResult).toEqual({ count: 42 })

      const noContentResult = await request<void>('/test-204')
      expect(noContentResult).toBeUndefined()
    })

    it('4. 401 is exposed as an authentication error with isUnauthorized = true', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Token is expired or invalid',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      await expect(apiClient.get('/api/v1/templates')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError)
        const apiError = err as ApiError
        expect(apiError.status).toBe(401)
        expect(apiError.code).toBe('UNAUTHORIZED')
        expect(apiError.message).toBe('Token is expired or invalid')
        expect(apiError.isUnauthorized).toBe(true)
        expect(apiError.isForbidden).toBe(false)
        expect(apiError.isNetworkError).toBe(false)
        return true
      })
    })

    it('5. 403 is exposed as a forbidden error with isForbidden = true', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions for this resource',
            },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      await expect(apiClient.get('/api/v1/templates')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError)
        const apiError = err as ApiError
        expect(apiError.status).toBe(403)
        expect(apiError.code).toBe('FORBIDDEN')
        expect(apiError.message).toBe('Insufficient permissions for this resource')
        expect(apiError.isForbidden).toBe(true)
        expect(apiError.isUnauthorized).toBe(false)
        return true
      })
    })

    it('6. Network/fetch failure is handled with isNetworkError = true', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      globalThis.fetch = mockFetch

      await expect(apiClient.get('/api/v1/templates')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError)
        const apiError = err as ApiError
        expect(apiError.status).toBe(0)
        expect(apiError.code).toBe('NETWORK_ERROR')
        expect(apiError.isNetworkError).toBe(true)
        expect(apiError.message).toBe('Failed to fetch')
        return true
      })
    })

    it('7. No request contains the token in the URL or query params', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const sensitiveToken = 'very-secret-jwt-token-987'
      const client = createApiClient(sensitiveToken)

      await client.get('/api/v1/templates', { params: { query: 'test' } })

      const [calledUrl] = mockFetch.mock.calls[0]
      expect(calledUrl).not.toContain(sensitiveToken)
      const parsed = new URL(calledUrl)
      expect(parsed.searchParams.has('token')).toBe(false)
      expect(parsed.searchParams.has('jwt')).toBe(false)
      expect(parsed.searchParams.has('accessToken')).toBe(false)
    })

    it('8. The client does not use localStorage or sessionStorage for access tokens', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const sensitiveToken = 'memory-only-token-abc'
      const client = createApiClient(sensitiveToken)

      await client.get('/api/v1/templates')

      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(sessionStorage.getItem('token')).toBeNull()
      expect(sessionStorage.getItem('accessToken')).toBeNull()
    })
  })

  describe('useApiClient hook', () => {
    it('creates an ApiClient with the access token from useAuth()', async () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        accessToken: 'hook-bound-access-token',
        user: null,
        role: 'Admin',
        isAuthenticated: true,
        isLoading: false,
        logout: vi.fn(),
      })

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const { result } = renderHook(() => useApiClient())
      const client = result.current

      await client.get('/api/v1/notifications/direct/pending')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, calledOptions] = mockFetch.mock.calls[0]
      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe('Bearer hook-bound-access-token')
    })
  })
})
