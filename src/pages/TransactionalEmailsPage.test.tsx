// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TransactionalEmailsPage } from './TransactionalEmailsPage'
import * as useAuthModule from '../hooks/useAuth'
import { ApiError, transactionalService } from '../services'
import type { AuthContextValue } from '../types/auth'
import type {
  TransactionalEmailItem,
  TransactionalEmailStats,
  TransactionalHistoryResponse,
} from '../types/transactional'

vi.mock('../services', async () => {
  const actual = await vi.importActual('../services')
  return {
    ...actual,
    transactionalService: {
      getStats: vi.fn(),
      getHistory: vi.fn(),
    },
  }
})

describe('TransactionalEmailsPage component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'sample-admin-token',
      role: 'Admin',
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      ...overrides,
    }
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(defaultAuth)
  }

  const mockStats: TransactionalEmailStats = {
    total: 150,
    sent: 140,
    pending: 5,
    sending: 2,
    failed: 3,
    cancelled: 0,
    successRate: 97.9,
    totalAttempts: 155,
  }

  const mockItems: TransactionalEmailItem[] = [
    {
      id: 'tx-001',
      templateId: 'tpl-reg',
      templateKey: 'auth.register_code',
      templateName: 'Registration Code',
      locale: 'en',
      recipientEmail: 'alex@example.com',
      recipientName: 'Alex',
      notificationType: 'direct',
      deliveryStatus: 'sent',
      attemptsCount: 1,
      createdAt: '2026-09-26T15:00:00Z',
      updatedAt: '2026-09-26T15:00:05Z',
      sentAt: '2026-09-26T15:00:05Z',
    },
    {
      id: 'tx-002',
      templateId: 'tpl-rec',
      templateKey: 'auth.password_recovery',
      templateName: 'Password Recovery',
      locale: 'ru',
      recipientEmail: 'daria@example.com',
      recipientName: 'Daria',
      notificationType: 'direct',
      deliveryStatus: 'failed',
      attemptsCount: 3,
      errorMessage: 'Invalid recipient address',
      createdAt: '2026-09-26T15:10:00Z',
      updatedAt: '2026-09-26T15:11:00Z',
    },
  ]

  const mockHistoryResponse: TransactionalHistoryResponse = {
    items: mockItems,
    total: 2,
    limit: 20,
    offset: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthMock()
    vi.mocked(transactionalService.getStats).mockResolvedValue(mockStats)
    vi.mocked(transactionalService.getHistory).mockResolvedValue(mockHistoryResponse)
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <TransactionalEmailsPage />
      </MemoryRouter>
    )
  }

  it('renders page header, summary statistics, and history table', async () => {
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Transactional Emails' })).toBeDefined()
    expect(
      screen.getByText(/Monitor real-time authentication & transactional email delivery status/i)
    ).toBeDefined()

    // Verify stats cards loaded
    await waitFor(() => {
      expect(screen.getByText('150')).toBeDefined() // Total
      expect(screen.getByText('140')).toBeDefined() // Sent
      expect(screen.getByText('97.9%')).toBeDefined() // Success Rate
    })

    // Verify history rows
    expect(screen.getByText('alex@example.com')).toBeDefined()
    expect(screen.getByText('daria@example.com')).toBeDefined()
    expect(screen.getByText('auth.register_code')).toBeDefined()
    expect(screen.getByText('auth.password_recovery')).toBeDefined()
  })

  it('handles search input debouncing and filters history', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('alex@example.com')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/search recipient email or name/i)
    fireEvent.change(searchInput, { target: { value: 'daria' } })

    await waitFor(
      () => {
        expect(transactionalService.getHistory).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'daria' }),
          expect.anything(),
          expect.anything()
        )
      },
      { timeout: 1000 }
    )
  })

  it('filters by status dropdown', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('alex@example.com')).toBeDefined()
    })

    const statusSelect = screen.getByLabelText(/filter by delivery status/i)
    fireEvent.change(statusSelect, { target: { value: 'failed' } })

    await waitFor(() => {
      expect(transactionalService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('opens and closes the safe detail drawer on clicking Details', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('alex@example.com')).toBeDefined()
    })

    const detailsButtons = screen.getAllByRole('button', { name: /view details for notification/i })
    fireEvent.click(detailsButtons[0])

    // Drawer should open
    expect(screen.getByText('Transactional Email Details')).toBeDefined()
    expect(screen.getByText('tx-001')).toBeDefined()

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /close details/i })
    fireEvent.click(closeBtn)

    expect(screen.queryByText('Transactional Email Details')).toBeNull()
  })

  it('displays error state when unauthorized (401)', async () => {
    vi.mocked(transactionalService.getHistory).mockRejectedValue(
      new ApiError('Unauthorized session', 401)
    )

    renderComponent()

    await waitFor(() => {
      expect(
        screen.getByText(/You do not have access to transactional email history/i)
      ).toBeDefined()
    })
  })

  it('displays empty state when no items are returned', async () => {
    vi.mocked(transactionalService.getHistory).mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('transactional-empty')).toBeDefined()
      expect(screen.getByText(/No transactional emails found/i)).toBeDefined()
    })
  })

  it('refreshes stats and history when clicking Refresh button', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('alex@example.com')).toBeDefined()
    })

    const refreshBtn = screen.getByRole('button', { name: /refresh transactional email data/i })
    fireEvent.click(refreshBtn)

    expect(transactionalService.getStats).toHaveBeenCalledTimes(2)
    expect(transactionalService.getHistory).toHaveBeenCalledTimes(2)
  })
})
