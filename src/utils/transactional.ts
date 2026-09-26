import type { TransactionalDeliveryStatus } from '../types/transactional'

export const TRANSACTIONAL_STATUS_LABELS: Record<TransactionalDeliveryStatus, string> = {
  sent: 'Sent',
  pending: 'Pending',
  sending: 'Sending',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const TRANSACTIONAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'pending', label: 'Pending' },
  { value: 'sending', label: 'Sending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const COMMON_TRANSACTIONAL_TEMPLATES: { value: string; label: string }[] = [
  { value: '', label: 'All templates' },
  { value: 'auth.register_code', label: 'Registration Code (auth.register_code)' },
  { value: 'auth.welcome', label: 'Welcome (auth.welcome)' },
  { value: 'auth.password_recovery', label: 'Password Recovery (auth.password_recovery)' },
  { value: 'auth.ip_confirmation', label: 'New Device Login (auth.ip_confirmation)' },
]

export function getTransactionalStatusBadgeStyle(status?: string): {
  background: string
  color: string
} {
  const normalized = (status || '').toLowerCase()
  switch (normalized) {
    case 'sent':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'sending':
      return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
    case 'pending':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    case 'cancelled':
    default:
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatTemplateKey(key?: string): string {
  if (!key) return '-'
  switch (key) {
    case 'auth.register_code':
      return 'Registration Code'
    case 'auth.welcome':
      return 'Welcome'
    case 'auth.password_recovery':
      return 'Password Recovery'
    case 'auth.ip_confirmation':
      return 'New Device Login'
    default:
      return key
  }
}
