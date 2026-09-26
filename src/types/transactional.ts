export type TransactionalDeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'

export interface TransactionalEmailItem {
  id: string
  templateId: string
  templateKey: string
  templateName: string
  locale: string
  externalUserId?: string
  recipientEmail: string
  recipientName?: string
  notificationType: string
  deliveryStatus: TransactionalDeliveryStatus
  attemptsCount: number
  lastAttemptAt?: string
  sentAt?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface TransactionalEmailStats {
  total: number
  sent: number
  pending: number
  sending: number
  failed: number
  cancelled: number
  successRate: number
  totalAttempts: number
}

export interface TransactionalFilterParams {
  status?: string
  templateKey?: string
  search?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface TransactionalHistoryResponse {
  items: TransactionalEmailItem[]
  total: number
  limit: number
  offset: number
}
