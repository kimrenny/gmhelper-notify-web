// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DirectMessagePage } from './DirectMessagePage'
import { ApiError, directService, templateService, userService } from '../services'
import * as useAuthModule from '../hooks/useAuth'
import type { AuthContextValue } from '../types/auth'
import type { DirectNotification, EmailTemplate, UserSearchResult } from '../types'

describe('DirectMessagePage - Complete Workflow', () => {
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

  const mockTemplates: EmailTemplate[] = [
    {
      id: 'tpl-welcome',
      templateKey: 'welcome_user',
      name: 'Welcome Email',
      templateType: 'direct',
      subject: 'Welcome, {{username}}!',
      htmlBody: '<p>Hello {{username}}, your role is {{role}}.</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-custom-vars',
      templateKey: 'order_receipt',
      name: 'Order Receipt',
      templateType: 'direct',
      subject: 'Order #{{orderId}} confirmation for {{username}}',
      htmlBody: '<p>Hi {{username}}, your tracking code is {{trackingCode}} for order {{orderId}}.</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-no-vars',
      templateKey: 'static_notice',
      name: 'Static Notice',
      templateType: 'direct',
      subject: 'System Maintenance Notice',
      htmlBody: '<p>The system will be undergoing maintenance tonight.</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-inactive',
      templateKey: 'old_template',
      name: 'Inactive Template',
      templateType: 'direct',
      subject: 'Old subject',
      htmlBody: '<p>Old body</p>',
      locale: 'en',
      status: 'archived',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ]

  const mockUsers: UserSearchResult[] = [
    {
      id: 'usr-101',
      username: 'alice_smith',
      email: 'alice@example.com',
      role: 'Admin',
      language: 'en',
      isActive: true,
      isBlocked: false,
      registrationDate: '2026-01-01T00:00:00Z',
    },
    {
      id: 'usr-102',
      username: 'bob_jones',
      email: 'bob@example.com',
      role: 'User',
      language: 'de',
      isActive: true,
      isBlocked: true,
      registrationDate: '2026-02-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
    vi.spyOn(templateService, 'getTemplates').mockResolvedValue(mockTemplates)
    vi.spyOn(userService, 'searchUsers').mockResolvedValue(mockUsers)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads and displays only active templates on mount', async () => {
    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    const select = screen.getByRole('combobox', { name: /email template/i })
    expect(select.textContent).toContain('Welcome Email (en)')
    expect(select.textContent).toContain('Order Receipt (en)')
    expect(select.textContent).toContain('Static Notice (en)')
    expect(select.textContent).not.toContain('Inactive Template')
  })

  it('searches users with debounce and displays search results', async () => {
    render(<DirectMessagePage />)

    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(
      () => {
        expect(userService.searchUsers).toHaveBeenCalledWith('alice', 10, expect.anything())
      },
      { timeout: 1500 }
    )

    await waitFor(() => {
      expect(screen.getByText('alice_smith')).toBeDefined()
      expect(screen.getByText('bob_jones')).toBeDefined()
    })
  })

  it('does not search when query is empty or whitespace', async () => {
    render(<DirectMessagePage />)

    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: '   ' } })

    await new Promise((r) => setTimeout(r, 400))
    expect(userService.searchUsers).not.toHaveBeenCalled()
  })

  it('allows selecting a user, displays user details, and allows clearing selected user', async () => {
    render(<DirectMessagePage />)

    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user alice_smith/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /select user alice_smith/i }))

    expect(screen.getByTestId('selected-user-card')).toBeDefined()
    expect(screen.getByText('alice_smith')).toBeDefined()
    expect(screen.getByText(/alice@example.com/)).toBeDefined()
    expect(screen.getByText('Active')).toBeDefined()

    // Clear user
    const clearBtn = screen.getByRole('button', { name: /clear selected user/i })
    fireEvent.click(clearBtn)

    expect(screen.queryByTestId('selected-user-card')).toBeNull()
    expect(screen.getByRole('textbox', { name: /search users/i })).toBeDefined()
  })

  it('displays blocked status badge when a blocked user is selected', async () => {
    render(<DirectMessagePage />)

    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: 'bob' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user bob_jones/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /select user bob_jones/i }))

    expect(screen.getByText('Blocked')).toBeDefined()
  })

  it('supports Custom Email mode with email validation', async () => {
    render(<DirectMessagePage />)

    // Switch to Custom Email tab
    const customEmailTab = screen.getByRole('button', { name: /custom email/i })
    fireEvent.click(customEmailTab)

    const emailInput = screen.getByLabelText(/recipient email \*/i)
    const nameInput = screen.getByLabelText(/recipient name \(optional\)/i)

    expect(emailInput).toBeDefined()
    expect(nameInput).toBeDefined()

    // Invalid email on blur
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.blur(emailInput)

    expect(screen.getByText(/please enter a valid email address/i)).toBeDefined()

    // Valid email
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
    expect(screen.queryByText(/please enter a valid email address/i)).toBeNull()
  })

  it('switching recipient modes resets incompatible state', async () => {
    render(<DirectMessagePage />)

    // 1. Select a registered user
    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user alice_smith/i })).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: /select user alice_smith/i }))
    expect(screen.getByTestId('selected-user-card')).toBeDefined()

    // 2. Switch to Custom Email mode
    fireEvent.click(screen.getByRole('button', { name: /custom email/i }))
    const emailInput = screen.getByLabelText(/recipient email \*/i)
    fireEvent.change(emailInput, { target: { value: 'custom@example.com' } })
    expect(screen.queryByTestId('selected-user-card')).toBeNull()

    // 3. Switch back to Registered User mode -> custom inputs should be cleared and selected user reset
    fireEvent.click(screen.getByRole('button', { name: /registered user/i }))
    expect(screen.queryByTestId('selected-user-card')).toBeNull()
    expect((screen.getByRole('textbox', { name: /search users/i }) as HTMLInputElement).value).toBe('')
  })

  it('changing templates preserves compatible variables and recalculates required variables', async () => {
    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    const select = screen.getByRole('combobox', { name: /email template/i })

    // 1. Select tpl-custom-vars (has orderId, trackingCode)
    fireEvent.change(select, { target: { value: 'tpl-custom-vars' } })

    // Fill orderId and trackingCode
    const orderInput = screen.getByPlaceholderText('Enter value for {{orderId}}')
    fireEvent.change(orderInput, { target: { value: 'ORD-555' } })

    // 2. Switch to tpl-welcome (has username, role)
    fireEvent.change(select, { target: { value: 'tpl-welcome' } })

    // Order input should not be in document
    expect(screen.queryByPlaceholderText('Enter value for {{orderId}}')).toBeNull()

    // 3. Switch back to tpl-custom-vars -> check if new variables input renders
    fireEvent.change(select, { target: { value: 'tpl-custom-vars' } })
    expect(screen.getByPlaceholderText('Enter value for {{orderId}}')).toBeDefined()
  })

  it('validates required fields on Send and shows inline error messages', async () => {
    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    // Click Send without template or recipient
    const sendBtn = screen.getByRole('button', { name: /send direct message/i })
    fireEvent.click(sendBtn)

    expect(screen.getByText('Please select an email template.')).toBeDefined()
    expect(screen.getByText('Please select a registered user.')).toBeDefined()
    expect(screen.queryByTestId('confirmation-modal')).toBeNull()
  })

  it('renders live preview with auto-populated user variables and custom variables', async () => {
    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    // Select template
    const select = screen.getByRole('combobox', { name: /email template/i })
    fireEvent.change(select, { target: { value: 'tpl-custom-vars' } })

    // Select registered user
    const searchInput = screen.getByRole('textbox', { name: /search users/i })
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user alice_smith/i })).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: /select user alice_smith/i }))

    // Check preview before custom variables are filled
    const previewSubject = screen.getByTestId('preview-subject')
    expect(previewSubject.textContent).toContain('alice_smith')
    expect(previewSubject.textContent).toContain('{{orderId}}')

    // Fill custom variables
    const orderInput = screen.getByPlaceholderText('Enter value for {{orderId}}')
    const trackingInput = screen.getByPlaceholderText('Enter value for {{trackingCode}}')
    fireEvent.change(orderInput, { target: { value: 'ORD-888' } })
    fireEvent.change(trackingInput, { target: { value: 'TRK-999' } })

    // Preview should update in real-time
    expect(previewSubject.textContent).toBe('Order #ORD-888 confirmation for alice_smith')
    const previewBody = screen.getByTestId('preview-body')
    expect(previewBody.textContent).toContain('Hi alice_smith, your tracking code is TRK-999 for order ORD-888.')
  })

  it('opens confirmation modal on valid form and allows cancelling', async () => {
    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    // Select template
    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-no-vars' },
    })

    // Select user
    fireEvent.change(screen.getByRole('textbox', { name: /search users/i }), {
      target: { value: 'alice' },
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user alice_smith/i })).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: /select user alice_smith/i }))

    // Click Send
    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))

    // Modal should be open
    expect(screen.getByTestId('confirmation-modal')).toBeDefined()
    expect(screen.getByText('Confirm Direct Message Send')).toBeDefined()
    expect(screen.getByText(/alice_smith \(alice@example.com\)/)).toBeDefined()

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('confirmation-modal')).toBeNull()
  })

  it('executes full workflow for registered user: Create -> Deliver -> Immediate Sent Success', async () => {
    const mockCreated: DirectNotification = {
      id: 'notif-reg-1',
      templateId: 'tpl-custom-vars',
      externalUserId: 'usr-101',
      recipientEmail: 'alice@example.com',
      recipientName: 'alice_smith',
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockDelivered: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'sent',
      attemptsCount: 1,
      sentAt: '2026-09-17T12:00:02Z',
      updatedAt: '2026-09-17T12:00:02Z',
    }

    const createSpy = vi.spyOn(directService, 'createNotification').mockResolvedValue(mockCreated)
    const deliverSpy = vi.spyOn(directService, 'deliverNotification').mockResolvedValue(mockDelivered)

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    // 1. Select template
    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-custom-vars' },
    })

    // 2. Select registered user
    fireEvent.change(screen.getByRole('textbox', { name: /search users/i }), {
      target: { value: 'alice' },
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select user alice_smith/i })).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: /select user alice_smith/i }))

    // 3. Fill custom variables
    fireEvent.change(screen.getByPlaceholderText('Enter value for {{orderId}}'), {
      target: { value: '1001' },
    })
    fireEvent.change(screen.getByPlaceholderText('Enter value for {{trackingCode}}'), {
      target: { value: 'TRACK-123' },
    })

    // 4. Click Send -> Open Modal
    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))
    expect(screen.getByTestId('confirmation-modal')).toBeDefined()

    // 5. Confirm Send
    fireEvent.click(screen.getByRole('button', { name: /confirm & send/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        {
          templateId: 'tpl-custom-vars',
          externalUserId: 'usr-101',
          recipientEmail: 'alice@example.com',
          recipientName: 'alice_smith',
          notificationType: 'direct',
          payload: {
            orderId: '1001',
            trackingCode: 'TRACK-123',
          },
        },
        expect.anything()
      )
      expect(deliverSpy).toHaveBeenCalledWith('notif-reg-1', expect.anything())
    })

    // 6. Verify result view
    await waitFor(() => {
      expect(screen.getByTestId('delivery-result-card')).toBeDefined()
      expect(screen.getByTestId('delivery-success-banner')).toBeDefined()
      expect(screen.getByText(/Message delivered successfully to alice@example.com/)).toBeDefined()
      expect(screen.getByText('notif-reg-1')).toBeDefined()
    })

    // 7. Reset page with Send Another Message
    fireEvent.click(screen.getByRole('button', { name: /send another message/i }))
    expect(screen.queryByTestId('delivery-result-card')).toBeNull()
    expect(screen.getByRole('button', { name: /send direct message/i })).toBeDefined()
  })

  it('executes full workflow for custom email: Create -> Deliver -> Success', async () => {
    const mockCreated: DirectNotification = {
      id: 'notif-custom-1',
      templateId: 'tpl-no-vars',
      recipientEmail: 'custom@example.com',
      recipientName: 'Custom Recipient',
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockDelivered: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'sent',
      attemptsCount: 1,
      sentAt: '2026-09-17T12:00:01Z',
    }

    const createSpy = vi.spyOn(directService, 'createNotification').mockResolvedValue(mockCreated)
    const deliverSpy = vi.spyOn(directService, 'deliverNotification').mockResolvedValue(mockDelivered)

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    // Template
    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-no-vars' },
    })

    // Custom Email tab
    fireEvent.click(screen.getByRole('button', { name: /custom email/i }))
    fireEvent.change(screen.getByLabelText(/recipient email \*/i), {
      target: { value: 'custom@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/recipient name \(optional\)/i), {
      target: { value: 'Custom Recipient' },
    })

    // Send
    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & send/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        {
          templateId: 'tpl-no-vars',
          recipientEmail: 'custom@example.com',
          recipientName: 'Custom Recipient',
          notificationType: 'direct',
          payload: undefined,
        },
        expect.anything()
      )
      expect(deliverSpy).toHaveBeenCalledWith('notif-custom-1', expect.anything())
      expect(screen.getByTestId('delivery-success-banner')).toBeDefined()
    })
  })

  it('polls notification status when delivery returns pending/sending until terminal state', async () => {
    const mockCreated: DirectNotification = {
      id: 'notif-poll-1',
      templateId: 'tpl-no-vars',
      recipientEmail: 'poll@example.com',
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockDelivering: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'sending',
      attemptsCount: 1,
    }

    const mockCompleted: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'sent',
      attemptsCount: 1,
      sentAt: '2026-09-17T12:00:03Z',
    }

    vi.spyOn(directService, 'createNotification').mockResolvedValue(mockCreated)
    vi.spyOn(directService, 'deliverNotification').mockResolvedValue(mockDelivering)
    const getSpy = vi.spyOn(directService, 'getNotification').mockResolvedValue(mockCompleted)

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-no-vars' },
    })
    fireEvent.click(screen.getByRole('button', { name: /custom email/i }))
    fireEvent.change(screen.getByLabelText(/recipient email \*/i), {
      target: { value: 'poll@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & send/i }))

    // Verify progress banner is shown
    await waitFor(() => {
      expect(screen.getByTestId('delivery-progress-banner')).toBeDefined()
    })

    // Wait for polling to fetch terminal sent state
    await waitFor(
      () => {
        expect(getSpy).toHaveBeenCalledWith('notif-poll-1', expect.anything())
        expect(screen.getByTestId('delivery-success-banner')).toBeDefined()
      },
      { timeout: 3000 }
    )
  })

  it('displays error and supports Retry Delivery on failed delivery attempt', async () => {
    const mockCreated: DirectNotification = {
      id: 'notif-fail-1',
      templateId: 'tpl-no-vars',
      recipientEmail: 'fail@example.com',
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockFailed: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'failed',
      errorMessage: 'SMTP connection refused',
      attemptsCount: 1,
    }

    const mockRetriedSuccess: DirectNotification = {
      ...mockCreated,
      deliveryStatus: 'sent',
      sentAt: '2026-09-17T12:00:05Z',
      attemptsCount: 2,
    }

    vi.spyOn(directService, 'createNotification').mockResolvedValue(mockCreated)
    const deliverSpy = vi
      .spyOn(directService, 'deliverNotification')
      .mockResolvedValueOnce(mockFailed)
      .mockResolvedValueOnce(mockRetriedSuccess)

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-no-vars' },
    })
    fireEvent.click(screen.getByRole('button', { name: /custom email/i }))
    fireEvent.change(screen.getByLabelText(/recipient email \*/i), {
      target: { value: 'fail@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & send/i }))

    // Verify failure state
    await waitFor(() => {
      expect(screen.getByTestId('delivery-failure-banner')).toBeDefined()
      expect(screen.getByText(/SMTP connection refused/)).toBeDefined()
      expect(screen.getByRole('button', { name: /retry delivery/i })).toBeDefined()
    })

    // Click Retry
    fireEvent.click(screen.getByRole('button', { name: /retry delivery/i }))

    await waitFor(() => {
      expect(deliverSpy).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('delivery-success-banner')).toBeDefined()
    })
  })

  it('displays create API errors on compose form without transitioning', async () => {
    vi.spyOn(directService, 'createNotification').mockRejectedValue(
      new ApiError('Template is inactive for delivery', 400, 'BAD_REQUEST')
    )

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    fireEvent.change(screen.getByRole('combobox', { name: /email template/i }), {
      target: { value: 'tpl-no-vars' },
    })
    fireEvent.click(screen.getByRole('button', { name: /custom email/i }))
    fireEvent.change(screen.getByLabelText(/recipient email \*/i), {
      target: { value: 'test@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send direct message/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm & send/i }))

    await waitFor(() => {
      expect(screen.getByTestId('submit-error-banner')).toBeDefined()
      expect(screen.getByText('Template is inactive for delivery')).toBeDefined()
      expect(screen.queryByTestId('delivery-result-card')).toBeNull()
    })
  })

  it('only displays direct templates and excludes campaign, user_agreement, and automation templates', async () => {
    const mixedTemplates: EmailTemplate[] = [
      {
        id: 'tpl-direct-valid',
        templateKey: 'direct_valid',
        name: 'Direct Valid Template',
        templateType: 'direct',
        subject: 'Direct Sub',
        htmlBody: '<p>Direct</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-campaign-excluded',
        templateKey: 'campaign_key',
        name: 'Campaign Excluded Template',
        templateType: 'campaign',
        subject: 'Camp Sub',
        htmlBody: '<p>Camp</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-agreement-excluded',
        templateKey: 'agreement_key',
        name: 'Agreement Excluded Template',
        templateType: 'user_agreement',
        subject: 'Agree Sub',
        htmlBody: '<p>Agree</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-automation-excluded',
        templateKey: 'automation_key',
        name: 'Automation Excluded Template',
        templateType: 'automation',
        subject: 'Auto Sub',
        htmlBody: '<p>Auto</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]

    vi.spyOn(templateService, 'getTemplates').mockResolvedValue(mixedTemplates)

    render(<DirectMessagePage />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /email template/i })).toBeDefined()
    })

    const select = screen.getByRole('combobox', { name: /email template/i })
    expect(select.textContent).toContain('Direct Valid Template')
    expect(select.textContent).not.toContain('Campaign Excluded Template')
    expect(select.textContent).not.toContain('Agreement Excluded Template')
    expect(select.textContent).not.toContain('Automation Excluded Template')
  })
})
