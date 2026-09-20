import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../../hooks/useApiClient'
import { ApiError, automationService } from '../../services'
import type { AutomationExecution, AutomationRule } from '../../types/automation'
import {
  formatDateTime,
  formatExecutionStatus,
  getExecutionStatusBadgeStyle,
} from '../../utils'

export interface AutomationExecutionHistoryDrawerProps {
  rule: AutomationRule | null
  onClose: () => void
}

interface DrawerError {
  type: 'unauthorized' | 'forbidden' | 'not_found' | 'api' | 'network'
  message: string
}

const PAGE_SIZE = 20

export function AutomationExecutionHistoryDrawer({
  rule,
  onClose,
}: AutomationExecutionHistoryDrawerProps) {
  const apiClient = useApiClient()

  const [executions, setExecutions] = useState<AutomationExecution[]>([])
  const [total, setTotal] = useState<number>(0)
  const [offset, setOffset] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<DrawerError | null>(null)

  const fetchExecutions = useCallback(
    async (ruleId: string, currentOffset: number, signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await automationService.getRuleExecutions(
          ruleId,
          { limit: PAGE_SIZE, offset: currentOffset },
          apiClient,
          signal
        )
        setExecutions(data.items ?? [])
        setTotal(data.total ?? 0)
      } catch (err) {
        if (signal?.aborted) {
          return
        }

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.status === 401) {
            setError({
              type: 'unauthorized',
              message: err.message || 'Unauthorized (401): Session is missing or expired.',
            })
          } else if (err.isForbidden || err.status === 403) {
            setError({
              type: 'forbidden',
              message:
                err.message ||
                'Access Denied (403): You do not have permission to view automation history.',
            })
          } else if (err.status === 404) {
            setError({
              type: 'not_found',
              message:
                err.message || 'Rule Not Found (404): The requested automation rule does not exist.',
            })
          } else if (err.isNetworkError || err.status === 0) {
            setError({
              type: 'network',
              message:
                'Connection Error: Failed to reach the server. Please check your network and retry.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load execution history.',
            })
          }
        } else {
          const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
          setError({
            type: 'api',
            message: msg,
          })
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [apiClient]
  )

  // Fetch executions when rule changes or offset changes
  useEffect(() => {
    if (!rule) {
      setExecutions([])
      setTotal(0)
      setOffset(0)
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchExecutions(rule.id, offset, controller.signal)

    return () => {
      controller.abort()
    }
  }, [rule, offset, fetchExecutions])


  // Reset offset to 0 if a different rule is selected
  useEffect(() => {
    setOffset(0)
  }, [rule?.id])

  // Escape key closes drawer
  useEffect(() => {
    if (!rule) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [rule, onClose])

  if (!rule) {
    return null
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canGoPrev = offset > 0 && !isLoading
  const canGoNext = offset + PAGE_SIZE < total && !isLoading

  const handlePrevPage = () => {
    if (canGoPrev) {
      setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
    }
  }

  const handleNextPage = () => {
    if (canGoNext) {
      setOffset((prev) => prev + PAGE_SIZE)
    }
  }

  return (
    <div
      data-testid="execution-history-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="execution-history-title"
        data-testid="execution-history-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '850px',
          height: '100%',
          background: '#181818',
          borderLeft: '1px solid rgba(170, 59, 255, 0.4)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '1.5rem',
          color: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
            gap: '1rem',
          }}
        >
          <div>
            <h2
              id="execution-history-title"
              data-testid="execution-history-rule-name"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {rule.name || 'Automation Rule'}
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '0.35rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                data-testid="execution-history-rule-id"
                className="gm-admin-muted"
                style={{ fontSize: '0.8rem' }}
              >
                Rule ID: {rule.id}
              </span>
              <span
                data-testid="execution-history-trigger-badge"
                style={{
                  display: 'inline-block',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'rgba(170, 59, 255, 0.15)',
                  color: '#c084fc',
                }}
              >
                {rule.config?.trigger || 'Unknown trigger'}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: rule.enabled
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(148, 163, 184, 0.15)',
                  color: rule.enabled ? '#4ade80' : '#94a3b8',
                }}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            data-testid="execution-history-close-btn"
            aria-label="Close execution history"
            onClick={onClose}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            data-testid="execution-history-loading"
            className="gm-admin-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '14rem',
            }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>Loading execution history...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            className="gm-admin-warning"
            role="alert"
            data-testid="execution-history-error"
            style={{
              borderColor:
                error.type === 'forbidden'
                  ? 'rgba(234, 179, 8, 0.4)'
                  : error.type === 'not_found'
                    ? 'rgba(148, 163, 184, 0.4)'
                    : 'rgba(239, 68, 68, 0.4)',
              background:
                error.type === 'forbidden'
                  ? 'rgba(234, 179, 8, 0.12)'
                  : error.type === 'not_found'
                    ? 'rgba(148, 163, 184, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
              color:
                error.type === 'forbidden'
                  ? '#fef08a'
                  : error.type === 'not_found'
                    ? '#cbd5e1'
                    : '#ffd3d3',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: '8px',
            }}
          >
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                {error.type === 'unauthorized' && 'Unauthorized (401)'}
                {error.type === 'forbidden' && 'Access Denied (403)'}
                {error.type === 'not_found' && 'Rule Not Found (404)'}
                {error.type === 'network' && 'Connection Error'}
                {error.type === 'api' && 'API Error'}
              </strong>
              <span style={{ fontSize: '0.9rem' }}>{error.message}</span>
            </div>

            {error.type !== 'not_found' && (
              <div>
                <button
                  type="button"
                  className="gm-admin-btn"
                  data-testid="execution-history-retry-btn"
                  onClick={() => void fetchExecutions(rule.id, offset)}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && executions.length === 0 && (
          <div
            className="gm-admin-card"
            data-testid="execution-history-empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '14rem',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', color: '#cbd5e1', fontSize: '1rem', fontWeight: 500 }}>
              No execution records found
            </p>
            <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              This automation rule has not produced any executions yet.
            </p>
          </div>
        )}

        {/* Executions Table */}
        {!isLoading && !error && executions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              className="gm-admin-card"
              style={{ overflowX: 'auto', padding: 0, borderRadius: '8px' }}
            >
              <table className="gm-admin-table" data-testid="executions-table">
                <thead>
                  <tr>
                    <th>Executed At</th>
                    <th>Status</th>
                    <th>Recipient</th>
                    <th>Event ID</th>
                    <th>User ID</th>
                    <th>Notification ID</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((exec) => (
                    <tr key={exec.id} data-testid={`execution-row-${exec.id}`}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatDateTime(exec.executedAt)}
                      </td>
                      <td>
                        <span
                          data-testid={`execution-status-${exec.id}`}
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            ...getExecutionStatusBadgeStyle(exec.status),
                          }}
                        >
                          {formatExecutionStatus(exec.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {exec.recipientEmail || '-'}
                      </td>
                      <td
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          color: '#cbd5e1',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={exec.eventId}
                      >
                        {exec.eventId || '-'}
                      </td>
                      <td
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          color: '#cbd5e1',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={exec.externalUserId || undefined}
                      >
                        {exec.externalUserId || '-'}
                      </td>
                      <td
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          color: '#cbd5e1',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={exec.notificationId || undefined}
                      >
                        {exec.notificationId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              data-testid="execution-history-pagination"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.5rem 0',
              }}
            >
              <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                Showing {offset + 1} - {Math.min(offset + executions.length, total)} of {total}{' '}
                execution{total === 1 ? '' : 's'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="gm-admin-btn"
                  data-testid="execution-history-prev-btn"
                  onClick={handlePrevPage}
                  disabled={!canGoPrev}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="gm-admin-btn"
                  data-testid="execution-history-next-btn"
                  onClick={handleNextPage}
                  disabled={!canGoNext}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutomationExecutionHistoryDrawer
