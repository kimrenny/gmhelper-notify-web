import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import { activityService, ApiError } from '../services'
import type { ActivityListItem, ActivityLogFilter } from '../types/activity'
import { ActivityDetailDrawer } from '../components/ActivityDetailDrawer'
import {
  EVENT_TYPE_OPTIONS,
  formatActivityActor,
  formatActivityEventType,
  formatActivityTarget,
  formatActivityTargetType,
  formatDateTime,
  getActivityStatusBadgeStyle,
  STATUS_OPTIONS,
  TARGET_TYPE_OPTIONS,
} from '../utils/activity'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'validation' | 'api' | 'network'
  message: string
}

interface FilterState {
  eventType: string
  status: string
  targetType: string
  targetId: string
  actorUserId: string
  fromDate: string
  toDate: string
}

const initialFilterState: FilterState = {
  eventType: '',
  status: '',
  targetType: '',
  targetId: '',
  actorUserId: '',
  fromDate: '',
  toDate: '',
}

const PAGE_SIZE = 20

function ActivityPage() {
  const apiClient = useApiClient()
  const { role } = useAuth()

  const [activities, setActivities] = useState<ActivityListItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [offset, setOffset] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<ErrorInfo | null>(null)

  // Filters state
  const [filters, setFilters] = useState<FilterState>(initialFilterState)

  // Selection boundary prepared for Stage 5C (Detail View)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)

  const loadActivities = useCallback(
    async (
      currentOffset: number,
      currentFilters: FilterState,
      signal?: AbortSignal,
      isManualRefresh = false
    ) => {
      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const filterParams: ActivityLogFilter = {
        limit: PAGE_SIZE,
        offset: currentOffset,
      }

      if (currentFilters.eventType.trim()) {
        filterParams.eventType = currentFilters.eventType.trim()
      }
      if (currentFilters.status.trim()) {
        filterParams.status = currentFilters.status.trim()
      }
      if (currentFilters.targetType.trim()) {
        filterParams.targetType = currentFilters.targetType.trim()
      }
      if (currentFilters.targetId.trim()) {
        filterParams.targetId = currentFilters.targetId.trim()
      }
      if (currentFilters.actorUserId.trim()) {
        filterParams.actorUserId = currentFilters.actorUserId.trim()
      }
      if (currentFilters.fromDate.trim()) {
        filterParams.fromDate = currentFilters.fromDate.trim()
      }
      if (currentFilters.toDate.trim()) {
        filterParams.toDate = currentFilters.toDate.trim()
      }

      try {
        const response = await activityService.list(filterParams, apiClient, signal)
        setActivities(response.items || [])
        setTotal(response.total || 0)
        setOffset(response.offset ?? currentOffset)
      } catch (err) {
        if (signal?.aborted) {
          return
        }

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.status === 401) {
            setError({
              type: 'unauthorized',
              message: err.message || 'Session expired or invalid authentication token.',
            })
          } else if (err.isForbidden || err.status === 403) {
            setError({
              type: 'forbidden',
              message:
                err.message || 'Access Denied: Activity History is strictly restricted to Owner users.',
            })
          } else if (err.status === 400) {
            setError({
              type: 'validation',
              message: err.message || 'Invalid filter parameters provided.',
            })
          } else if (err.isNetworkError || err.status === 0) {
            setError({
              type: 'network',
              message: 'Network connection failure. Please check your connection and retry.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load activity history.',
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
          setIsRefreshing(false)
        }
      }
    },
    [apiClient]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadActivities(offset, filters, controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadActivities, offset, filters])

  const handleRefresh = useCallback(() => {
    if (isLoading || isRefreshing) return
    void loadActivities(offset, filters, undefined, true)
  }, [isLoading, isRefreshing, loadActivities, offset, filters])

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }))
    setOffset(0) // Reset to page 1 when filter changes
  }

  const handleClearFilters = () => {
    setFilters(initialFilterState)
    setOffset(0)
  }

  const handlePageChange = (newOffset: number) => {
    if (newOffset < 0 || (total > 0 && newOffset >= total)) return
    setOffset(newOffset)
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startItem = total === 0 ? 0 : offset + 1
  const endItem = Math.min(offset + PAGE_SIZE, total)

  const isOwner = role?.toLowerCase() === 'owner'

  return (
    <section className="gm-admin-page" data-testid="activity-history-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Activity History</h1>
          <p className="gm-admin-page__description">
            Audit log of administrative and system activities across notifications, campaigns,
            templates, automation rules, and settings.
          </p>
        </div>

        <button
          type="button"
          className="gm-admin-btn"
          data-testid="activity-refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Role Notice if not owner */}
      {!isOwner && !error && (
        <div
          className="gm-admin-warning"
          role="status"
          style={{
            borderColor: 'rgba(234, 179, 8, 0.4)',
            background: 'rgba(234, 179, 8, 0.1)',
            color: '#fef08a',
          }}
        >
          <strong>Owner Restricted:</strong> Viewing activity history requires the Owner role.
        </div>
      )}

      {/* Error / Access Denied States */}
      {error && (
        <div
          className="gm-admin-warning"
          role="alert"
          data-testid="activity-error-alert"
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
              {error.type === 'forbidden' && 'Access Denied (403)'}
              {error.type === 'validation' && 'Invalid Request (400)'}
              {error.type === 'network' && 'Connection Error'}
              {error.type === 'api' && 'Activity API Error'}
            </strong>
            <span data-testid="error-message">{error.message}</span>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            data-testid="activity-retry-btn"
            onClick={() => void loadActivities(offset, filters)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="gm-admin-card" data-testid="activity-filter-toolbar">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Event Type Filter */}
          <div>
            <label
              htmlFor="filter-event-type"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Event Type
            </label>
            <select
              id="filter-event-type"
              data-testid="filter-event-type"
              className="gm-admin-select"
              value={filters.eventType}
              onChange={(e) => handleFilterChange('eventType', e.target.value)}
            >
              <option value="">All Event Types</option>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="filter-status"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Status
            </label>
            <select
              id="filter-status"
              data-testid="filter-status"
              className="gm-admin-select"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Type Filter */}
          <div>
            <label
              htmlFor="filter-target-type"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Target Type
            </label>
            <select
              id="filter-target-type"
              data-testid="filter-target-type"
              className="gm-admin-select"
              value={filters.targetType}
              onChange={(e) => handleFilterChange('targetType', e.target.value)}
            >
              <option value="">All Target Types</option>
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actor User ID Filter */}
          <div>
            <label
              htmlFor="filter-actor-user-id"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Actor User ID
            </label>
            <input
              id="filter-actor-user-id"
              data-testid="filter-actor-user-id"
              type="text"
              className="gm-admin-input"
              placeholder="Filter by Actor User ID..."
              value={filters.actorUserId}
              onChange={(e) => handleFilterChange('actorUserId', e.target.value)}
            />
          </div>

          {/* Target ID Filter */}
          <div>
            <label
              htmlFor="filter-target-id"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Target ID
            </label>
            <input
              id="filter-target-id"
              data-testid="filter-target-id"
              type="text"
              className="gm-admin-input"
              placeholder="Filter by Target ID..."
              value={filters.targetId}
              onChange={(e) => handleFilterChange('targetId', e.target.value)}
            />
          </div>

          {/* From Date Filter */}
          <div>
            <label
              htmlFor="filter-from-date"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              From Date
            </label>
            <input
              id="filter-from-date"
              data-testid="filter-from-date"
              type="datetime-local"
              className="gm-admin-input"
              value={filters.fromDate}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label
              htmlFor="filter-to-date"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              To Date
            </label>
            <input
              id="filter-to-date"
              data-testid="filter-to-date"
              type="datetime-local"
              className="gm-admin-input"
              value={filters.toDate}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
            />
          </div>

          {/* Clear Filters Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '1.25rem' }}>
            <button
              type="button"
              className="gm-admin-btn"
              data-testid="clear-filters-btn"
              onClick={handleClearFilters}
              style={{ width: '100%' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Table / Loading / Empty */}
      {isLoading ? (
        <div className="gm-admin-card" data-testid="activity-loading">
          <div
            className="gm-admin-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '12rem',
            }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>Loading activity history...</p>
          </div>
        </div>
      ) : activities.length === 0 && !error ? (
        <div className="gm-admin-card" data-testid="activity-empty">
          <div
            className="gm-admin-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '12rem',
            }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              No activity records found matching the current filters.
            </p>
          </div>
        </div>
      ) : activities.length > 0 ? (
        <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="gm-admin-table" data-testid="activity-table">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Date / Time</th>
                <th style={{ minWidth: '180px' }}>Activity Type</th>
                <th style={{ minWidth: '150px' }}>Actor</th>
                <th style={{ minWidth: '180px' }}>Target</th>
                <th style={{ minWidth: '100px' }}>Status</th>
                <th style={{ minWidth: '260px' }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => {
                const isSelected = item.id === selectedActivityId
                return (
                  <tr
                    key={item.id}
                    data-testid={`activity-row-${item.id}`}
                    onClick={() => setSelectedActivityId(item.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(189, 0, 214, 0.15)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Date / Time */}
                    <td style={{ fontSize: '0.85rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {formatDateTime(item.createdAt)}
                    </td>

                    {/* Activity Type */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{formatActivityEventType(item.eventType)}</div>
                      <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                        {item.eventType}
                      </div>
                    </td>

                    {/* Actor */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{formatActivityActor(item.actor)}</div>
                      {item.actor?.role && (
                        <div className="gm-admin-muted" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                          Role: {item.actor.role}
                        </div>
                      )}
                    </td>

                    {/* Target */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{formatActivityTarget(item.target)}</div>
                      <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                        {formatActivityTargetType(item.target?.type)}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        data-testid={`status-badge-${item.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          ...getActivityStatusBadgeStyle(item.status),
                        }}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Summary */}
                    <td style={{ maxWidth: '360px' }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#e2e8f0',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                        title={item.summary}
                      >
                        {item.summary}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Pagination Bar */}
      {total > 0 && !error && (
        <div
          className="gm-admin-card"
          data-testid="activity-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '0.85rem 1.25rem',
          }}
        >
          <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }} data-testid="pagination-count-info">
            Showing {startItem} - {endItem} of {total} activities
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="gm-admin-btn"
              data-testid="pagination-prev-btn"
              disabled={offset === 0 || isLoading || isRefreshing}
              onClick={() => handlePageChange(offset - PAGE_SIZE)}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Previous
            </button>

            <span
              className="gm-admin-muted"
              style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}
              data-testid="pagination-page-info"
            >
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="gm-admin-btn"
              data-testid="pagination-next-btn"
              disabled={offset + PAGE_SIZE >= total || isLoading || isRefreshing}
              onClick={() => handlePageChange(offset + PAGE_SIZE)}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        activityId={selectedActivityId}
        onClose={() => setSelectedActivityId(null)}
      />
    </section>
  )
}

export default ActivityPage
