export type DirectDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | string

export interface DirectNotification {
  id: string
  templateId: string
  externalUserId?: string
  recipientEmail: string
  recipientName?: string
  notificationType: string
  deliveryStatus: DirectDeliveryStatus
  attemptsCount: number
  lastAttemptAt?: string
  sentAt?: string
  errorMessage?: string
  payload?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface CreateDirectNotificationInput {
  templateId: string
  externalUserId?: string
  recipientEmail: string
  recipientName?: string
  notificationType?: string
  payload?: Record<string, unknown>
}
