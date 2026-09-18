export interface AppMetadata {
  title: string
  description: string
}

export type TemplateStatus = 'draft' | 'active' | 'archived'

export type TemplateType = 'direct' | 'campaign' | 'user_agreement' | 'automation'

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  direct: 'Direct Message',
  campaign: 'Campaign',
  user_agreement: 'User Agreement',
  automation: 'Automation',
}

export const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'direct', label: 'Direct Message' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'user_agreement', label: 'User Agreement' },
  { value: 'automation', label: 'Automation' },
]

export interface EmailTemplate {
  id: string
  templateKey: string
  name: string
  templateType: TemplateType
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
  templateType: TemplateType
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
  templateType?: TemplateType
  subject: string
  htmlBody: string
  plainTextBody?: string
  locale?: string
  status?: TemplateStatus | string
  version?: number
}

export interface PreviewTemplateRequest {
  subject?: string
  htmlBody?: string
  plainTextBody?: string
  variables?: Record<string, unknown>
}

export interface PreviewTemplateResponse {
  subject: string
  htmlBody: string
  plainTextBody?: string
}

export * from './auth'
export * from './api'
export * from './campaign'
export * from './dashboard'
export * from './automation'
export * from './agreement'
export * from './direct'
export * from './user'

