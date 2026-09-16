import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { Campaign, CreateCampaignInput, UpdateCampaignInput } from '../types/campaign'

export type { Campaign, CampaignStatus, CreateCampaignInput, UpdateCampaignInput } from '../types/campaign'

export interface CampaignService {
  getCampaigns(client?: ApiClient, signal?: AbortSignal): Promise<Campaign[]>
  getCampaign(id: string, client?: ApiClient, signal?: AbortSignal): Promise<Campaign>
  createCampaign(data: CreateCampaignInput, client?: ApiClient, signal?: AbortSignal): Promise<Campaign>
  updateCampaign(id: string, data: UpdateCampaignInput, client?: ApiClient, signal?: AbortSignal): Promise<Campaign>
  deleteCampaign(id: string, client?: ApiClient, signal?: AbortSignal): Promise<void>
  scheduleCampaign(id: string, scheduledAt: string, client?: ApiClient, signal?: AbortSignal): Promise<Campaign>
  cancelCampaign(id: string, client?: ApiClient, signal?: AbortSignal): Promise<Campaign>
}

export const campaignService: CampaignService = {
  async getCampaigns(client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign[]> {
    return client.get<Campaign[]>('/api/v1/campaigns', { signal })
  },

  async getCampaign(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign> {
    return client.get<Campaign>(`/api/v1/campaigns/${encodeURIComponent(id)}`, { signal })
  },

  async createCampaign(data: CreateCampaignInput, client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign> {
    return client.post<Campaign>('/api/v1/campaigns', data, { signal })
  },

  async updateCampaign(id: string, data: UpdateCampaignInput, client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign> {
    return client.put<Campaign>(`/api/v1/campaigns/${encodeURIComponent(id)}`, data, { signal })
  },

  async deleteCampaign(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<void> {
    return client.delete<void>(`/api/v1/campaigns/${encodeURIComponent(id)}`, { signal })
  },

  async scheduleCampaign(id: string, scheduledAt: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign> {
    return client.post<Campaign>(`/api/v1/campaigns/${encodeURIComponent(id)}/schedule`, { scheduledAt }, { signal })
  },

  async cancelCampaign(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<Campaign> {
    return client.post<Campaign>(`/api/v1/campaigns/${encodeURIComponent(id)}/cancel`, {}, { signal })
  },
}

