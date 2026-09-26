import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, transactionalService } from '../services'
import type {
  TransactionalEmailItem,
  TransactionalEmailStats,
  TransactionalFilterParams,
} from '../types/transactional'
import { TransactionalDetailDrawer } from '../components/TransactionalDetailDrawer'
import {
  COMMON_TRANSACTIONAL_TEMPLATES,
  formatDateTime,
  getTransactionalStatusBadgeStyle,
  TRANSACTIONAL_STATUS_LABELS,
  TRANSACTIONAL_STATUS_OPTIONS,
} from '../utils/transactional'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'api' | 'network'
  message: string
}

interface FilterState {
  search: string
  status: string
  templateKey: string
}

const initialFilterState: FilterState = {
  search: '',
  status: '',
  templateKey: '',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function TransactionalEmailsPage() {
  const apiClient = useApiClient()

  const [stats, setStats] = useState<TransactionalEmailStats | null>(null)
  const [items, setItems] = useState<TransactionalEmailItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [limit, setLimit] = useState<number>(20)
  const [offset, setOffset] = useState<number>(0)

  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<ErrorInfo | null>(null)

  const [filters, setFilters] = useState<FilterState>(initialFilterState)
  const [searchInput, setSearchInput] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<TransactionalEmailItem | null>(null)

  // Debounce search input into filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev
        return { ...prev, search: searchInput }
      })
      setOffset(0)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchInput])

  const loadStats = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoadingStats(true)
      try {
        const statsData = await transactionalService.getStats(apiClient, signal)
        setStats(statsData)
      } catch (err) {
        if (signal?.aborted) return
        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.status === 401) {
            setError({
              type: 'unauthorized',
              message: 'You do not have access to transactional email history. Please sign in.',
            })
            return
          }
          if (err.isForbidden || err.status === 403) {
            setError({
              type: 'forbidden',
              message: 'Access forbidden: Administrator privileges are required.',
            })
            return
          }
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingStats(false)
        }
      }
    },
    [apiClient]
  )

  const loadHistory = useCallback(
    async (
      currentOffset: number,
      currentLimit: number,
      currentFilters: FilterState,
      signal?: AbortSignal,
      manualRefresh = false
    ) => {
      if (manualRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoadingHistory(true)
      }
      setError(null)

      const params: TransactionalFilterParams = {
        limit: currentLimit,
        offset: currentOffset,
      }

      if (currentFilters.status) {
        params.status = currentFilters.status
      }
      if (currentFilters.templateKey) {
        params.templateKey = currentFilters.templateKey
      }
      if (currentFilters.search.trim()) {
        params.search = currentFilters.search.trim()
      }

      try {
        const response = await transactionalService.getHistory(params, apiClient, signal)
        setItems(response.items || [])
        setTotal(response.total || 0)
      } catch (err) {
        if (signal?.aborted) return
        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.status === 401) {
            setError({
              type: 'unauthorized',
              message: 'You do not have access to transactional email history. Please sign in.',
            })
          } else if (err.isForbidden || err.status === 403) {
            setError({
              type: 'forbidden',
              message: 'Access forbidden: Administrator privileges are required.',
            })
          } else if (err.isNetworkError || err.status === 0) {
            setError({
              type: 'network',
              message: 'Network connection error: Unable to reach notification API.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load transactional email history.',
            })
          }
        } else {
          setError({
            type: 'api',
            message: err instanceof Error ? err.message : 'An unexpected error occurred.',
          })
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingHistory(false)
          setIsRefreshing(false)
        }
      }
    },
    [apiClient]
  )

  // Initial load and filter change trigger
  useEffect(() => {
    const controller = new AbortController()
    void loadStats(controller.signal)
    void loadHistory(offset, limit, filters, controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadStats, loadHistory, offset, limit, filters])

  const handleRefresh = useCallback(() => {
    if (isLoadingHistory || isRefreshing) return
    void loadStats()
    void loadHistory(offset, limit, filters, undefined, true)
  }, [isLoadingHistory, isRefreshing, loadStats, loadHistory, offset, limit, filters])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setOffset(0)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setFilters(initialFilterState)
    setOffset(0)
  }

  const handlePageSizeChange = (newSize: number) => {
    setLimit(newSize)
    setOffset(0)
  }

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - limit))
  }

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset((prev) => prev + limit)
    }
  }

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit) || 1
  const hasActiveFilters = Boolean(filters.search || filters.status || filters.templateKey)

  return (
    <section className="gm-admin-page" data-testid="transactional-emails-page">
      {/* Header */}
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Transactional Emails</h1>
          <p className="gm-admin-page__description">
            Monitor real-time authentication &amp; transactional email delivery status across all locales.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="gm-admin-btn"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingHistory}
            aria-label="Refresh transactional email data"
            data-testid="transactional-refresh-btn"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state if unauthorized / forbidden / general error */}
      {error && (
        <div
          className="gm-admin-warning"
          role="alert"
          data-testid="transactional-error-alert"
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
              {error.type === 'api' && 'API Error'}
              {error.type === 'network' && 'Connection Error'}
            </strong>
            <span data-testid="error-message">{error.message}</span>
          </div>
          {error.type !== 'unauthorized' && error.type !== 'forbidden' && (
            <button
              type="button"
              className="gm-admin-btn"
              onClick={handleRefresh}
              data-testid="transactional-retry-btn"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div
        className="gm-admin-grid gm-admin-grid--cards"
        aria-label="Transactional Delivery Statistics"
        data-testid="transactional-stats-cards"
      >
        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Dispatched
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#ffffff' }}>
            {isLoadingStats ? '-' : stats ? stats.total.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>All transactional emails</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sent (Delivered)
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#4ade80' }}>
            {isLoadingStats ? '-' : stats ? stats.sent.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Successfully delivered</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#facc15' }}>
            {isLoadingStats ? '-' : stats ? stats.pending.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Queued for delivery</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sending
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#38bdf8' }}>
            {isLoadingStats ? '-' : stats ? stats.sending.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Currently transmitting</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Failed
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#f87171' }}>
            {isLoadingStats ? '-' : stats ? stats.failed.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Delivery errors</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Success Rate
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#c444ff' }}>
            {isLoadingStats ? '-' : stats ? `${stats.successRate.toFixed(1)}%` : '0.0%'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Sent vs total</p>
        </article>

        <article className="gm-admin-card">
          <p className="gm-admin-muted" style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Delivery Attempts
          </p>
          <h2 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.8rem', color: '#ffffff' }}>
            {isLoadingStats ? '-' : stats ? stats.totalAttempts.toLocaleString() : '0'}
          </h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>Total SMTP tries</p>
        </article>
      </div>

      {/* Filters and Search Toolbar */}
      <div className="gm-admin-card" data-testid="transactional-filter-toolbar">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            alignItems: 'flex-end',
          }}
        >
          {/* Search */}
          <div>
            <label
              htmlFor="filter-search"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Search Recipient
            </label>
            <input
              id="filter-search"
              type="text"
              className="gm-admin-input"
              placeholder="Search recipient email or name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search recipient"
            />
          </div>

          {/* Status */}
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
              className="gm-admin-select"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              aria-label="Filter by delivery status"
            >
              {TRANSACTIONAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Template */}
          <div>
            <label
              htmlFor="filter-template"
              className="gm-admin-muted"
              style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}
            >
              Template
            </label>
            <select
              id="filter-template"
              className="gm-admin-select"
              value={filters.templateKey}
              onChange={(e) => handleFilterChange('templateKey', e.target.value)}
              aria-label="Filter by template"
            >
              {COMMON_TRANSACTIONAL_TEMPLATES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Button */}
          {hasActiveFilters && (
            <div>
              <button
                type="button"
                className="gm-admin-btn"
                onClick={handleClearFilters}
                style={{ width: '100%' }}
                data-testid="clear-filters-btn"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* History Table / Loading / Empty */}
      {isLoadingHistory && items.length === 0 ? (
        <div className="gm-admin-card" data-testid="transactional-loading">
          <div
            className="gm-admin-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '12rem',
            }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>Loading transactional email history...</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="gm-admin-card" data-testid="transactional-empty">
          <div
            className="gm-admin-empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '12rem',
              gap: '0.75rem',
            }}
          >
            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem' }}>No transactional emails found</h3>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem' }}>
              {hasActiveFilters
                ? 'No emails match the active search or filter criteria. Try adjusting your filters.'
                : 'No transactional notifications have been sent yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="gm-admin-btn"
                onClick={handleClearFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="gm-admin-table" data-testid="transactional-table">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Date &amp; Time</th>
                <th style={{ minWidth: '200px' }}>Recipient</th>
                <th style={{ minWidth: '220px' }}>Template</th>
                <th style={{ minWidth: '120px' }}>Status</th>
                <th style={{ minWidth: '90px' }}>Attempts</th>
                <th style={{ minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const badgeStyle = getTransactionalStatusBadgeStyle(item.deliveryStatus)
                const isSelected = selectedItem?.id === item.id
                return (
                  <tr
                    key={item.id}
                    data-testid={`transactional-row-${item.id}`}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(189, 0, 214, 0.15)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => setSelectedItem(item)}
                  >
                    {/* Date / Time */}
                    <td style={{ fontSize: '0.85rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {formatDateTime(item.createdAt)}
                    </td>

                    {/* Recipient */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{item.recipientEmail}</div>
                      {item.recipientName && (
                        <div className="gm-admin-muted" style={{ fontSize: '0.75rem' }}>
                          {item.recipientName}
                        </div>
                      )}
                    </td>

                    {/* Template */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'ui-monospace, monospace',
                            background: 'rgba(189, 0, 214, 0.15)',
                            color: '#e879f9',
                            border: '1px solid rgba(189, 0, 214, 0.3)',
                          }}
                        >
                          {item.templateKey || '-'}
                        </span>
                        {item.locale && (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              background: 'rgba(37, 99, 235, 0.15)',
                              color: '#60a5fa',
                              border: '1px solid rgba(37, 99, 235, 0.3)',
                            }}
                          >
                            {item.locale}
                          </span>
                        )}
                      </div>
                      {item.templateName && (
                        <div className="gm-admin-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {item.templateName}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          background: badgeStyle.background,
                          color: badgeStyle.color,
                        }}
                      >
                        {TRANSACTIONAL_STATUS_LABELS[item.deliveryStatus] || item.deliveryStatus}
                      </span>
                    </td>

                    {/* Attempts */}
                    <td style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                      {item.attemptsCount}
                    </td>

                    {/* Actions */}
                    <td>
                      <button
                        type="button"
                        className="gm-admin-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedItem(item)
                        }}
                        aria-label={`View details for notification ${item.id}`}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {total > 0 && !error && (
        <div
          className="gm-admin-card"
          data-testid="transactional-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '0.85rem 1.25rem',
          }}
        >
          <div className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
            Showing {Math.min(offset + 1, total)} - {Math.min(offset + limit, total)} of {total} records (Page {currentPage} of {totalPages})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <span className="gm-admin-muted">Per page:</span>
              <select
                className="gm-admin-select"
                value={limit}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                aria-label="Records per page"
                style={{
                  width: 'auto',
                  padding: '0.35rem 1.8rem 0.35rem 0.65rem',
                  fontSize: '0.85rem',
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="gm-admin-btn"
              disabled={offset === 0 || isLoadingHistory}
              onClick={handlePrevPage}
              aria-label="Previous page"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Previous
            </button>

            <button
              type="button"
              className="gm-admin-btn"
              disabled={offset + limit >= total || isLoadingHistory}
              onClick={handleNextPage}
              aria-label="Next page"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Safe Detail Drawer */}
      <TransactionalDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </section>
  )
}

export default TransactionalEmailsPage
