import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { CreateTemplateInput, EmailTemplate, UpdateTemplateInput } from '../types'

export interface TemplateService {
  getTemplates(client?: ApiClient, signal?: AbortSignal): Promise<EmailTemplate[]>
  getTemplate(id: string, client?: ApiClient, signal?: AbortSignal): Promise<EmailTemplate>
  createTemplate(data: CreateTemplateInput, client?: ApiClient, signal?: AbortSignal): Promise<EmailTemplate>
  updateTemplate(id: string, data: UpdateTemplateInput, client?: ApiClient, signal?: AbortSignal): Promise<EmailTemplate>
  deleteTemplate(id: string, client?: ApiClient, signal?: AbortSignal): Promise<void>
}

export const templateService: TemplateService = {
  async getTemplates(client: ApiClient = apiClient, signal?: AbortSignal): Promise<EmailTemplate[]> {
    return client.get<EmailTemplate[]>('/api/v1/templates', { signal })
  },

  async getTemplate(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<EmailTemplate> {
    return client.get<EmailTemplate>(`/api/v1/templates/${encodeURIComponent(id)}`, { signal })
  },

  async createTemplate(data: CreateTemplateInput, client: ApiClient = apiClient, signal?: AbortSignal): Promise<EmailTemplate> {
    return client.post<EmailTemplate>('/api/v1/templates', data, { signal })
  },

  async updateTemplate(id: string, data: UpdateTemplateInput, client: ApiClient = apiClient, signal?: AbortSignal): Promise<EmailTemplate> {
    return client.put<EmailTemplate>(`/api/v1/templates/${encodeURIComponent(id)}`, data, { signal })
  },

  async deleteTemplate(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<void> {
    return client.delete<void>(`/api/v1/templates/${encodeURIComponent(id)}`, { signal })
  },
}
