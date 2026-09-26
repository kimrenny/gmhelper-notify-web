// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignService } from './campaignService'
import { createApiClient } from './apiClient'
import type { Campaign, CreateCampaignInput, UpdateCampaignInput } from '../types/campaign'

describe('campaignService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getCampaigns sends GET to /api/v1/campaigns with authorization', async () => {
    const mockCampaigns: Campaign[] = [
      {
        id: 'camp-1',
        name: 'Welcome Series',
        templateId: 'tpl-1',
        campaignType: 'broadcast',
        status: 'scheduled',
        scheduledAt: '2026-09-15T10:00:00Z',
        createdAt: '2026-09-14T00:00:00Z',
        updatedAt: '2026-09-14T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCampaigns), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-123'
    const client = createApiClient(token)
    const result = await campaignService.getCampaigns(client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns')
    expect(calledOptions.method).toBe('GET')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(mockCampaigns)
  })

  it('getCampaign sends GET to /api/v1/campaigns/{id}', async () => {
    const mockCampaign: Campaign = {
      id: 'camp-123',
      name: 'Special Promo',
      status: 'completed',
      createdAt: '2026-09-10T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCampaign), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-abc')
    const result = await campaignService.getCampaign('camp-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123')
    expect(result).toEqual(mockCampaign)
  })

  it('createCampaign sends POST to /api/v1/campaigns with data payload', async () => {
    const input: CreateCampaignInput = {
      name: 'New Year Campaign',
      templateId: 'tpl-99',
      campaignType: 'broadcast',
      status: 'draft',
    }

    const createdResponse: Campaign = {
      id: 'camp-new',
      name: input.name,
      templateId: input.templateId,
      campaignType: input.campaignType,
      status: input.status ?? 'draft',
      createdAt: '2026-09-14T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-create')
    const result = await campaignService.createCampaign(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(createdResponse)
  })

  it('updateCampaign sends PUT to /api/v1/campaigns/{id} with data payload', async () => {
    const input: UpdateCampaignInput = {
      name: 'Updated Promo Name',
      status: 'scheduled',
    }

    const updatedResponse: Campaign = {
      id: 'camp-123',
      name: 'Updated Promo Name',
      status: 'scheduled',
      createdAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-update')
    const result = await campaignService.updateCampaign('camp-123', input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123')
    expect(calledOptions.method).toBe('PUT')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(updatedResponse)
  })

  it('deleteCampaign sends DELETE to /api/v1/campaigns/{id}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-delete')
    await campaignService.deleteCampaign('camp-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123')
    expect(calledOptions.method).toBe('DELETE')
  })

  it('scheduleCampaign sends POST to /api/v1/campaigns/{id}/schedule with scheduledAt', async () => {
    const scheduledResponse: Campaign = {
      id: 'camp-123',
      name: 'Autumn Promo',
      status: 'scheduled',
      scheduledAt: '2026-10-01T15:30:00Z',
      createdAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(scheduledResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-sched')
    const result = await campaignService.scheduleCampaign('camp-123', '2026-10-01T15:30:00Z', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123/schedule')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify({ scheduledAt: '2026-10-01T15:30:00Z' }))
    expect(result).toEqual(scheduledResponse)
  })

  it('cancelCampaign sends POST to /api/v1/campaigns/{id}/cancel', async () => {
    const cancelledResponse: Campaign = {
      id: 'camp-123',
      name: 'Autumn Promo',
      status: 'cancelled',
      createdAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cancelledResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-cancel')
    const result = await campaignService.cancelCampaign('camp-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123/cancel')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify({}))
    expect(result).toEqual(cancelledResponse)
  })

  it('createCampaign sends POST with audienceFilter payload', async () => {
    const input: CreateCampaignInput = {
      name: 'Targeted Campaign',
      templateId: 'tpl-99',
      campaignType: 'broadcast',
      status: 'draft',
      audienceFilter: {
        role: 'admin',
        language: 'tr',
        registrationDate: 'last_30_days',
        emailConfirmed: 'confirmed',
        accountStatus: 'active',
      },
    }

    const createdResponse: Campaign = {
      id: 'camp-targeted',
      name: input.name,
      templateId: input.templateId,
      campaignType: input.campaignType,
      status: input.status ?? 'draft',
      audienceFilter: input.audienceFilter,
      createdAt: '2026-09-14T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-create')
    const result = await campaignService.createCampaign(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(createdResponse)
  })

  it('updateCampaign sends PUT with audienceFilter payload', async () => {
    const input: UpdateCampaignInput = {
      name: 'Updated Promo With Filters',
      audienceFilter: {
        role: 'user',
        language: 'en',
      },
    }

    const updatedResponse: Campaign = {
      id: 'camp-123',
      name: 'Updated Promo With Filters',
      status: 'draft',
      audienceFilter: input.audienceFilter,
      createdAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-update')
    const result = await campaignService.updateCampaign('camp-123', input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/campaigns/camp-123')
    expect(calledOptions.method).toBe('PUT')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(updatedResponse)
  })

  it('passes AbortSignal to the underlying fetch call', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await campaignService.getCampaigns(undefined, controller.signal)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, calledOptions] = mockFetch.mock.calls[0]
    expect(calledOptions.signal).toBe(controller.signal)
  })
})
