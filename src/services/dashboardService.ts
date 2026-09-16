import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { DashboardStats } from '../types/dashboard'

export type {
  DashboardCampaignStats,
  DashboardTemplateStats,
  DashboardDeliveryStats,
  RecentCampaignItem,
  DashboardStats,
} from '../types/dashboard'

export interface DashboardService {
  getStats(client?: ApiClient, signal?: AbortSignal): Promise<DashboardStats>
}

export const dashboardService: DashboardService = {
  async getStats(client: ApiClient = apiClient, signal?: AbortSignal): Promise<DashboardStats> {
    return client.get<DashboardStats>('/api/v1/dashboard/stats', { signal })
  },
}
