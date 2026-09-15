// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardService } from './dashboardService'
import { ApiError, createApiClient } from './apiClient'
import type { DashboardStats } from '../types/dashboard'

describe('dashboardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mockStats: DashboardStats = {
    campaigns: {
      total: 10,
      draft: 2,
      scheduled: 1,
      running: 1,
      sending: 1,
      completed: 4,
      partiallyFailed: 0,
      failed: 1,
      cancelled: 0,
    },
    templates: {
      total: 6,
      draft: 1,
      active: 5,
      archived: 0,
    },
    deliveries: {
      totalMessages: 1250,
      totalSent: 1200,
      totalFailed: 25,
      totalPending: 20,
      totalSending: 5,
      successRate: 96.0,
    },
    recentCampaigns: [
      {
        id: 'camp-101',
        name: 'September Newsletter',
        templateId: 'tpl-1',
        templateName: 'Monthly Newsletter',
        campaignType: 'broadcast',
        status: 'completed',
        scheduledAt: '2026-09-15T08:00:00Z',
        startedAt: '2026-09-15T08:00:05Z',
        completedAt: '2026-09-15T08:05:00Z',
        createdAt: '2026-09-14T10:00:00Z',
      },
      {
        id: 'camp-102',
        name: 'Flash Sale Announcement',
        templateId: 'tpl-2',
        templateName: 'Promotional Blast',
        campaignType: 'broadcast',
        status: 'draft',
        createdAt: '2026-09-15T11:00:00Z',
      },
    ],
  }

  it('getStats sends GET to /api/v1/dashboard/stats with Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-jwt-dashboard'
    const client = createApiClient(token)
    const result = await dashboardService.getStats(client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/dashboard/stats')
    expect(calledOptions.method).toBe('GET')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(mockStats)
  })

  it('getStats parses and returns complete DashboardStats data structure', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const result = await dashboardService.getStats()

    expect(result.campaigns.total).toBe(10)
    expect(result.campaigns.draft).toBe(2)
    expect(result.campaigns.scheduled).toBe(1)
    expect(result.campaigns.running).toBe(1)
    expect(result.campaigns.sending).toBe(1)
    expect(result.campaigns.completed).toBe(4)
    expect(result.campaigns.partiallyFailed).toBe(0)
    expect(result.campaigns.failed).toBe(1)
    expect(result.campaigns.cancelled).toBe(0)

    expect(result.templates.total).toBe(6)
    expect(result.templates.draft).toBe(1)
    expect(result.templates.active).toBe(5)
    expect(result.templates.archived).toBe(0)

    expect(result.deliveries.totalMessages).toBe(1250)
    expect(result.deliveries.totalSent).toBe(1200)
    expect(result.deliveries.totalFailed).toBe(25)
    expect(result.deliveries.totalPending).toBe(20)
    expect(result.deliveries.totalSending).toBe(5)
    expect(result.deliveries.successRate).toBe(96.0)

    expect(result.recentCampaigns).toHaveLength(2)
    expect(result.recentCampaigns[0].id).toBe('camp-101')
    expect(result.recentCampaigns[0].name).toBe('September Newsletter')
    expect(result.recentCampaigns[0].status).toBe('completed')
    expect(result.recentCampaigns[1].id).toBe('camp-102')
    expect(result.recentCampaigns[1].name).toBe('Flash Sale Announcement')
    expect(result.recentCampaigns[1].status).toBe('draft')
  })

  it('propagates HTTP error when API returns non-2xx status', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Internal Server Error', code: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-err')
    await expect(dashboardService.getStats(client)).rejects.toThrow(ApiError)
  })

  it('propagates 401 Unauthorized as ApiError with isUnauthorized flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('expired-token')
    await expect(dashboardService.getStats(client)).rejects.toMatchObject({
      status: 401,
      isUnauthorized: true,
    })
  })

  it('propagates network failure as ApiError', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    globalThis.fetch = mockFetch

    const client = createApiClient('token-net')
    await expect(dashboardService.getStats(client)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      isNetworkError: true,
    })
  })

  it('passes AbortSignal to the underlying fetch call', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockStats), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await dashboardService.getStats(undefined, controller.signal)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, calledOptions] = mockFetch.mock.calls[0]
    expect(calledOptions.signal).toBe(controller.signal)
  })
})
