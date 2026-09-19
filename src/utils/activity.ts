import type { ActivityActor, ActivityTarget } from '../types/activity'

export const EVENT_TYPE_LABELS: Record<string, string> = {
  'direct.created': 'Direct Message Created',
  'direct.delivered': 'Direct Message Delivered',
  'direct.failed': 'Direct Message Delivery Failed',
  'campaign.created': 'Campaign Created',
  'campaign.scheduled': 'Campaign Scheduled',
  'campaign.started': 'Campaign Started',
  'campaign.cancelled': 'Campaign Cancelled',
  'campaign.completed': 'Campaign Completed',
  'campaign.failed': 'Campaign Failed',
  'agreement.broadcast_created': 'Agreement Broadcast Created',
  'template.created': 'Template Created',
  'template.updated': 'Template Updated',
  'template.status_changed': 'Template Status Changed',
  'template.archived': 'Template Archived',
  'automation.created': 'Automation Rule Created',
  'automation.updated': 'Automation Rule Updated',
  'automation.enabled': 'Automation Rule Enabled',
  'automation.disabled': 'Automation Rule Disabled',
  'automation.deleted': 'Automation Rule Deleted',
  'settings.updated': 'Settings Updated',
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
  campaign: 'Campaign',
  direct_notification: 'Direct Message',
  template: 'Email Template',
  automation_rule: 'Automation Rule',
  settings: 'System Settings',
  agreement: 'User Agreement',
}

export const STATUS_LABELS: Record<string, string> = {
  success: 'Success',
  warning: 'Warning',
  failure: 'Failure',
}

export const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = Object.entries(
  EVENT_TYPE_LABELS
).map(([value, label]) => ({ value, label }))

export const TARGET_TYPE_OPTIONS: { value: string; label: string }[] = Object.entries(
  TARGET_TYPE_LABELS
).map(([value, label]) => ({ value, label }))

export const STATUS_OPTIONS: { value: string; label: string }[] = Object.entries(
  STATUS_LABELS
).map(([value, label]) => ({ value, label }))

export function formatActivityEventType(eventType?: string): string {
  if (!eventType) return '-'
  return EVENT_TYPE_LABELS[eventType] || eventType.replace(/[_.]/g, ' ')
}

export function formatActivityTargetType(targetType?: string): string {
  if (!targetType) return '-'
  return TARGET_TYPE_LABELS[targetType] || targetType.replace(/_/g, ' ')
}

export function formatActivityActor(actor?: ActivityActor): string {
  if (!actor) return 'System'
  if (actor.name) return actor.name
  if (actor.userId) return `User (${actor.userId})`
  if (actor.type === 'service') return 'Service Account'
  if (actor.type === 'system') return 'System'
  return actor.type ? actor.type.charAt(0).toUpperCase() + actor.type.slice(1) : 'Unknown'
}

export function formatActivityTarget(target?: ActivityTarget): string {
  if (!target) return '-'
  if (target.name) return target.name
  if (target.id) return target.id
  return formatActivityTargetType(target.type)
}

export function getActivityStatusBadgeStyle(status?: string): {
  background: string
  color: string
} {
  const normalized = (status || '').toLowerCase()
  switch (normalized) {
    case 'success':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'warning':
      return { background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }
    case 'failure':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
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
