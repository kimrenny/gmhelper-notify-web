export interface AppMetadata {
  title: string
  description: string
}

export type TemplateStatus = 'draft' | 'active' | 'archived'

export interface EmailTemplate {
  id: string
  templateKey: string
  name: string
  subject: string
  htmlBody: string
  plainTextBody?: string
  locale: string
  status: TemplateStatus | string
  version: number
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateInput {
  templateKey: string
  name: string
  subject: string
  htmlBody: string
  plainTextBody?: string
  locale?: string
  status?: TemplateStatus | string
  version?: number
}

export interface UpdateTemplateInput {
  templateKey: string
  name: string
  subject: string
  htmlBody: string
  plainTextBody?: string
  locale?: string
  status?: TemplateStatus | string
  version?: number
}

export * from './auth'
export * from './api'
export * from './campaign'
