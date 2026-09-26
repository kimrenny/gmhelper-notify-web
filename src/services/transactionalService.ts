import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type {
  TransactionalEmailStats,
  TransactionalFilterParams,
  TransactionalHistoryResponse,
} from '../types/transactional'

export type {
  TransactionalDeliveryStatus,
  TransactionalEmailItem,
  TransactionalEmailStats,
  TransactionalFilterParams,
  TransactionalHistoryResponse,
} from '../types/transactional'

export interface TransactionalService {
  getStats(client?: ApiClient, signal?: AbortSignal): Promise<TransactionalEmailStats>
  getHistory(
    params?: TransactionalFilterParams,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<TransactionalHistoryResponse>
}

export const transactionalService: TransactionalService = {
  async getStats(
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<TransactionalEmailStats> {
    return client.get<TransactionalEmailStats>('/api/v1/notifications/transactional/stats', {
      signal,
    })
  },

  async getHistory(
    params: TransactionalFilterParams = {},
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<TransactionalHistoryResponse> {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.status) query.set('status', params.status)
    if (params.templateKey) query.set('templateKey', params.templateKey)
    if (params.search) query.set('search', params.search)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)

    const queryString = query.toString()
    const path = queryString
      ? `/api/v1/notifications/transactional?${queryString}`
      : '/api/v1/notifications/transactional'

    return client.get<TransactionalHistoryResponse>(path, { signal })
  },
}
