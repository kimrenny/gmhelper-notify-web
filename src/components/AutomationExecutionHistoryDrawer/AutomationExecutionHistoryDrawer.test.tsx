// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AutomationExecutionHistoryDrawer from './AutomationExecutionHistoryDrawer'
import { automationService } from '../../services/automationService'
import { ApiError } from '../../services/apiClient'
import type {
  AutomationExecutionListResponse,
  AutomationRule,
} from '../../types/automation'

import * as useAuthModule from '../../hooks/useAuth'
import type { AuthContextValue } from '../../types/auth'

describe('AutomationExecutionHistoryDrawer component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'sample-access-token-admin',
      role: 'Admin',
      isAuthenticated: true,
      isLoading: false,
      logout: vi.fn(),
      ...overrides,
    }
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(defaultAuth)
  }

  const mockRule: AutomationRule = {
    id: 'rule-uuid-1',
    name: 'Welcome Inactive Users',
    templateId: 'tpl-100',
    enabled: true,
    config: {
      version: 1,
      trigger: 'user.inactive',
      schedule: {
        type: 'daily',
        hourUtc: 3,
        minuteUtc: 0,
      },
      conditions: {
        operator: 'all',
        conditions: [{ field: 'isActive', operator: 'equals', value: true }],
      },
      action: {
        type: 'send_email',
        cooldownDays: 30,
      },
    },
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
  }

  const mockExecutionsResponse: AutomationExecutionListResponse = {
    items: [
      {
        id: 'exec-1',
        ruleId: 'rule-uuid-1',
        eventId: 'evt-1001',
        recipientEmail: 'user1@example.com',
        externalUserId: 'usr-123',
        notificationId: 'notif-456',
        status: 'success',
        executedAt: '2026-09-20T12:00:00Z',
        createdAt: '2026-09-20T12:00:00Z',
      },
      {
        id: 'exec-2',
        ruleId: 'rule-uuid-1',
        eventId: 'evt-1002',
        recipientEmail: 'user2@example.com',
        externalUserId: null,
        notificationId: null,
        status: 'skipped_cooldown',
        executedAt: '2026-09-20T11:50:00Z',
        createdAt: '2026-09-20T11:50:00Z',
      },
      {
        id: 'exec-3',
        ruleId: 'rule-uuid-1',
        eventId: 'evt-1003',
        recipientEmail: 'user3@example.com',
        externalUserId: 'usr-789',
        notificationId: null,
        status: 'skipped_duplicate',
        executedAt: '2026-09-20T11:40:00Z',
        createdAt: '2026-09-20T11:40:00Z',
      },
      {
        id: 'exec-4',
        ruleId: 'rule-uuid-1',
        eventId: 'evt-1004',
        recipientEmail: 'user4@example.com',
        externalUserId: 'usr-999',
        notificationId: null,
        status: 'failed',
        executedAt: '2026-09-20T11:30:00Z',
        createdAt: '2026-09-20T11:30:00Z',
      },
    ],
    total: 4,
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

  it('1. Does not render when rule is null', () => {
    const { container } = render(
      <AutomationExecutionHistoryDrawer rule={null} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('2. Shows drawer backdrop, header info, and loading state while fetching', () => {
    vi.spyOn(automationService, 'getRuleExecutions').mockReturnValue(new Promise(() => {}))
    render(<AutomationExecutionHistoryDrawer rule={mockRule} onClose={vi.fn()} />)

    expect(screen.getByTestId('execution-history-backdrop')).toBeDefined()
    expect(screen.getByTestId('execution-history-drawer')).toBeDefined()
    expect(screen.getByTestId('execution-history-rule-name').textContent).toBe('Welcome Inactive Users')
    expect(screen.getByTestId('execution-history-rule-id').textContent).toContain('rule-uuid-1')
    expect(screen.getByTestId('execution-history-trigger-badge').textContent).toBe('user.inactive')
    expect(screen.getByTestId('execution-history-loading')).toBeDefined()
  })

  it('3. Renders execution history items and all status badges successfully', async () => {
    vi.spyOn(automationService, 'getRuleExecutions').mockResolvedValue(mockExecutionsResponse)
    render(<AutomationExecutionHistoryDrawer rule={mockRule} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId('execution-history-loading')).toBeNull()
      expect(screen.getByTestId('executions-table')).toBeDefined()
    })

    // Verify executions rendered
    expect(screen.getByTestId('execution-row-exec-1')).toBeDefined()
    expect(screen.getByText('user1@example.com')).toBeDefined()
    expect(screen.getByText('usr-123')).toBeDefined()
    expect(screen.getByText('notif-456')).toBeDefined()
    expect(screen.getByTestId('execution-status-exec-1').textContent).toBe('Success')

    // Skipped Cooldown
    expect(screen.getByTestId('execution-row-exec-2')).toBeDefined()
    expect(screen.getByText('user2@example.com')).toBeDefined()
    expect(screen.getByTestId('execution-status-exec-2').textContent).toBe('Skipped (Cooldown)')

    // Skipped Duplicate
    expect(screen.getByTestId('execution-row-exec-3')).toBeDefined()
    expect(screen.getByTestId('execution-status-exec-3').textContent).toBe('Skipped (Duplicate)')

    // Failed
    expect(screen.getByTestId('execution-row-exec-4')).toBeDefined()
    expect(screen.getByTestId('execution-status-exec-4').textContent).toBe('Failed')
  })

  it('4. Renders empty state when rule has no executions (total: 0, items: [])', async () => {
    vi.spyOn(automationService, 'getRuleExecutions').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })
    render(<AutomationExecutionHistoryDrawer rule={mockRule} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId('execution-history-loading')).toBeNull()
      expect(screen.getByTestId('execution-history-empty')).toBeDefined()
    })

    expect(screen.getByText('No execution records found')).toBeDefined()
  })

  it('5. Handles error state and retry functionality', async () => {
    const err = new ApiError('Service Unavailable', 500, 'INTERNAL_ERROR')
    const getExecutionsSpy = vi
      .spyOn(automationService, 'getRuleExecutions')
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(mockExecutionsResponse)

    render(<AutomationExecutionHistoryDrawer rule={mockRule} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('execution-history-error')).toBeDefined()
      expect(screen.getByTestId('execution-history-retry-btn')).toBeDefined()
    })

    // Click retry
    fireEvent.click(screen.getByTestId('execution-history-retry-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('execution-history-error')).toBeNull()
      expect(screen.getByTestId('executions-table')).toBeDefined()
    })

    expect(getExecutionsSpy).toHaveBeenCalledTimes(2)
  })

  it('6. Handles server-side pagination: Next and Previous page requests', async () => {
    const firstPage: AutomationExecutionListResponse = {
      items: mockExecutionsResponse.items,
      total: 35,
      limit: 20,
      offset: 0,
    }
    const secondPage: AutomationExecutionListResponse = {
      items: [
        {
          id: 'exec-5',
          ruleId: 'rule-uuid-1',
          eventId: 'evt-1005',
          recipientEmail: 'user5@example.com',
          status: 'success',
          executedAt: '2026-09-20T11:00:00Z',
          createdAt: '2026-09-20T11:00:00Z',
        },
      ],
      total: 35,
      limit: 20,
      offset: 20,
    }

    const getExecutionsSpy = vi
      .spyOn(automationService, 'getRuleExecutions')
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)

    render(<AutomationExecutionHistoryDrawer rule={mockRule} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('executions-table')).toBeDefined()
      expect(screen.getByText('Showing 1 - 4 of 35 executions')).toBeDefined()
      expect(screen.getByText('Page 1 of 2')).toBeDefined()
    })

    const prevBtn = screen.getByTestId('execution-history-prev-btn') as HTMLButtonElement
    const nextBtn = screen.getByTestId('execution-history-next-btn') as HTMLButtonElement

    expect(prevBtn.disabled).toBe(true)
    expect(nextBtn.disabled).toBe(false)

    // Click Next
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(getExecutionsSpy).toHaveBeenCalledWith(
        'rule-uuid-1',
        { limit: 20, offset: 20 },
        expect.anything(),
        expect.anything()
      )
    })
  })

  it('7. Calls onClose when Close button, backdrop, or Escape key is triggered', () => {
    const onCloseMock = vi.fn()
    vi.spyOn(automationService, 'getRuleExecutions').mockReturnValue(new Promise(() => {}))
    const { unmount } = render(
      <AutomationExecutionHistoryDrawer rule={mockRule} onClose={onCloseMock} />
    )

    // 1. Close button
    fireEvent.click(screen.getByTestId('execution-history-close-btn'))
    expect(onCloseMock).toHaveBeenCalledTimes(1)

    // 2. Backdrop
    fireEvent.click(screen.getByTestId('execution-history-backdrop'))
    expect(onCloseMock).toHaveBeenCalledTimes(2)

    // 3. Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseMock).toHaveBeenCalledTimes(3)

    unmount()
  })
})
