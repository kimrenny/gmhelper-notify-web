import { request } from './apiClient'
import type { CreateTemplateInput, EmailTemplate, UpdateTemplateInput } from '../types'

export interface TemplateService {
  getTemplates(signal?: AbortSignal): Promise<EmailTemplate[]>
  getTemplate(id: string, signal?: AbortSignal): Promise<EmailTemplate>
  createTemplate(data: CreateTemplateInput, signal?: AbortSignal): Promise<EmailTemplate>
  updateTemplate(id: string, data: UpdateTemplateInput, signal?: AbortSignal): Promise<EmailTemplate>
  deleteTemplate(id: string, signal?: AbortSignal): Promise<void>
}

export const templateService: TemplateService = {
  async getTemplates(signal?: AbortSignal): Promise<EmailTemplate[]> {
    return request<EmailTemplate[]>('/api/v1/templates', { signal })
  },

  async getTemplate(id: string, signal?: AbortSignal): Promise<EmailTemplate> {
    return request<EmailTemplate>(`/api/v1/templates/${encodeURIComponent(id)}`, { signal })
  },

  async createTemplate(data: CreateTemplateInput, signal?: AbortSignal): Promise<EmailTemplate> {
    return request<EmailTemplate>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    })
  },

  async updateTemplate(id: string, data: UpdateTemplateInput, signal?: AbortSignal): Promise<EmailTemplate> {
    return request<EmailTemplate>(`/api/v1/templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    })
  },

  async deleteTemplate(id: string, signal?: AbortSignal): Promise<void> {
    return request<void>(`/api/v1/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal,
    })
  },
}
