import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../../hooks/useApiClient'
import { activityService, ApiError } from '../../services'
import type { ActivityDetail } from '../../types/activity'
import {
  formatActivityActor,
  formatActivityEventType,
  formatActivityTarget,
  formatActivityTargetType,
  formatDateTime,
  getActivityStatusBadgeStyle,
} from '../../utils/activity'

export interface ActivityDetailDrawerProps {
  activityId: string | null
  onClose: () => void
}

interface DetailError {
  type: 'unauthorized' | 'forbidden' | 'not_found' | 'api' | 'network'
  message: string
}

function renderValue(val: unknown): string {
  if (val === null) return 'null'
  if (val === undefined) return '-'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

function isComplexValue(val: unknown): boolean {
  return typeof val === 'object' && val !== null
}

export function ActivityDetailDrawer({ activityId, onClose }: ActivityDetailDrawerProps) {
  const apiClient = useApiClient()

  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<DetailError | null>(null)

  const fetchDetail = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await activityService.getById(id, apiClient, signal)
        setActivity(data)
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
                err.message || 'Access Denied (403): Activity details are restricted to Owner users.',
            })
          } else if (err.status === 404) {
            setError({
              type: 'not_found',
              message:
                err.message || 'Activity Not Found (404): The requested activity record does not exist.',
            })
          } else if (err.isNetworkError || err.status === 0) {
            setError({
              type: 'network',
              message: 'Connection Error: Failed to reach the server. Please check your network and retry.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load activity details.',
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

  useEffect(() => {
    if (!activityId) {
      setActivity(null)
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    void fetchDetail(activityId, controller.signal)

    return () => {
      controller.abort()
    }
  }, [activityId, fetchDetail])

  // Escape key closes drawer
  useEffect(() => {
    if (!activityId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activityId, onClose])

  if (!activityId) {
    return null
  }

  return (
    <div
      data-testid="activity-detail-backdrop"
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
        aria-labelledby="activity-detail-title"
        data-testid="activity-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          background: '#181818',
          borderLeft: '1px solid rgba(189, 0, 214, 0.4)',
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
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
            gap: '1rem',
          }}
        >
          <div>
            <h2
              id="activity-detail-title"
              style={{
                margin: 0,
                fontSize: '1.25rem',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Activity Details
            </h2>
            <div className="gm-admin-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
              ID: {activityId}
            </div>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            data-testid="activity-detail-close-btn"
            aria-label="Close activity details"
            onClick={onClose}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            data-testid="activity-detail-loading"
            className="gm-admin-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '14rem',
            }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>Loading activity details...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            className="gm-admin-warning"
            role="alert"
            data-testid="activity-detail-error"
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
            }}
          >
            <div>
              <strong data-testid="detail-error-title" style={{ display: 'block' }}>
                {error.type === 'unauthorized' && 'Unauthorized (401)'}
                {error.type === 'forbidden' && 'Access Denied (403)'}
                {error.type === 'not_found' && 'Activity Not Found (404)'}
                {error.type === 'network' && 'Connection Error'}
                {error.type === 'api' && 'API Error'}
              </strong>
              <span data-testid="detail-error-message" style={{ fontSize: '0.9rem' }}>
                {error.message}
              </span>
            </div>

            {error.type !== 'not_found' && (
              <div>
                <button
                  type="button"
                  className="gm-admin-btn"
                  data-testid="activity-detail-retry-btn"
                  onClick={() => void fetchDetail(activityId)}
                  style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content View */}
        {!isLoading && !error && activity && (
          <div
            data-testid="activity-detail-content"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Event Header Card */}
            <div
              className="gm-admin-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1rem',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    color: '#f5d0fe',
                    fontWeight: 600,
                  }}
                >
                  {formatActivityEventType(activity.eventType)}
                </h3>
                <div className="gm-admin-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {activity.eventType}
                </div>
              </div>

              <span
                data-testid="activity-detail-status-badge"
                style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  ...getActivityStatusBadgeStyle(activity.status),
                }}
              >
                {activity.status}
              </span>
            </div>

            {/* When Section */}
            <div className="gm-admin-card" style={{ padding: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.6rem',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#c084fc',
                }}
              >
                When
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Created Timestamp
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatDateTime(activity.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    ISO Timestamp
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{activity.createdAt}</div>
                </div>
              </div>
            </div>

            {/* Actor Section */}
            <div className="gm-admin-card" style={{ padding: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.6rem',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#c084fc',
                }}
              >
                Actor
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Actor Type
                  </div>
                  <div style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>
                    {activity.actor?.type || 'System'}
                  </div>
                </div>
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Actor Name
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatActivityActor(activity.actor)}
                  </div>
                </div>
                {activity.actor?.userId && (
                  <div>
                    <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                      User ID
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {activity.actor.userId}
                    </div>
                  </div>
                )}
                {activity.actor?.role && (
                  <div>
                    <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                      Role
                    </div>
                    <div style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                      {activity.actor.role}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Target Section */}
            <div className="gm-admin-card" style={{ padding: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.6rem',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#c084fc',
                }}
              >
                Target
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Target Type
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatActivityTargetType(activity.target?.type)}
                  </div>
                </div>
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Target Name / Description
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {formatActivityTarget(activity.target)}
                  </div>
                </div>
                <div>
                  <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                    Target ID
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {activity.target?.id || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Section */}
            <div className="gm-admin-card" style={{ padding: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.4rem',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#c084fc',
                }}
              >
                Summary
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  color: '#e2e8f0',
                  lineHeight: 1.6,
                }}
              >
                {activity.summary}
              </p>
            </div>

            {/* Structured Details Section */}
            <div className="gm-admin-card" style={{ padding: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.6rem',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#c084fc',
                }}
              >
                Structured Details
              </h4>

              {activity.details &&
              typeof activity.details === 'object' &&
              !Array.isArray(activity.details) &&
              Object.keys(activity.details).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(activity.details).map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        flexDirection: isComplexValue(val) ? 'column' : 'row',
                        justifyContent: isComplexValue(val) ? 'flex-start' : 'space-between',
                        alignItems: isComplexValue(val) ? 'flex-start' : 'center',
                        padding: '0.4rem 0.6rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        gap: '0.5rem',
                      }}
                    >
                      <strong style={{ color: '#f5d0fe' }}>{key}:</strong>
                      {isComplexValue(val) ? (
                        <pre
                          data-testid="activity-detail-json"
                          style={{
                            margin: 0,
                            padding: '0.5rem',
                            background: '#111111',
                            borderRadius: '4px',
                            width: '100%',
                            overflowX: 'auto',
                            fontSize: '0.8rem',
                            color: '#e2e8f0',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box',
                          }}
                        >
                          {JSON.stringify(val, null, 2)}
                        </pre>
                      ) : (
                        <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {renderValue(val)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : activity.details !== undefined && activity.details !== null ? (
                <pre
                  data-testid="activity-detail-json"
                  style={{
                    margin: 0,
                    padding: '0.75rem',
                    background: '#111111',
                    borderRadius: '4px',
                    overflowX: 'auto',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                  }}
                >
                  {typeof activity.details === 'string'
                    ? activity.details
                    : JSON.stringify(activity.details, null, 2)}
                </pre>
              ) : (
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                  No additional details recorded.
                </p>
              )}
            </div>

            {/* Error Message Section (Only if present) */}
            {activity.errorMessage && (
              <div
                className="gm-admin-warning"
                role="alert"
                data-testid="activity-detail-error-message"
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#fca5a5',
                  padding: '1rem',
                  borderRadius: '8px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 0.35rem',
                    fontSize: '0.9rem',
                    color: '#f87171',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Failure Error Details
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {activity.errorMessage}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityDetailDrawer
