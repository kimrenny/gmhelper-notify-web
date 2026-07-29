export interface Template {
  id: string
  name: string
  description: string
  updatedAt: string
}

export interface TemplateService {
  getTemplates(): Promise<Template[]>
  getTemplate(id: string): Promise<Template | null>
  createTemplate(data: Partial<Template>): Promise<Template>
  updateTemplate(id: string, data: Partial<Template>): Promise<Template>
  deleteTemplate(id: string): Promise<void>
}

export const templateService: TemplateService = {
  async getTemplates() {
    return [
      { id: '1', name: 'Welcome email', description: 'Used for new registrations', updatedAt: '2026-07-20' },
      { id: '2', name: 'Agreement notice', description: 'Used for policy updates', updatedAt: '2026-07-22' },
    ]
  },

  async getTemplate(id: string) {
    return {
      id,
      name: 'Sample template',
      description: 'Placeholder content',
      updatedAt: '2026-07-28',
    }
  },

  async createTemplate(data) {
    return {
      id: 'new-template',
      name: data.name ?? 'New template',
      description: data.description ?? 'Placeholder description',
      updatedAt: '2026-07-28',
    }
  },

  async updateTemplate(id, data) {
    return {
      id,
      name: data.name ?? 'Updated template',
      description: data.description ?? 'Updated description',
      updatedAt: '2026-07-28',
    }
  },

  async deleteTemplate() {
    return undefined
  },
}
