// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AgreementPage from './AgreementPage'
import * as useAuthModule from '../hooks/useAuth'
import type { AuthContextValue } from '../types/auth'
import type { Campaign, EmailTemplate, PreviewTemplateResponse } from '../types'

describe('AgreementPage component', () => {
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
      id: 'tpl-active-1',
      templateKey: 'terms_update',
      name: 'Terms of Service Update 2026',
      subject: 'Important update to our Terms of Service',
      htmlBody: '<h1>Terms Update</h1><p>Please review our new terms.</p>',
      plainTextBody: 'Please review our new terms.',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-active-2',
      templateKey: 'privacy_policy',
      name: 'Privacy Policy Notice',
      subject: 'Notice regarding our Privacy Policy',
      htmlBody: '<h1>Privacy Policy</h1><p>We updated our privacy practices.</p>',
      plainTextBody: 'We updated our privacy practices.',
      locale: 'en',
      status: 'active',
      version: 2,
      createdAt: '2026-09-02T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    },
    {
      id: 'tpl-draft-1',
      templateKey: 'draft_terms',
      name: 'Draft Terms (Should Be Filtered)',
      subject: 'Draft Subject',
      htmlBody: '<p>Draft</p>',
      locale: 'en',
      status: 'draft',
      version: 1,
      createdAt: '2026-09-03T00:00:00Z',
      updatedAt: '2026-09-03T00:00:00Z',
    },
    {
      id: 'tpl-archived-1',
      templateKey: 'old_terms',
      name: 'Archived Terms (Should Be Filtered)',
      subject: 'Archived Subject',
      htmlBody: '<p>Archived</p>',
      locale: 'en',
      status: 'archived',
      version: 1,
      createdAt: '2026-09-04T00:00:00Z',
      updatedAt: '2026-09-04T00:00:00Z',
    },
  ]

  const mockPreviewResponse: PreviewTemplateResponse = {
    subject: 'Important update to our Terms of Service',
    htmlBody: '<h1>Terms Update</h1><p>Please review our new terms.</p>',
    plainTextBody: 'Please review our new terms.',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('1. Initial loading state: displays template loading indicator', async () => {
    let resolveTemplates: (value: Response) => void
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveTemplates = resolve
    })

    globalThis.fetch = vi.fn().mockImplementation(() => pendingPromise)

    render(<AgreementPage />)

    expect(screen.getByText(/Loading active templates.../i)).toBeDefined()

    await act(async () => {
      resolveTemplates!(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    await waitFor(() => {
      expect(screen.queryByText(/Loading active templates.../i)).toBeNull()
    })
  })

  it('2. Active templates are displayed in the selector', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByText('Terms of Service Update 2026 (terms_update)')).toBeDefined()
      expect(screen.getByText('Privacy Policy Notice (privacy_policy)')).toBeDefined()
    })
  })

  it('3. Draft and archived templates are excluded from selector options', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByText('Terms of Service Update 2026 (terms_update)')).toBeDefined()
    })

    expect(screen.queryByText(/Draft Terms/i)).toBeNull()
    expect(screen.queryByText(/Archived Terms/i)).toBeNull()
  })

  it('4. Empty active-template state explains that an active template is required', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'tpl-draft',
            templateKey: 'draft',
            name: 'Draft Only',
            status: 'draft',
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('no-templates-notice')).toBeDefined()
    })

    expect(
      screen.getByText(/An active email template must be created in Email Templates/i)
    ).toBeDefined()
  })

  it('5. Template loading error displays error banner with working retry', async () => {
    let attempts = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      attempts++
      if (attempts === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates from DB' },
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('templates-error-banner')).toBeDefined()
      expect(screen.getByText('Failed to fetch templates from DB')).toBeDefined()
    })

    // Click retry
    const retryBtn = screen.getByTestId('retry-templates-btn')
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.queryByTestId('templates-error-banner')).toBeNull()
      expect(screen.getByText('Terms of Service Update 2026 (terms_update)')).toBeDefined()
    })
  })

  it('6. Template selection renders template metadata details', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    const select = screen.getByTestId('template-select')
    fireEvent.change(select, { target: { value: 'tpl-active-1' } })

    await waitFor(() => {
      expect(screen.getByTestId('selected-template-details')).toBeDefined()
      expect(screen.getByText('terms_update')).toBeDefined()
      expect(screen.getByText('Important update to our Terms of Service')).toBeDefined()
    })
  })

  it('7. Preview rendering displays rendered subject and body HTML', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })

    await waitFor(() => {
      expect(screen.getByTestId('preview-subject').textContent).toBe(
        'Important update to our Terms of Service'
      )
      expect(screen.getByTestId('preview-body-container').innerHTML).toContain('<h1>Terms Update</h1>')
      expect(screen.getByTestId('preview-plain-text').textContent).toBe(
        'Please review our new terms.'
      )
    })
  })

  it('8. Default campaign name is automatically generated when template is selected', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })

    await waitFor(() => {
      const nameInput = screen.getByTestId('campaign-name-input') as HTMLInputElement
      expect(nameInput.value).toBe('User Agreement - Terms of Service Update 2026')
    })
  })

  it('9. Campaign name is editable by administrator', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })

    const nameInput = screen.getByTestId('campaign-name-input') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Custom Fall 2026 Agreement' } })

    expect(nameInput.value).toBe('Custom Fall 2026 Agreement')
  })

  it('10. Send button is disabled when no template is selected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('send-agreement-btn')).toBeDefined()
    })

    const sendBtn = screen.getByTestId('send-agreement-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
  })

  it('11. Confirmation dialog opens with summary of template and campaign name', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })

    const sendBtn = screen.getByTestId('send-agreement-btn')
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByTestId('confirm-broadcast-modal')).toBeDefined()
      expect(screen.getByTestId('modal-template-name').textContent).toBe(
        'Terms of Service Update 2026'
      )
      expect(screen.getByTestId('modal-campaign-name').textContent).toBe(
        'User Agreement - Terms of Service Update 2026'
      )
    })
  })

  it('12. Cancel confirmation closes modal without making API request', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('cancel-modal-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('cancel-modal-btn'))

    expect(screen.queryByTestId('confirm-broadcast-modal')).toBeNull()

    const broadcastCalls = mockFetch.mock.calls.filter(([url]) =>
      url.includes('/api/v1/agreements/broadcast')
    )
    expect(broadcastCalls.length).toBe(0)
  })

  it('13. Confirmation calls createBroadcast with correct templateId and name', async () => {
    const createdCampaign: Campaign = {
      id: 'camp-created-1',
      name: 'Custom Fall 2026 Agreement',
      templateId: 'tpl-active-1',
      campaignType: 'user_agreement',
      status: 'scheduled',
      scheduledAt: '2026-09-16T12:00:00Z',
      createdAt: '2026-09-16T12:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(JSON.stringify(createdCampaign), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.change(screen.getByTestId('campaign-name-input'), {
      target: { value: 'Custom Fall 2026 Agreement' },
    })

    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      const broadcastCalls = mockFetch.mock.calls.filter(([url]) =>
        url.includes('/api/v1/agreements/broadcast')
      )
      expect(broadcastCalls.length).toBe(1)
      const [, opts] = broadcastCalls[0]
      expect(opts.method).toBe('POST')
      expect(opts.body).toBe(
        JSON.stringify({ templateId: 'tpl-active-1', name: 'Custom Fall 2026 Agreement' })
      )
    })
  })

  it('14. Submission shows loading state while request is in progress', async () => {
    let resolveBroadcast: (value: Response) => void
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveBroadcast = resolve
    })

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return pendingPromise
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    expect(screen.getByText('Sending...')).toBeDefined()
    const confirmBtn = screen.getByTestId('confirm-send-btn') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    // Complete request
    await act(async () => {
      resolveBroadcast!(
        new Response(
          JSON.stringify({
            id: 'c-1',
            name: 'User Agreement - Terms',
            templateId: 'tpl-active-1',
            status: 'scheduled',
            createdAt: '2026-09-16T12:00:00Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      )
    })
  })

  it('15. Successful campaign creation displays status card and dismisses modal', async () => {
    const createdCampaign: Campaign = {
      id: 'camp-12345',
      name: 'User Agreement - Terms of Service Update 2026',
      templateId: 'tpl-active-1',
      campaignType: 'user_agreement',
      status: 'scheduled',
      scheduledAt: '2026-09-16T12:00:00Z',
      createdAt: '2026-09-16T12:00:00Z',
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(JSON.stringify(createdCampaign), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-broadcast-modal')).toBeNull()
      expect(screen.getByTestId('agreement-status-card')).toBeDefined()
      expect(screen.getByTestId('status-campaign-name').textContent).toBe(
        'User Agreement - Terms of Service Update 2026'
      )
      expect(screen.getByTestId('status-campaign-id').textContent).toBe('camp-12345')
      expect(screen.getByTestId('campaign-status-badge').textContent).toBe('scheduled')
    })
  })

  it('16. Campaign status polling updates status automatically', async () => {
    vi.useFakeTimers()

    let pollCount = 0
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-polling-1',
              name: 'User Agreement - Terms',
              templateId: 'tpl-active-1',
              status: 'scheduled',
              createdAt: '2026-09-16T12:00:00Z',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-polling-1')) {
        pollCount++
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-polling-1',
              name: 'User Agreement - Terms',
              templateId: 'tpl-active-1',
              status: pollCount >= 2 ? 'completed' : 'sending',
              createdAt: '2026-09-16T12:00:00Z',
              completedAt: pollCount >= 2 ? '2026-09-16T12:01:00Z' : undefined,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<AgreementPage />)

    // Wait for templates to load
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('campaign-status-badge').textContent).toBe('scheduled')

    // Advance timer to trigger first poll (sending)
    await act(async () => {
      vi.advanceTimersByTime(2600)
      await Promise.resolve()
    })

    expect(screen.getByTestId('campaign-status-badge').textContent).toBe('sending')

    // Advance timer to trigger second poll (completed)
    await act(async () => {
      vi.advanceTimersByTime(2600)
      await Promise.resolve()
    })

    expect(screen.getByTestId('campaign-status-badge').textContent).toBe('completed')
    expect(screen.getByTestId('status-completed-banner')).toBeDefined()

    vi.useRealTimers()
  })

  it('17. Polling stops when campaign reaches a terminal status (e.g. completed)', async () => {
    vi.useFakeTimers()

    let getCampaignCalls = 0
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-terminal-test',
              name: 'User Agreement - Terms',
              status: 'scheduled',
              createdAt: '2026-09-16T12:00:00Z',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-terminal-test')) {
        getCampaignCalls++
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-terminal-test',
              name: 'User Agreement - Terms',
              status: 'completed',
              completedAt: '2026-09-16T12:01:00Z',
              createdAt: '2026-09-16T12:00:00Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    // Advance timer 1 tick (returns completed)
    await act(async () => {
      vi.advanceTimersByTime(2600)
      await Promise.resolve()
    })

    expect(getCampaignCalls).toBe(1)

    // Advance timer 3 more ticks, no further calls should occur
    await act(async () => {
      vi.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(getCampaignCalls).toBe(1)

    vi.useRealTimers()
  })

  it('18. Cleanup when component unmounts cancels pending poll timers and fetch requests', async () => {
    vi.useFakeTimers()

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-unmount-test',
              name: 'User Agreement - Terms',
              status: 'running',
              createdAt: '2026-09-16T12:00:00Z',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-unmount-test')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-unmount-test',
              name: 'User Agreement - Terms',
              status: 'running',
              createdAt: '2026-09-16T12:00:00Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    const { unmount } = render(<AgreementPage />)

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await act(async () => {
      await Promise.resolve()
    })

    // Unmount while polling is scheduled
    unmount()

    const callsBeforeAdvance = mockFetch.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(mockFetch.mock.calls.length).toBe(callsBeforeAdvance)

    vi.useRealTimers()
  })

  it('19. 409 conflict handling displays descriptive message about active broadcast', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'CONFLICT',
                message: 'a user agreement broadcast is already in progress',
              },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('modal-submit-error').textContent).toContain(
        'Another User Agreement broadcast is already in progress.'
      )
    })
  })

  it('20. 400 and 404 errors inform user that template is no longer active', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'NOT_FOUND',
                message: 'referenced email template not found',
              },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('modal-submit-error').textContent).toContain(
        'The selected template is no longer available or active. Please select another template.'
      )
    })
  })

  it('21. 401 and 403 errors display authentication/authorization messages', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'FORBIDDEN',
                message: 'insufficient permissions',
              },
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('modal-submit-error').textContent).toContain(
        'Forbidden (403): You do not have permission to broadcast agreements.'
      )
    })
  })

  it('22. Network/server error displays user-friendly message', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('modal-submit-error').textContent).toContain('Failed to fetch')
    })
  })

  it('23. Completed state displays completed badge, completion time, and allows new broadcast reset', async () => {
    const completedCampaign: Campaign = {
      id: 'camp-comp-1',
      name: 'User Agreement - Terms',
      templateId: 'tpl-active-1',
      campaignType: 'user_agreement',
      status: 'completed',
      createdAt: '2026-09-16T12:00:00Z',
      completedAt: '2026-09-16T12:05:00Z',
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(JSON.stringify(completedCampaign), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('campaign-status-badge').textContent).toBe('completed')
      expect(screen.getByTestId('status-completed-banner')).toBeDefined()
      expect(screen.getByTestId('new-broadcast-btn')).toBeDefined()
    })

    // Click start another broadcast
    fireEvent.click(screen.getByTestId('new-broadcast-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('agreement-status-card')).toBeNull()
      expect(screen.getByTestId('template-select')).toBeDefined()
    })
  })

  it('24. Failed state displays failed banner and status badge', async () => {
    const failedCampaign: Campaign = {
      id: 'camp-fail-1',
      name: 'User Agreement - Terms',
      templateId: 'tpl-active-1',
      campaignType: 'user_agreement',
      status: 'failed',
      createdAt: '2026-09-16T12:00:00Z',
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(JSON.stringify(failedCampaign), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('campaign-status-badge').textContent).toBe('failed')
      expect(screen.getByTestId('status-failed-banner')).toBeDefined()
    })
  })

  it('25. Partially failed state displays partially_failed banner and status badge', async () => {
    const partFailedCampaign: Campaign = {
      id: 'camp-part-1',
      name: 'User Agreement - Terms',
      templateId: 'tpl-active-1',
      campaignType: 'user_agreement',
      status: 'partially_failed',
      createdAt: '2026-09-16T12:00:00Z',
    }

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/agreements/broadcast')) {
        return Promise.resolve(
          new Response(JSON.stringify(partFailedCampaign), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPreviewResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    render(<AgreementPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-select')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('template-select'), { target: { value: 'tpl-active-1' } })
    fireEvent.click(screen.getByTestId('send-agreement-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-send-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('confirm-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('campaign-status-badge').textContent).toBe('partially failed')
      expect(screen.getByTestId('status-partially-failed-banner')).toBeDefined()
    })
  })
})
