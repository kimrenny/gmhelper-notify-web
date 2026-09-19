// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ActivityDetailDrawer from './ActivityDetailDrawer'
import { activityService } from '../../services/activityService'
import { ApiError } from '../../services/apiClient'
import type { ActivityDetail } from '../../types/activity'

import * as useAuthModule from '../../hooks/useAuth'
import type { AuthContextValue } from '../../types/auth'

describe('ActivityDetailDrawer component', () => {
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

  const mockDetailSuccess: ActivityDetail = {
    id: 'act-101',
    eventType: 'template.updated',
    actor: {
      type: 'user',
      userId: 'user-owner-1',
      name: 'Owner Admin',
      role: 'owner',
    },
    target: {
      type: 'template',
      id: 'tpl-999',
      name: 'Verification Email',
    },
    status: 'success',
    summary: 'Updated template version to 2',
    details: {
      version: 2,
      locale: 'en',
      subject: 'Verify your email address',
      nested: {
        enabled: true,
        tags: ['auth', 'security'],
      },
    },
    errorMessage: null,
    createdAt: '2026-09-19T11:00:00Z',
  }

  const mockDetailFailed: ActivityDetail = {
    id: 'act-102',
    eventType: 'direct.failed',
    actor: {
      type: 'service',
      name: 'Worker Service',
      role: 'service',
    },
    target: {
      type: 'direct_notification',
      id: 'notif-555',
    },
    status: 'failure',
    summary: 'Direct notification delivery failed',
    details: {
      recipient: 'bad-email@example.com',
      attempt: 3,
    },
    errorMessage: '550 5.1.1 Mailbox unavailable',
    createdAt: '2026-09-19T11:15:00Z',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Does not render when activityId is null', () => {
    const { container } = render(<ActivityDetailDrawer activityId={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('2. Opens drawer and displays loading state while request is pending', () => {
    vi.spyOn(activityService, 'getById').mockReturnValue(new Promise(() => {}))
    render(<ActivityDetailDrawer activityId="act-101" onClose={vi.fn()} />)

    expect(screen.getByTestId('activity-detail-backdrop')).toBeDefined()
    expect(screen.getByTestId('activity-detail-drawer')).toBeDefined()
    expect(screen.getByTestId('activity-detail-loading')).toBeDefined()
    expect(screen.getByText('Loading activity details...')).toBeDefined()
    expect(screen.queryByTestId('activity-detail-content')).toBeNull()
  })

  it('3. Renders full activity details when getById succeeds', async () => {
    vi.spyOn(activityService, 'getById').mockResolvedValue(mockDetailSuccess)
    render(<ActivityDetailDrawer activityId="act-101" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-detail-loading')).toBeNull()
      expect(screen.getByTestId('activity-detail-content')).toBeDefined()
    })

    // Header info
    expect(screen.getByText('Template Updated')).toBeDefined()
    expect(screen.getByText('template.updated')).toBeDefined()
    expect(screen.getByTestId('activity-detail-status-badge').textContent).toBe('success')

    // Actor info
    expect(screen.getByText('Owner Admin')).toBeDefined()
    expect(screen.getByText('user-owner-1')).toBeDefined()
    expect(screen.getByText('owner')).toBeDefined()

    // Target info
    expect(screen.getByText('Email Template')).toBeDefined()
    expect(screen.getByText('Verification Email')).toBeDefined()
    expect(screen.getByText('tpl-999')).toBeDefined()

    // Summary
    expect(screen.getByText('Updated template version to 2')).toBeDefined()

    // Structured Details
    expect(screen.getByText('version:')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('locale:')).toBeDefined()
    expect(screen.getByText('en')).toBeDefined()

    // Error section should not be present
    expect(screen.queryByTestId('activity-detail-error-message')).toBeNull()
  })

  it('4. Renders actor information for system and service accounts', async () => {
    vi.spyOn(activityService, 'getById').mockResolvedValue(mockDetailFailed)
    render(<ActivityDetailDrawer activityId="act-102" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('activity-detail-content')).toBeDefined()
    })

    expect(screen.getByText('Worker Service')).toBeDefined()
    expect(screen.getByText('Direct Message')).toBeDefined()
  })

  it('5. Renders error message section when errorMessage exists', async () => {
    vi.spyOn(activityService, 'getById').mockResolvedValue(mockDetailFailed)
    render(<ActivityDetailDrawer activityId="act-102" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('activity-detail-error-message')).toBeDefined()
    })

    expect(screen.getByText('Failure Error Details')).toBeDefined()
    expect(screen.getByText('550 5.1.1 Mailbox unavailable')).toBeDefined()
  })

  it('6. Handles array, string, number, and null detail structures gracefully', async () => {
    const customDetail: ActivityDetail = {
      ...mockDetailSuccess,
      details: ['item-1', 'item-2', 42, true, null],
    }
    vi.spyOn(activityService, 'getById').mockResolvedValue(customDetail)
    render(<ActivityDetailDrawer activityId="act-101" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('activity-detail-content')).toBeDefined()
    })

    expect(screen.getByTestId('activity-detail-json')).toBeDefined()
  })

  it('7. Displays explicit 403 Access Denied state', async () => {
    const err = new ApiError('Forbidden', 403, 'FORBIDDEN')
    vi.spyOn(activityService, 'getById').mockRejectedValue(err)
    render(<ActivityDetailDrawer activityId="act-101" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-detail-loading')).toBeNull()
      expect(screen.getByTestId('activity-detail-error')).toBeDefined()
      expect(screen.getByTestId('detail-error-title').textContent).toContain('Access Denied (403)')
    })
  })

  it('8. Displays explicit 404 Activity Not Found state without retry button', async () => {
    const err = new ApiError('Not Found', 404, 'NOT_FOUND')
    vi.spyOn(activityService, 'getById').mockRejectedValue(err)
    render(<ActivityDetailDrawer activityId="act-missing" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId('activity-detail-loading')).toBeNull()
      expect(screen.getByTestId('activity-detail-error')).toBeDefined()
      expect(screen.getByTestId('detail-error-title').textContent).toContain('Activity Not Found (404)')
      expect(screen.queryByTestId('activity-detail-retry-btn')).toBeNull()
    })
  })

  it('9. Displays error state on general/network failure and allows retry', async () => {
    const err = new ApiError('Network connection failure', 0, 'NETWORK_ERROR')
    const getByIdSpy = vi
      .spyOn(activityService, 'getById')
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(mockDetailSuccess)

    render(<ActivityDetailDrawer activityId="act-101" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('activity-detail-error')).toBeDefined()
      expect(screen.getByTestId('activity-detail-retry-btn')).toBeDefined()
    })

    // Click Retry
    fireEvent.click(screen.getByTestId('activity-detail-retry-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('activity-detail-error')).toBeNull()
      expect(screen.getByTestId('activity-detail-content')).toBeDefined()
    })

    expect(getByIdSpy).toHaveBeenCalledTimes(2)
  })

  it('10. Calls onClose when Close button is clicked', () => {
    const onCloseMock = vi.fn()
    vi.spyOn(activityService, 'getById').mockReturnValue(new Promise(() => {}))
    render(<ActivityDetailDrawer activityId="act-101" onClose={onCloseMock} />)

    const closeBtn = screen.getByTestId('activity-detail-close-btn')
    fireEvent.click(closeBtn)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('11. Calls onClose when Backdrop is clicked', () => {
    const onCloseMock = vi.fn()
    vi.spyOn(activityService, 'getById').mockReturnValue(new Promise(() => {}))
    render(<ActivityDetailDrawer activityId="act-101" onClose={onCloseMock} />)

    const backdrop = screen.getByTestId('activity-detail-backdrop')
    fireEvent.click(backdrop)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('12. Calls onClose when Escape key is pressed', () => {
    const onCloseMock = vi.fn()
    vi.spyOn(activityService, 'getById').mockReturnValue(new Promise(() => {}))
    render(<ActivityDetailDrawer activityId="act-101" onClose={onCloseMock} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('13. Race condition protection: Stale request A does not overwrite subsequent request B', async () => {
    let resolveA: (val: ActivityDetail) => void = () => {}
    let resolveB: (val: ActivityDetail) => void = () => {}

    const promiseA = new Promise<ActivityDetail>((resolve) => {
      resolveA = resolve
    })
    const promiseB = new Promise<ActivityDetail>((resolve) => {
      resolveB = resolve
    })

    vi.spyOn(activityService, 'getById').mockImplementation((id: string) => {
      if (id === 'act-A') return promiseA
      if (id === 'act-B') return promiseB
      return Promise.reject(new Error('unknown'))
    })

    const { rerender } = render(
      <ActivityDetailDrawer activityId="act-A" onClose={vi.fn()} />
    )

    // Fast switch to act-B
    rerender(<ActivityDetailDrawer activityId="act-B" onClose={vi.fn()} />)

    // Resolve B first
    resolveB(mockDetailFailed)
    await waitFor(() => {
      expect(screen.getByText('Direct Message Delivery Failed')).toBeDefined()
    })

    // Resolve stale request A
    resolveA(mockDetailSuccess)

    // Drawer should still display B
    expect(screen.getByText('Direct Message Delivery Failed')).toBeDefined()
    expect(screen.queryByText('Template Updated')).toBeNull()
  })
})
