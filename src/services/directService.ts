import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type {
  CreateDirectNotificationInput,
  DirectNotification,
} from '../types/direct'

export type {
  CreateDirectNotificationInput,
  DirectDeliveryStatus,
  DirectNotification,
} from '../types/direct'

export interface DirectService {
  createNotification(
    input: CreateDirectNotificationInput,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification>
  deliverNotification(
    id: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification>
  getNotification(
    id: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification>
  listPending(
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification[]>
}

export const directService: DirectService = {
  async createNotification(
    input: CreateDirectNotificationInput,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification> {
    return client.post<DirectNotification>('/api/v1/notifications/direct', input, { signal })
  },

  async deliverNotification(
    id: string,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification> {
    return client.post<DirectNotification>(
      `/api/v1/notifications/direct/${encodeURIComponent(id)}/deliver`,
      {},
      { signal }
    )
  },

  async getNotification(
    id: string,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification> {
    return client.get<DirectNotification>(
      `/api/v1/notifications/direct/${encodeURIComponent(id)}`,
      { signal }
    )
  },

  async listPending(
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<DirectNotification[]> {
    return client.get<DirectNotification[]>('/api/v1/notifications/direct/pending', { signal })
  },
}
