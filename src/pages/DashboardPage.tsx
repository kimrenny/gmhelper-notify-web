import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, dashboardService } from '../services'
import type { DashboardStats } from '../types/dashboard'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'api' | 'network'
  message: string
}

function formatDateTime(dateStr?: string): string {
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
    })
  } catch {
    return dateStr
  }
}

function getStatusBadgeStyle(status: string) {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case 'completed':
    case 'active':
      return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
    case 'sending':
    case 'running':
      return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }
    case 'scheduled':
      return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
    case 'draft':
      return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }
    case 'partially_failed':
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
    case 'cancelled':
    case 'archived':
    default:
      return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
  }
}

function DashboardPage() {
  const navigate = useNavigate()
  const apiClient = useApiClient()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await dashboardService.getStats(apiClient, signal)
        setStats(data)
      } catch (err) {
        if (signal?.aborted) {
          return
        }

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.statusCode === 401) {
            setError({
              type: 'unauthorized',
              message: 'You do not have access to dashboard statistics. Please verify your authentication.',
            })
          } else if (err.isForbidden || err.statusCode === 403) {
            setError({
              type: 'forbidden',
              message: 'You do not have permission to access dashboard statistics.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load dashboard statistics.',
            })
          }
        } else {
          const message =
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while loading dashboard statistics.'
          setError({
            type: 'network',
            message,
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
    const controller = new AbortController()
    void loadDashboard(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadDashboard])

  const activeOrScheduled =
    (stats?.campaigns.scheduled ?? 0) +
    (stats?.campaigns.running ?? 0) +
    (stats?.campaigns.sending ?? 0)

  const summaryCards = [
    {
      title: 'Total Campaigns',
      value: (stats?.campaigns.total ?? 0).toLocaleString(),
      description: `${activeOrScheduled} active / scheduled`,
      testId: 'summary-card-campaigns',
    },
    {
      title: 'Total Templates',
      value: (stats?.templates.total ?? 0).toLocaleString(),
      description: `${stats?.templates.active ?? 0} active`,
      testId: 'summary-card-templates',
    },
    {
      title: 'Messages Delivered',
      value: (stats?.deliveries.totalSent ?? 0).toLocaleString(),
      description: `Messages delivered`,
      testId: 'summary-card-deliveries',
    },
    {
      title: 'Delivery Success Rate',
      value: `${(stats?.deliveries.successRate ?? 0).toFixed(1)}%`,
      description: 'Delivery success rate',
      testId: 'summary-card-success-rate',
    },
  ]

  const statusItems = [
    { label: 'Draft', count: stats?.campaigns.draft ?? 0, status: 'draft' },
    { label: 'Scheduled', count: stats?.campaigns.scheduled ?? 0, status: 'scheduled' },
    { label: 'Running', count: stats?.campaigns.running ?? 0, status: 'running' },
    { label: 'Sending', count: stats?.campaigns.sending ?? 0, status: 'sending' },
    { label: 'Completed', count: stats?.campaigns.completed ?? 0, status: 'completed' },
    { label: 'Partially Failed', count: stats?.campaigns.partiallyFailed ?? 0, status: 'partially_failed' },
    { label: 'Failed', count: stats?.campaigns.failed ?? 0, status: 'failed' },
    { label: 'Cancelled', count: stats?.campaigns.cancelled ?? 0, status: 'cancelled' },
  ]

  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Dashboard</h1>
          <p className="gm-admin-page__description">Overview of your notification automation workspace.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} data-testid="dashboard-quick-actions">
          <button
            type="button"
            className="gm-admin-btn gm-admin-btn--primary"
            onClick={() => navigate('/admin/campaigns')}
            data-testid="quick-action-campaign"
          >
            Create Campaign
          </button>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => navigate('/admin/templates')}
            data-testid="quick-action-template"
          >
            New Template
          </button>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => navigate('/admin/direct-message')}
            data-testid="quick-action-direct"
          >
            Send Direct Message
          </button>
        </div>
      </div>

      {error && (
        <div
          className="gm-admin-warning"
          role="alert"
          data-testid="dashboard-error-alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            borderColor:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.4)'
                : error.type === 'unauthorized'
                  ? 'rgba(248, 113, 113, 0.4)'
                  : 'rgba(255, 0, 0, 0.2)',
            background:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.12)'
                : error.type === 'unauthorized'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(255, 0, 0, 0.12)',
            color: error.type === 'forbidden' ? '#fef08a' : '#ffd3d3',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <strong data-testid="error-title">
              {error.type === 'unauthorized' && 'Unauthorized (401)'}
              {error.type === 'forbidden' && 'Forbidden (403)'}
              {error.type === 'api' && 'Dashboard API Error'}
              {error.type === 'network' && 'Connection Error'}
            </strong>
            <span data-testid="error-message">{error.message}</span>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => void loadDashboard()}
            data-testid="dashboard-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="gm-admin-card" data-testid="dashboard-loading" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <p className="gm-admin-muted" style={{ margin: 0 }}>
            Loading dashboard data...
          </p>
        </div>
      ) : stats ? (
        <>
          <div className="gm-admin-grid gm-admin-grid--cards" data-testid="dashboard-summary-cards">
            {summaryCards.map((card) => (
              <article key={card.title} className="gm-admin-card" data-testid={card.testId}>
                <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.95rem' }}>{card.title}</p>
                <h2 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.8rem', color: '#ffffff' }}>{card.value}</h2>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem' }}>{card.description}</p>
              </article>
            ))}
          </div>

          <div className="gm-admin-card" data-testid="campaign-status-card">
            <h2 className="gm-admin-card__title">Campaign Status Overview</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.75rem',
              }}
            >
              {statusItems.map((item) => (
                <div
                  key={item.label}
                  data-testid={`status-item-${item.status}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{item.label}</span>
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      ...getStatusBadgeStyle(item.status),
                    }}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="gm-admin-card" data-testid="recent-campaigns-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 className="gm-admin-card__title" style={{ margin: 0 }}>Recent Campaigns</h2>
              <button
                type="button"
                className="gm-admin-btn"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                onClick={() => navigate('/admin/campaigns')}
                data-testid="view-all-campaigns-btn"
              >
                View All Campaigns
              </button>
            </div>

            {stats.recentCampaigns && stats.recentCampaigns.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="gm-admin-table" data-testid="recent-campaigns-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCampaigns.map((item) => (
                      <tr key={item.id} data-testid={`recent-campaign-row-${item.id}`}>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td className="gm-admin-muted">{item.templateName || item.templateId || '-'}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              ...getStatusBadgeStyle(item.status),
                            }}
                          >
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                          {formatDateTime(item.scheduledAt || item.startedAt || item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className="gm-admin-empty"
                data-testid="recent-campaigns-empty"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  minHeight: '8rem',
                }}
              >
                <p className="gm-admin-muted" style={{ margin: 0 }}>No recent campaigns found.</p>
                <button
                  type="button"
                  className="gm-admin-btn gm-admin-btn--primary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => navigate('/admin/campaigns')}
                  data-testid="create-first-campaign-btn"
                >
                  Create Campaign
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default DashboardPage
