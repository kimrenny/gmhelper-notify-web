// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ActivityPage from './ActivityPage'
import * as useAuthModule from '../hooks/useAuth'
import { activityService } from '../services/activityService'
import { ApiError } from '../services/apiClient'
import type { AuthContextValue } from '../types/auth'
import type { ActivityDetail, ActivityListItem, ActivityListResponse } from '../types/activity'

describe('ActivityPage component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'OwnerUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'sample-access-token-owner',
      role: 'Owner',
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      ...overrides,
    }
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(defaultAuth)
  }

  const mockActivities: ActivityListItem[] = [
    {
      id: 'act-1',
      eventType: 'template.created',
      actor: {
        type: 'user',
        userId: 'u-1',
        name: 'Owner Admin',
        role: 'owner',
      },
      target: {
        type: 'template',
        id: 'tpl-100',
        name: 'Welcome Template',
      },
      status: 'success',
      summary: 'Created template "Welcome Template"',
      createdAt: '2026-09-19T10:00:00Z',
    },
    {
      id: 'act-2',
      eventType: 'campaign.started',
      actor: {
        type: 'system',
      },
      target: {
        type: 'campaign',
        id: 'camp-200',
        name: 'Q3 Newsletter',
      },
      status: 'warning',
      summary: 'Campaign started with 5 pending retries',
      createdAt: '2026-09-19T09:30:00Z',
    },
  ]

  const sampleListResponse: ActivityListResponse = {
    items: mockActivities,
    total: 2,
    limit: 20,
    offset: 0,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>
    )
  }

  it('1. Displays initial loading state while activity request is pending', async () => {
    vi.spyOn(activityService, 'list').mockReturnValue(new Promise(() => {}))
    renderComponent()

    expect(screen.getByTestId('activity-loading')).toBeDefined()
    expect(screen.getByText('Loading activity history...')).toBeDefined()
    expect(screen.queryByTestId('activity-table')).toBeNull()
  })

  it('2. Renders list of activities with all table columns when request succeeds', async () => {
    vi.spyOn(activityService, 'list').mockResolvedValue(sampleListResponse)
    renderComponent()

    await waitFor(() => {
      expect(screen.queryByTestId('activity-loading')).toBeNull()
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    const row1 = screen.getByTestId('activity-row-act-1')
    const row2 = screen.getByTestId('activity-row-act-2')

    // Row 1 Column contents
    expect(within(row1).getByText('Template Created')).toBeDefined()
    expect(within(row1).getByText('Owner Admin')).toBeDefined()
    expect(within(row1).getByText('Welcome Template')).toBeDefined()
    expect(within(row1).getByText('Created template "Welcome Template"')).toBeDefined()
    expect(within(row1).getByText('success')).toBeDefined()

    // Row 2 Column contents
    expect(within(row2).getByText('Campaign Started')).toBeDefined()
    expect(within(row2).getByText('System')).toBeDefined()
    expect(within(row2).getByText('Q3 Newsletter')).toBeDefined()
    expect(within(row2).getByText('Campaign started with 5 pending retries')).toBeDefined()
    expect(within(row2).getByText('warning')).toBeDefined()
  })

  it('3. Displays empty state when zero activity records are returned', async () => {
    vi.spyOn(activityService, 'list').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })
    renderComponent()

    await waitFor(() => {
      expect(screen.queryByTestId('activity-loading')).toBeNull()
      expect(screen.getByTestId('activity-empty')).toBeDefined()
      expect(
        screen.getByText('No activity records found matching the current filters.')
      ).toBeDefined()
      expect(screen.queryByTestId('activity-table')).toBeNull()
    })
  })

  it('4. Displays explicit 403 Access Denied state for non-owner user', async () => {
    setAuthMock({ role: 'Admin' })
    const forbiddenError = new ApiError('Forbidden: Owner only', 403, 'FORBIDDEN')
    vi.spyOn(activityService, 'list').mockRejectedValue(forbiddenError)

    renderComponent()

    await waitFor(() => {
      expect(screen.queryByTestId('activity-loading')).toBeNull()
      expect(screen.getByTestId('activity-error-alert')).toBeDefined()
      expect(screen.getByTestId('error-title').textContent).toContain('Access Denied (403)')
    })
  })

  it('5. Displays explicit 401 Unauthorized state on token expiration', async () => {
    const unauthError = new ApiError('Unauthorized token', 401, 'UNAUTHORIZED')
    vi.spyOn(activityService, 'list').mockRejectedValue(unauthError)

    renderComponent()

    await waitFor(() => {
      expect(screen.queryByTestId('activity-loading')).toBeNull()
      expect(screen.getByTestId('activity-error-alert')).toBeDefined()
      expect(screen.getByTestId('error-title').textContent).toContain('Unauthorized (401)')
    })
  })

  it('6. Displays general error banner on API failure and allows retry', async () => {
    const apiError = new ApiError('Database connection failure', 500, 'INTERNAL_ERROR')
    const listSpy = vi
      .spyOn(activityService, 'list')
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce(sampleListResponse)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-error-alert')).toBeDefined()
      expect(screen.getByText('Database connection failure')).toBeDefined()
    })

    // Click Retry
    const retryBtn = screen.getByTestId('activity-retry-btn')
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-error-alert')).toBeNull()
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    expect(listSpy).toHaveBeenCalledTimes(2)
  })

  it('7. Passes filters to activityService.list and resets offset to 0 on filter change', async () => {
    const listSpy = vi.spyOn(activityService, 'list').mockResolvedValue(sampleListResponse)
    renderComponent()

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(1)
    })

    // Change Event Type filter
    const eventTypeSelect = screen.getByTestId('filter-event-type')
    fireEvent.change(eventTypeSelect, { target: { value: 'template.created' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eventType: 'template.created',
          offset: 0,
          limit: 20,
        }),
        expect.anything(),
        expect.anything()
      )
    })

    // Change Status filter
    const statusSelect = screen.getByTestId('filter-status')
    fireEvent.change(statusSelect, { target: { value: 'success' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eventType: 'template.created',
          status: 'success',
          offset: 0,
        }),
        expect.anything(),
        expect.anything()
      )
    })

    // Change Target Type filter
    const targetTypeSelect = screen.getByTestId('filter-target-type')
    fireEvent.change(targetTypeSelect, { target: { value: 'template' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetType: 'template',
          offset: 0,
        }),
        expect.anything(),
        expect.anything()
      )
    })

    // Enter Actor User ID
    const actorInput = screen.getByTestId('filter-actor-user-id')
    fireEvent.change(actorInput, { target: { value: 'u-123' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          actorUserId: 'u-123',
          offset: 0,
        }),
        expect.anything(),
        expect.anything()
      )
    })

    // Enter Target ID
    const targetIdInput = screen.getByTestId('filter-target-id')
    fireEvent.change(targetIdInput, { target: { value: 'target-999' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetId: 'target-999',
          offset: 0,
        }),
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('8. Supports pagination controls and preserves active filters across page turns', async () => {
    const listSpy = vi.spyOn(activityService, 'list').mockResolvedValue({
      items: mockActivities,
      total: 50,
      limit: 20,
      offset: 0,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-pagination')).toBeDefined()
      expect(screen.getByTestId('pagination-count-info').textContent).toContain(
        'Showing 1 - 20 of 50 activities'
      )
    })

    // Set filter first
    const statusSelect = screen.getByTestId('filter-status')
    fireEvent.change(statusSelect, { target: { value: 'warning' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'warning',
          offset: 0,
        }),
        expect.anything(),
        expect.anything()
      )
    })

    // Click Next page
    const nextBtn = screen.getByTestId('pagination-next-btn')
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'warning',
          offset: 20,
        }),
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('9. Clears filters and resets pagination when Clear Filters button is clicked', async () => {
    const listSpy = vi.spyOn(activityService, 'list').mockResolvedValue(sampleListResponse)
    renderComponent()

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(1)
    })

    // Set a filter
    const eventTypeSelect = screen.getByTestId('filter-event-type') as HTMLSelectElement
    fireEvent.change(eventTypeSelect, { target: { value: 'template.created' } })
    expect(eventTypeSelect.value).toBe('template.created')

    // Click Clear Filters
    const clearBtn = screen.getByTestId('clear-filters-btn')
    fireEvent.click(clearBtn)

    await waitFor(() => {
      expect(eventTypeSelect.value).toBe('')
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          offset: 0,
          limit: 20,
        }),
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('10. Row click opens ActivityDetailDrawer, fetches detail, and closing preserves filters/page', async () => {
    const listSpy = vi.spyOn(activityService, 'list').mockImplementation((params) =>
      Promise.resolve({
        items: mockActivities,
        total: 50,
        limit: 20,
        offset: params?.offset ?? 0,
      })
    )

    const mockDetail: ActivityDetail = {
      ...mockActivities[0],
      details: { version: 1, locale: 'en' },
      errorMessage: null,
    }
    const getByIdSpy = vi.spyOn(activityService, 'getById').mockResolvedValue(mockDetail)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    // Set filter and move page
    const statusSelect = screen.getByTestId('filter-status') as HTMLSelectElement
    fireEvent.change(statusSelect, { target: { value: 'success' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'success', offset: 0 }),
        expect.anything(),
        expect.anything()
      )
    })

    // Click Next page
    const nextBtn = screen.getByTestId('pagination-next-btn')
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'success', offset: 20 }),
        expect.anything(),
        expect.anything()
      )
    })

    // Drawer should not be open yet
    expect(screen.queryByTestId('activity-detail-drawer')).toBeNull()

    // Click row act-1 -> Opens Drawer
    const row = screen.getByTestId('activity-row-act-1')
    fireEvent.click(row)

    await waitFor(() => {
      expect(screen.getByTestId('activity-detail-drawer')).toBeDefined()
      expect(getByIdSpy).toHaveBeenCalledWith('act-1', expect.anything(), expect.anything())
      expect(screen.getByText('ID: act-1')).toBeDefined()
    })

    const initialListCalls = listSpy.mock.calls.length

    // Click Close on Drawer
    const closeBtn = screen.getByTestId('activity-detail-close-btn')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-detail-drawer')).toBeNull()
    })

    // List should NOT have reloaded or reset filters/pagination
    expect(listSpy.mock.calls.length).toBe(initialListCalls)
    expect(statusSelect.value).toBe('success')
    expect(screen.getByTestId('pagination-page-info').textContent).toContain('Page 2')
  })

  it('11. Refresh button triggers a fresh activityService.list request preserving filters and offset', async () => {
    const listSpy = vi.spyOn(activityService, 'list').mockImplementation((params) =>
      Promise.resolve({
        items: mockActivities,
        total: 50,
        limit: 20,
        offset: params?.offset ?? 0,
      })
    )

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    // Set filter and change page
    const statusSelect = screen.getByTestId('filter-status') as HTMLSelectElement
    fireEvent.change(statusSelect, { target: { value: 'warning' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'warning', offset: 0 }),
        expect.anything(),
        expect.anything()
      )
    })

    const nextBtn = screen.getByTestId('pagination-next-btn')
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'warning', offset: 20 }),
        expect.anything(),
        expect.anything()
      )
    })

    const callsBeforeRefresh = listSpy.mock.calls.length

    // Click Refresh
    const refreshBtn = screen.getByTestId('activity-refresh-btn')
    fireEvent.click(refreshBtn)

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(callsBeforeRefresh + 1)
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'warning',
          offset: 20,
          limit: 20,
        }),
        expect.anything(),
        undefined
      )
    })

    // Filters and pagination remain preserved
    expect(statusSelect.value).toBe('warning')
    expect(screen.getByTestId('pagination-page-info').textContent).toContain('Page 2')
  })

  it('12. Refresh button shows refreshing state and prevents concurrent duplicate requests', async () => {
    let resolveList: (value: ActivityListResponse) => void = () => {}
    const listSpy = vi
      .spyOn(activityService, 'list')
      .mockResolvedValueOnce(sampleListResponse)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveList = resolve
          })
      )

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    const refreshBtn = screen.getByTestId('activity-refresh-btn')
    expect(refreshBtn.textContent).toBe('Refresh')
    expect((refreshBtn as HTMLButtonElement).disabled).toBe(false)

    // Trigger refresh
    fireEvent.click(refreshBtn)

    // Should show "Refreshing..." and become disabled
    expect(refreshBtn.textContent).toBe('Refreshing...')
    expect((refreshBtn as HTMLButtonElement).disabled).toBe(true)

    // Existing table data remains visible while refreshing (no layout flash)
    expect(screen.getByTestId('activity-table')).toBeDefined()

    // Second click while in-flight should NOT invoke list again
    fireEvent.click(refreshBtn)
    expect(listSpy).toHaveBeenCalledTimes(2)

    // Resolve the refresh request
    resolveList({
      items: [mockActivities[0]],
      total: 1,
      limit: 20,
      offset: 0,
    })

    await waitFor(() => {
      expect(refreshBtn.textContent).toBe('Refresh')
      expect((refreshBtn as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('13. Refresh works after an error and successfully recovers to display real records', async () => {
    const listSpy = vi
      .spyOn(activityService, 'list')
      .mockRejectedValueOnce(new ApiError('Failed to fetch', 0, 'NETWORK_ERROR'))
      .mockResolvedValueOnce(sampleListResponse)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-error-alert')).toBeDefined()
      expect(screen.getByTestId('error-title').textContent).toContain('Connection Error')
    })

    // Click Refresh in header to recover
    const refreshBtn = screen.getByTestId('activity-refresh-btn')
    fireEvent.click(refreshBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-error-alert')).toBeNull()
      expect(screen.getByTestId('activity-table')).toBeDefined()
      expect(screen.getByTestId('activity-row-act-1')).toBeDefined()
    })

    expect(listSpy).toHaveBeenCalledTimes(2)
  })

  it('14. Aborted request during unmount/token change does not display a spurious network error', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError')
    vi.spyOn(activityService, 'list').mockRejectedValue(abortError)

    renderComponent()

    // When an abort happens, it should not set the network error alert
    await waitFor(() => {
      expect(screen.queryByTestId('activity-error-alert')).toBeNull()
    })
  })

  it('15. Strictly renders only the exact items returned by the API without injecting, merging, or appending mock records', async () => {
    const singleRealRecord: ActivityListItem = {
      id: 'real-unique-id-999',
      eventType: 'agreement.broadcast_created',
      actor: {
        type: 'user',
        userId: 'u-owner-actual',
        name: 'Real Admin',
        role: 'owner',
      },
      target: {
        type: 'agreement',
        id: 'ag-actual-1',
        name: 'Terms 2026',
      },
      status: 'success',
      summary: 'Real broadcast created for Terms 2026',
      createdAt: '2026-09-19T00:25:00Z',
    }

    vi.spyOn(activityService, 'list').mockResolvedValue({
      items: [singleRealRecord],
      total: 1,
      limit: 20,
      offset: 0,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-table')).toBeDefined()
    })

    // Confirm ONLY the real record is rendered
    expect(screen.getByTestId('activity-row-real-unique-id-999')).toBeDefined()
    expect(screen.getByText('Real broadcast created for Terms 2026')).toBeDefined()

    // Confirm no synthetic or mock records are present
    expect(screen.queryByTestId('activity-row-act-1')).toBeNull()
    expect(screen.queryByTestId('activity-row-act-2')).toBeNull()
    expect(screen.queryByText('Created template "Welcome Template"')).toBeNull()
    expect(screen.queryByText('Campaign started with 5 pending retries')).toBeNull()

    // Confirm row count in table tbody equals exactly 1
    const rows = screen.getAllByRole('row')
    // 1 header row + 1 data row
    expect(rows.length).toBe(2)
  })

  it('16. Empty API response renders only the empty state without populating sample or fallback records', async () => {
    vi.spyOn(activityService, 'list').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('activity-empty')).toBeDefined()
    })

    expect(screen.queryByTestId('activity-table')).toBeNull()
    expect(screen.queryByTestId('activity-row-act-1')).toBeNull()
    expect(screen.queryByTestId('activity-row-act-2')).toBeNull()
    expect(screen.queryByText('Created template "Welcome Template"')).toBeNull()
    expect(screen.queryByText('Campaign started with 5 pending retries')).toBeNull()
  })
})
