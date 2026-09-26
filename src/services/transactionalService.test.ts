import { describe, expect, it, vi } from 'vitest'
import { transactionalService } from './transactionalService'
import type { ApiClient } from '../types/api'
import type {
  TransactionalEmailStats,
  TransactionalHistoryResponse,
} from '../types/transactional'

describe('transactionalService', () => {
  it('calls getStats with the correct endpoint', async () => {
    const mockStats: TransactionalEmailStats = {
      total: 50,
      sent: 45,
      pending: 3,
      sending: 1,
      failed: 1,
      cancelled: 0,
      successRate: 97.8,
      totalAttempts: 52,
    }

    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue(mockStats),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    }

    const result = await transactionalService.getStats(mockClient)

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/notifications/transactional/stats', {
      signal: undefined,
    })
    expect(result).toEqual(mockStats)
  })

  it('calls getHistory with default parameters when none provided', async () => {
    const mockResponse: TransactionalHistoryResponse = {
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    }

    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue(mockResponse),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    }

    const result = await transactionalService.getHistory({}, mockClient)

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/notifications/transactional', {
      signal: undefined,
    })
    expect(result).toEqual(mockResponse)
  })

  it('calls getHistory with query string when filters and pagination are provided', async () => {
    const mockResponse: TransactionalHistoryResponse = {
      items: [
        {
          id: 'tx-1',
          templateId: 'tpl-1',
          templateKey: 'auth.register_code',
          templateName: 'Registration Code',
          locale: 'en',
          recipientEmail: 'user@example.com',
          notificationType: 'direct',
          deliveryStatus: 'sent',
          attemptsCount: 1,
          createdAt: '2026-09-26T12:00:00Z',
          updatedAt: '2026-09-26T12:00:05Z',
        },
      ],
      total: 1,
      limit: 10,
      offset: 20,
    }

    const mockClient: ApiClient = {
      get: vi.fn().mockResolvedValue(mockResponse),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    }

    const result = await transactionalService.getHistory(
      {
        limit: 10,
        offset: 20,
        status: 'sent',
        templateKey: 'auth.register_code',
        search: 'user@example.com',
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-30T23:59:59Z',
      },
      mockClient
    )

    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/v1/notifications/transactional?limit=10&offset=20&status=sent&templateKey=auth.register_code&search=user%40example.com&from=2026-09-01T00%3A00%3A00Z&to=2026-09-30T23%3A59%3A59Z',
      { signal: undefined }
    )
    expect(result.items).toHaveLength(1)
  })
})
