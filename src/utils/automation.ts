export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  success: 'Success',
  skipped_cooldown: 'Skipped (Cooldown)',
  skipped_duplicate: 'Skipped (Duplicate)',
  failed: 'Failed',
}

export function formatExecutionStatus(status?: string): string {
  if (!status) return '-'
  const normalized = status.toLowerCase()
  if (EXECUTION_STATUS_LABELS[normalized]) {
    return EXECUTION_STATUS_LABELS[normalized]
  }
  // Fallback gracefully for unknown statuses: capitalize words or replace underscores
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function getExecutionStatusBadgeStyle(status?: string): {
  background: string
  color: string
} {
  const normalized = (status || '').toLowerCase()
  switch (normalized) {
    case 'success':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'skipped_cooldown':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#fde047' }
    case 'skipped_duplicate':
      return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    default:
      // Neutral fallback for any unknown status
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}
