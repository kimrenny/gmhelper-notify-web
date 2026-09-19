import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type {
  ActivityDetail,
  ActivityListResponse,
  ActivityLogFilter,
} from '../types/activity'

export type {
  ActivityActor,
  ActivityActorType,
  ActivityDetail,
  ActivityDetails,
  ActivityListItem,
  ActivityListResponse,
  ActivityLogFilter,
  ActivityStatus,
  ActivityTarget,
  ActivityTargetType,
} from '../types/activity'

export interface ActivityService {
  list(
    filter?: ActivityLogFilter,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<ActivityListResponse>
  getById(
    id: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<ActivityDetail>
  getActivityLogs(
    filter?: ActivityLogFilter,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<ActivityListResponse>
  getActivity(
    id: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<ActivityDetail>
}

export const activityService: ActivityService = {
  async list(
    filter?: ActivityLogFilter,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<ActivityListResponse> {
    const params: Record<string, string | number | boolean | undefined | null> = {}

    if (filter) {
      if (typeof filter.limit === 'number') {
        params.limit = filter.limit
      }
      if (typeof filter.offset === 'number') {
        params.offset = filter.offset
      }
      if (filter.eventType) {
        params.eventType = filter.eventType
      }
      if (filter.actorUserId) {
        params.actorUserId = filter.actorUserId
      }
      if (filter.targetType) {
        params.targetType = filter.targetType
      }
      if (filter.targetId) {
        params.targetId = filter.targetId
      }
      if (filter.status) {
        params.status = filter.status
      }
      if (filter.fromDate) {
        params.fromDate = filter.fromDate
      }
      if (filter.toDate) {
        params.toDate = filter.toDate
      }
    }

    return client.get<ActivityListResponse>('/api/v1/activity', {
      params,
      signal,
    })
  },

  async getById(
    id: string,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<ActivityDetail> {
    return client.get<ActivityDetail>(
      `/api/v1/activity/${encodeURIComponent(id)}`,
      { signal }
    )
  },

  async getActivityLogs(
    filter?: ActivityLogFilter,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<ActivityListResponse> {
    return this.list(filter, client, signal)
  },

  async getActivity(
    id: string,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<ActivityDetail> {
    return this.getById(id, client, signal)
  },
}
