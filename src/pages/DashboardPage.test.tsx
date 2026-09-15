// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import * as useAuthModule from '../hooks/useAuth'
import { dashboardService } from '../services/dashboardService'
import { ApiError } from '../services/apiClient'
import type { AuthContextValue } from '../types/auth'
import type { DashboardStats } from '../types/dashboard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('DashboardPage component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'sample-access-token-xyz',
      role: 'Admin',
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      ...overrides,
    }
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(defaultAuth)
  }

  const sampleStats: DashboardStats = {
    campaigns: {
      total: 15,
      draft: 3,
      scheduled: 2,
      running: 1,
      sending: 1,
      completed: 7,
      partiallyFailed: 0,
      failed: 1,
      cancelled: 0,
    },
    templates: {
      total: 8,
      draft: 2,
      active: 6,
      archived: 0,
    },
    deliveries: {
      totalMessages: 2500,
      totalSent: 2420,
      totalFailed: 40,
      totalPending: 35,
      totalSending: 5,
      successRate: 96.8,
    },
    recentCampaigns: [
      {
        id: 'camp-1',
        name: 'September Newsletter',
        templateId: 'tpl-1',
        templateName: 'Monthly Newsletter Template',
        campaignType: 'broadcast',
        status: 'completed',
        scheduledAt: '2026-09-15T08:00:00Z',
        startedAt: '2026-09-15T08:00:02Z',
        completedAt: '2026-09-15T08:05:00Z',
        createdAt: '2026-09-14T10:00:00Z',
      },
      {
        id: 'camp-2',
        name: 'Flash Sale Promo',
        templateId: 'tpl-2',
        templateName: 'Promotional Blast',
        campaignType: 'broadcast',
        status: 'scheduled',
        scheduledAt: '2026-09-20T12:00:00Z',
        createdAt: '2026-09-15T09:00:00Z',
      },
    ],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
    mockNavigate.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

  it('1. Displays loading state while fetching dashboard statistics', async () => {
    let resolvePromise: (value: DashboardStats) => void
    const pendingPromise = new Promise<DashboardStats>((resolve) => {
      resolvePromise = resolve
    })
    vi.spyOn(dashboardService, 'getStats').mockReturnValue(pendingPromise)

    renderDashboard()

    expect(screen.getByTestId('dashboard-loading')).toBeTruthy()
    expect(screen.getByText('Loading dashboard data...')).toBeTruthy()

    resolvePromise!(sampleStats)
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading')).toBeNull()
    })
  })

  it('2. Successfully renders summary cards with real API data', async () => {
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(sampleStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-cards')).toBeTruthy()
    })

    const campaignsCard = screen.getByTestId('summary-card-campaigns')
    expect(campaignsCard.textContent).toContain('Total Campaigns')
    expect(campaignsCard.textContent).toContain('15')
    expect(campaignsCard.textContent).toContain('4 active / scheduled') // scheduled (2) + running (1) + sending (1)

    const templatesCard = screen.getByTestId('summary-card-templates')
    expect(templatesCard.textContent).toContain('Total Templates')
    expect(templatesCard.textContent).toContain('8')
    expect(templatesCard.textContent).toContain('6 active')

    const deliveriesCard = screen.getByTestId('summary-card-deliveries')
    expect(deliveriesCard.textContent).toContain('Messages Delivered')
    expect(deliveriesCard.textContent).toContain((2420).toLocaleString())


    const rateCard = screen.getByTestId('summary-card-success-rate')
    expect(rateCard.textContent).toContain('Delivery Success Rate')
    expect(rateCard.textContent).toContain('96.8%')
  })

  it('3. Renders complete campaign status breakdown', async () => {
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(sampleStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('campaign-status-card')).toBeTruthy()
    })

    expect(screen.getByTestId('status-item-draft').textContent).toContain('Draft')
    expect(screen.getByTestId('status-item-draft').textContent).toContain('3')

    expect(screen.getByTestId('status-item-scheduled').textContent).toContain('Scheduled')
    expect(screen.getByTestId('status-item-scheduled').textContent).toContain('2')

    expect(screen.getByTestId('status-item-running').textContent).toContain('Running')
    expect(screen.getByTestId('status-item-running').textContent).toContain('1')

    expect(screen.getByTestId('status-item-sending').textContent).toContain('Sending')
    expect(screen.getByTestId('status-item-sending').textContent).toContain('1')

    expect(screen.getByTestId('status-item-completed').textContent).toContain('Completed')
    expect(screen.getByTestId('status-item-completed').textContent).toContain('7')

    expect(screen.getByTestId('status-item-partially_failed').textContent).toContain('Partially Failed')
    expect(screen.getByTestId('status-item-partially_failed').textContent).toContain('0')

    expect(screen.getByTestId('status-item-failed').textContent).toContain('Failed')
    expect(screen.getByTestId('status-item-failed').textContent).toContain('1')

    expect(screen.getByTestId('status-item-cancelled').textContent).toContain('Cancelled')
    expect(screen.getByTestId('status-item-cancelled').textContent).toContain('0')
  })

  it('4. Renders recent campaigns table with items', async () => {
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(sampleStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('recent-campaigns-table')).toBeTruthy()
    })

    const row1 = screen.getByTestId('recent-campaign-row-camp-1')
    expect(row1.textContent).toContain('September Newsletter')
    expect(row1.textContent).toContain('Monthly Newsletter Template')
    expect(row1.textContent).toContain('completed')

    const row2 = screen.getByTestId('recent-campaign-row-camp-2')
    expect(row2.textContent).toContain('Flash Sale Promo')
    expect(row2.textContent).toContain('Promotional Blast')
    expect(row2.textContent).toContain('scheduled')
  })

  it('5. Renders empty recent campaigns state when recentCampaigns is empty', async () => {
    const emptyStats: DashboardStats = {
      ...sampleStats,
      recentCampaigns: [],
    }
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(emptyStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('recent-campaigns-empty')).toBeTruthy()
    })

    expect(screen.getByText('No recent campaigns found.')).toBeTruthy()
    expect(screen.getByTestId('create-first-campaign-btn')).toBeTruthy()
  })

  it('6. Displays error state with user-friendly message when API fails', async () => {
    vi.spyOn(dashboardService, 'getStats').mockRejectedValue(
      new ApiError('Failed to fetch dashboard data', 500)
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error-alert')).toBeTruthy()
    })

    expect(screen.getByTestId('error-title').textContent).toContain('Dashboard API Error')
    expect(screen.getByTestId('error-message').textContent).toContain('Failed to fetch dashboard data')
    expect(screen.queryByTestId('dashboard-summary-cards')).toBeNull()
  })

  it('7. Displays 401 unauthorized error state cleanly', async () => {
    vi.spyOn(dashboardService, 'getStats').mockRejectedValue(
      new ApiError('Unauthorized', 401)
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error-alert')).toBeTruthy()
    })

    expect(screen.getByTestId('error-title').textContent).toContain('Unauthorized (401)')
  })

  it('8. Retry button re-fetches dashboard statistics', async () => {
    const getStatsSpy = vi
      .spyOn(dashboardService, 'getStats')
      .mockRejectedValueOnce(new ApiError('Server error', 500))
      .mockResolvedValueOnce(sampleStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error-alert')).toBeTruthy()
    })

    const retryBtn = screen.getByTestId('dashboard-retry-btn')
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-cards')).toBeTruthy()
    })

    expect(getStatsSpy).toHaveBeenCalledTimes(2)
  })

  it('9. Quick action buttons navigate to correct application routes', async () => {
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(sampleStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-quick-actions')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('quick-action-campaign'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/campaigns')

    fireEvent.click(screen.getByTestId('quick-action-template'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/templates')

    fireEvent.click(screen.getByTestId('quick-action-direct'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/direct-message')

    fireEvent.click(screen.getByTestId('view-all-campaigns-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/campaigns')
  })

  it('10. Handles zero-value metrics and edge cases without NaN or broken UI', async () => {
    const zeroStats: DashboardStats = {
      campaigns: {
        total: 0,
        draft: 0,
        scheduled: 0,
        running: 0,
        sending: 0,
        completed: 0,
        partiallyFailed: 0,
        failed: 0,
        cancelled: 0,
      },
      templates: {
        total: 0,
        draft: 0,
        active: 0,
        archived: 0,
      },
      deliveries: {
        totalMessages: 0,
        totalSent: 0,
        totalFailed: 0,
        totalPending: 0,
        totalSending: 0,
        successRate: 0,
      },
      recentCampaigns: [],
    }
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue(zeroStats)

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-cards')).toBeTruthy()
    })

    const campaignsCard = screen.getByTestId('summary-card-campaigns')
    expect(campaignsCard.textContent).toContain('0')
    expect(campaignsCard.textContent).not.toContain('NaN')

    const deliveriesCard = screen.getByTestId('summary-card-deliveries')
    expect(deliveriesCard.textContent).toContain('0')
    expect(deliveriesCard.textContent).not.toContain('NaN')

    const rateCard = screen.getByTestId('summary-card-success-rate')
    expect(rateCard.textContent).toContain('0.0%')
    expect(rateCard.textContent).not.toContain('NaN')
  })
})
