import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { Settings, UpdateSettingsInput } from '../types/settings'

export type { Settings, UpdateSettingsInput } from '../types/settings'

export interface SettingsService {
  getSettings(client?: ApiClient, signal?: AbortSignal): Promise<Settings>
  updateSettings(
    data: UpdateSettingsInput,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<Settings>
}

export const settingsService: SettingsService = {
  async getSettings(client: ApiClient = apiClient, signal?: AbortSignal): Promise<Settings> {
    return client.get<Settings>('/api/v1/settings', { signal })
  },

  async updateSettings(
    data: UpdateSettingsInput,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<Settings> {
    return client.put<Settings>('/api/v1/settings', data, { signal })
  },
}
