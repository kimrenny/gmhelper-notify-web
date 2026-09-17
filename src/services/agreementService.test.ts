// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agreementService } from './agreementService'
import { ApiError, createApiClient } from './apiClient'
import type { Campaign } from '../types/campaign'
import type { CreateAgreementBroadcastInput } from '../types/agreement'

describe('agreementService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('createBroadcast sends POST to /api/v1/agreements/broadcast with object input', async () => {
    const input: CreateAgreementBroadcastInput = {
      templateId: 'tpl-101',
      name: 'Q3 Terms Update Broadcast',
    }

    const mockCampaign: Campaign = {
      id: 'camp-agreement-1',
      name: 'Q3 Terms Update Broadcast',
      templateId: 'tpl-101',
      campaignType: 'user_agreement',
      status: 'scheduled',
      scheduledAt: '2026-09-16T12:00:00Z',
      createdAt: '2026-09-16T12:00:00Z',
      updatedAt: '2026-09-16T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCampaign), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-admin'
    const client = createApiClient(token)
    const result = await agreementService.createBroadcast(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/agreements/broadcast')
    expect(calledOptions.method).toBe('POST')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(mockCampaign)
  })

  it('createBroadcast sends POST with positional arguments (templateId, name)', async () => {
    const mockCampaign: Campaign = {
      id: 'camp-agreement-2',
      name: 'Privacy Policy Update',
      templateId: 'tpl-202',
      campaignType: 'user_agreement',
      status: 'scheduled',
      createdAt: '2026-09-16T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCampaign), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('test-token-pos')
    const result = await agreementService.createBroadcast('tpl-202', 'Privacy Policy Update', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/agreements/broadcast')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(
      JSON.stringify({ templateId: 'tpl-202', name: 'Privacy Policy Update' })
    )
    expect(result).toEqual(mockCampaign)
  })

  it('handles optional name when omitted or empty (serializes only templateId)', async () => {
    const mockCampaign: Campaign = {
      id: 'camp-agreement-3',
      name: 'User Agreement - Standard Template',
      templateId: 'tpl-303',
      campaignType: 'user_agreement',
      status: 'scheduled',
      createdAt: '2026-09-16T12:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockCampaign), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    globalThis.fetch = mockFetch

    // 1. Input object without name
    const client = createApiClient('token-1')
    await agreementService.createBroadcast({ templateId: 'tpl-303' }, client)
    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ templateId: 'tpl-303' }))

    // 2. Positional call without name
    await agreementService.createBroadcast('tpl-303', undefined, client)
    expect(mockFetch.mock.calls[1][1].body).toBe(JSON.stringify({ templateId: 'tpl-303' }))

    // 3. Input object with empty string name
    await agreementService.createBroadcast({ templateId: 'tpl-303', name: '' }, client)
    expect(mockFetch.mock.calls[2][1].body).toBe(JSON.stringify({ templateId: 'tpl-303' }))
  })

  it('forwards AbortSignal to underlying request', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'camp-4' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-signal')

    // Object signature with signal
    await agreementService.createBroadcast({ templateId: 'tpl-4' }, client, controller.signal)
    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal)

    // Positional signature with signal
    await agreementService.createBroadcast('tpl-4', 'Name', client, controller.signal)
    expect(mockFetch.mock.calls[1][1].signal).toBe(controller.signal)
  })

  it('preserves 400 Bad Request error (e.g. inactive template or missing fields)', async () => {
    const errorPayload = {
      error: {
        code: 'BAD_REQUEST',
        message: 'referenced template is not active for broadcast',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-bad-request')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-draft' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(400)
      expect(apiErr.statusCode).toBe(400)
      expect(apiErr.code).toBe('BAD_REQUEST')
      expect(apiErr.message).toBe('referenced template is not active for broadcast')
      expect(apiErr.isUnauthorized).toBe(false)
      expect(apiErr.isForbidden).toBe(false)
      return true
    })
  })

  it('preserves 401 Unauthorized error', async () => {
    const errorPayload = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'invalid or missing token',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient(null)

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-1' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(401)
      expect(apiErr.code).toBe('UNAUTHORIZED')
      expect(apiErr.isUnauthorized).toBe(true)
      expect(apiErr.isForbidden).toBe(false)
      return true
    })
  })

  it('preserves 403 Forbidden error', async () => {
    const errorPayload = {
      error: {
        code: 'FORBIDDEN',
        message: 'insufficient permissions',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('regular-user-token')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-1' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(403)
      expect(apiErr.code).toBe('FORBIDDEN')
      expect(apiErr.isForbidden).toBe(true)
      expect(apiErr.isUnauthorized).toBe(false)
      return true
    })
  })

  it('preserves 404 Not Found error (template not found)', async () => {
    const errorPayload = {
      error: {
        code: 'NOT_FOUND',
        message: 'referenced email template not found',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-admin')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-missing' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.code).toBe('NOT_FOUND')
      expect(apiErr.message).toBe('referenced email template not found')
      return true
    })
  })

  it('preserves 409 Conflict error when agreement broadcast is already in progress', async () => {
    const errorPayload = {
      error: {
        code: 'CONFLICT',
        message: 'a user agreement broadcast is already in progress',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-admin')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-101' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(409)
      expect(apiErr.code).toBe('CONFLICT')
      expect(apiErr.message).toBe('a user agreement broadcast is already in progress')
      return true
    })
  })

  it('preserves generic 500 internal server error', async () => {
    const errorPayload = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'failed to create user agreement broadcast',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-admin')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-101' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(500)
      expect(apiErr.code).toBe('INTERNAL_ERROR')
      expect(apiErr.message).toBe('failed to create user agreement broadcast')
      return true
    })
  })

  it('handles network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    globalThis.fetch = mockFetch

    const client = createApiClient('token-admin')

    await expect(
      agreementService.createBroadcast({ templateId: 'tpl-101' }, client)
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(0)
      expect(apiErr.code).toBe('NETWORK_ERROR')
      expect(apiErr.isNetworkError).toBe(true)
      return true
    })
  })
})
