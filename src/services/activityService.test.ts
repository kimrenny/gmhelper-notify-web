// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activityService } from './activityService'
import { ApiError, createApiClient } from './apiClient'
import type {
  ActivityDetail,
  ActivityListResponse,
  ActivityLogFilter,
} from '../types/activity'

describe('activityService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mockActivityItem = {
    id: '11111111-1111-1111-1111-111111111111',
    eventType: 'template.created',
    actor: {
      type: 'user',
      userId: 'user-owner-123',
      name: 'Owner Admin',
      role: 'owner',
    },
    target: {
      type: 'template',
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Welcome Template',
    },
    status: 'success',
    summary: 'Created template "Welcome Template"',
    createdAt: '2026-09-19T10:00:00Z',
  }

  const mockListResponse: ActivityListResponse = {
    items: [mockActivityItem],
    total: 1,
    limit: 20,
    offset: 0,
  }

  const mockDetailResponse: ActivityDetail = {
    ...mockActivityItem,
    details: {
      templateKey: 'welcome_template',
      version: 1,
      locale: 'en',
    },
    errorMessage: null,
  }

  describe('list / getActivityLogs', () => {
    it('sends GET to /api/v1/activity without query params when no filter is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockListResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const token = 'jwt-owner-token'
      const client = createApiClient(token)
      const result = await activityService.list(undefined, client)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain('/api/v1/activity')
      expect(calledUrl).not.toContain('?')
      expect(calledOptions.method).toBe('GET')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(result).toEqual(mockListResponse)
    })

    it('serializes all supported filters into query parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockListResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const filter: ActivityLogFilter = {
        limit: 50,
        offset: 10,
        eventType: 'automation.created',
        actorUserId: 'u-123',
        targetType: 'automation_rule',
        targetId: 'rule-999',
        status: 'success',
        fromDate: '2026-09-01T00:00:00Z',
        toDate: '2026-09-18T23:59:59Z',
      }

      await activityService.list(filter)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl] = mockFetch.mock.calls[0]
      const url = new URL(calledUrl)

      expect(url.searchParams.get('limit')).toBe('50')
      expect(url.searchParams.get('offset')).toBe('10')
      expect(url.searchParams.get('eventType')).toBe('automation.created')
      expect(url.searchParams.get('actorUserId')).toBe('u-123')
      expect(url.searchParams.get('targetType')).toBe('automation_rule')
      expect(url.searchParams.get('targetId')).toBe('rule-999')
      expect(url.searchParams.get('status')).toBe('success')
      expect(url.searchParams.get('fromDate')).toBe('2026-09-01T00:00:00Z')
      expect(url.searchParams.get('toDate')).toBe('2026-09-18T23:59:59Z')
    })

    it('omits undefined and empty filter parameters from query string', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockListResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const filter: ActivityLogFilter = {
        limit: 10,
        eventType: 'settings.updated',
      }

      await activityService.list(filter)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl] = mockFetch.mock.calls[0]
      const url = new URL(calledUrl)

      expect(url.searchParams.get('limit')).toBe('10')
      expect(url.searchParams.get('eventType')).toBe('settings.updated')
      expect(url.searchParams.has('offset')).toBe(false)
      expect(url.searchParams.has('actorUserId')).toBe(false)
      expect(url.searchParams.has('targetType')).toBe(false)
      expect(url.searchParams.has('targetId')).toBe(false)
      expect(url.searchParams.has('status')).toBe(false)
      expect(url.searchParams.has('fromDate')).toBe(false)
      expect(url.searchParams.has('toDate')).toBe(false)
    })

    it('passes AbortSignal to underlying GET fetch call', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockListResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      await activityService.list(undefined, undefined, controller.signal)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, calledOptions] = mockFetch.mock.calls[0]
      expect(calledOptions.signal).toBe(controller.signal)
    })

    it('getActivityLogs alias works identically to list', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockListResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const result = await activityService.getActivityLogs({ limit: 5 })
      expect(result).toEqual(mockListResponse)
    })
  })

  describe('getById / getActivity', () => {
    it('sends GET to /api/v1/activity/{id} with encoded ID', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockDetailResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const activityId = '11111111-1111-1111-1111-111111111111'
      const token = 'jwt-owner-token'
      const client = createApiClient(token)
      const result = await activityService.getById(activityId, client)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain(`/api/v1/activity/${activityId}`)
      expect(calledOptions.method).toBe('GET')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(result).toEqual(mockDetailResponse)
    })

    it('safely URL-encodes special characters in activity ID', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockDetailResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      await activityService.getById('special/id?test=1')

      const [calledUrl] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain('/api/v1/activity/special%2Fid%3Ftest%3D1')
    })

    it('getActivity alias works identically to getById', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockDetailResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const result = await activityService.getActivity('some-id')
      expect(result).toEqual(mockDetailResponse)
    })
  })

  describe('Error handling', () => {
    it('propagates 401 Unauthorized as ApiError with isUnauthorized: true', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      const client = createApiClient('invalid-or-expired-token')
      await expect(activityService.list(undefined, client)).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
        isUnauthorized: true,
      })
    })

    it('propagates 403 Forbidden as ApiError with isForbidden: true for non-owner role', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      const client = createApiClient('admin-or-user-token')
      await expect(activityService.list(undefined, client)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
        isForbidden: true,
      })
    })

    it('propagates 400 Bad Request on invalid query parameters or malformed UUID', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'INVALID_ARGUMENT', message: 'limit exceeds maximum allowed of 100' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      await expect(activityService.list({ limit: 500 })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_ARGUMENT',
      })
    })

    it('propagates 404 Not Found on nonexistent activity ID', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'activity log not found' } }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      await expect(activityService.getById('nonexistent-uuid')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      })
    })

    it('propagates 500 Internal Server Error as ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'database query failed' } }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      globalThis.fetch = mockFetch

      await expect(activityService.list()).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
      })
    })

    it('handles network failure as ApiError with isNetworkError: true', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

      await expect(activityService.list()).rejects.toThrow(ApiError)
      await expect(activityService.list()).rejects.toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      })
    })
  })
})
