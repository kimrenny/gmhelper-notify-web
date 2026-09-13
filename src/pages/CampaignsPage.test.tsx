// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CampaignsPage from './CampaignsPage'
import * as useAuthModule from '../hooks/useAuth'
import type { AuthContextValue } from '../types/auth'

describe('CampaignsPage component', () => {
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

  const mockTemplates = [
    {
      id: 'tpl-101',
      templateKey: 'welcome_email',
      name: 'Welcome Email Template',
      subject: 'Welcome to our platform!',
      htmlBody: '<p>Hello user!</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Displays loading state and then renders successful campaign list', async () => {
    const mockCampaigns = [
      {
        id: 'camp-1',
        name: 'Spring Welcome Campaign',
        templateId: 'welcome-tpl',
        campaignType: 'broadcast',
        status: 'completed',
        scheduledAt: '2026-03-01T10:00:00Z',
        createdAt: '2026-02-28T09:00:00Z',
      },
      {
        id: 'camp-2',
        name: 'Weekly Newsletter',
        templateId: 'news-tpl',
        campaignType: 'scheduled',
        status: 'scheduled',
        scheduledAt: '2026-09-20T12:00:00Z',
        createdAt: '2026-09-14T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockCampaigns), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    // Verify initial loading state
    expect(screen.getByText(/Loading campaigns.../i)).toBeDefined()

    // Wait for campaigns to load
    await waitFor(() => {
      expect(screen.getByText('Spring Welcome Campaign')).toBeDefined()
      expect(screen.getByText('Weekly Newsletter')).toBeDefined()
    })

    expect(screen.queryByText(/Loading campaigns.../i)).toBeNull()
    expect(screen.getByTestId('status-badge-camp-1').textContent).toBe('completed')
    expect(screen.getByTestId('status-badge-camp-2').textContent).toBe('scheduled')
  })

  it('2. Authenticated API request uses the current access token from useAuth', async () => {
    const customToken = 'my-secret-human-access-token-999'
    setAuthMock({ accessToken: customToken })

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const campaignCall = mockFetch.mock.calls.find((call) =>
      call[0].includes('/api/v1/campaigns')
    )
    expect(campaignCall).toBeDefined()
    const headers = new Headers(campaignCall![1].headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${customToken}`)
  })

  it('3. Displays empty state when campaign list is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(
        screen.getByText(/No campaigns found\. Click "New Campaign" to create one\./i)
      ).toBeDefined()
    })

    expect(screen.queryByRole('table')).toBeNull()
  })

  it('4. Handles 401 Unauthorized API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Session expired or token is invalid',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('error-title').textContent).toBe('Unauthorized (401)')
      expect(screen.getByTestId('error-message').textContent).toContain('You do not have access to campaigns')
    })
  })

  it('5. Handles 403 Forbidden API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'User does not have required permissions',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('error-title').textContent).toBe('Forbidden (403)')
      expect(screen.getByTestId('error-message').textContent).toContain('You do not have permission to access campaigns')
    })
  })

  it('6. Handles generic API error and retries on button click', async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/campaigns')) {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Database connection failed',
                },
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'camp-recovered',
                name: 'Recovered Campaign',
                status: 'draft',
                createdAt: '2026-09-14T00:00:00Z',
              },
            ]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText(/Database connection failed/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined()
    })

    // Click retry
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Retry/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Recovered Campaign')).toBeDefined()
    })
  })

  it('7. Submits New Campaign form, calls createCampaign with expected payload, and refreshes list', async () => {
    let campaignsState: Array<{ id: string; name: string; templateId: string; status: string; createdAt: string }> = []

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        const payload = JSON.parse(options.body as string)
        const newCamp = {
          id: 'camp-created-1',
          name: payload.name,
          templateId: payload.templateId,
          campaignType: payload.campaignType || 'broadcast',
          status: 'draft',
          createdAt: '2026-09-14T12:00:00Z',
        }
        campaignsState = [newCamp, ...campaignsState]
        return Promise.resolve(
          new Response(JSON.stringify(newCamp), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(
          new Response(JSON.stringify(campaignsState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    // Open composer
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))
    expect(screen.getByText('Create Campaign')).toBeDefined()

    // Fill form
    const nameInput = screen.getByPlaceholderText('Enter campaign name')
    fireEvent.change(nameInput, { target: { value: 'Launch Announcement' } })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'tpl-101' } })

    // Verify preview populated
    expect(screen.getByText('Subject: Welcome to our platform!')).toBeDefined()

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Send/i })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    // Verify POST was called with expected payload and Bearer token
    const postCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/campaigns') && call[1]?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const requestBody = JSON.parse(postCall![1].body as string)
    expect(requestBody).toEqual({
      name: 'Launch Announcement',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
    })
    const headers = new Headers(postCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer sample-access-token-xyz')

    // Verify form closed and new campaign rendered in list
    await waitFor(() => {
      expect(screen.queryByText('Create Campaign')).toBeNull()
      expect(screen.getByText('Launch Announcement')).toBeDefined()
    })
  })

  it('8. Shows validation errors on empty form submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))

    // Submit with empty inputs
    const submitBtn = screen.getByRole('button', { name: /Send/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText('Campaign name is required')).toBeDefined()
    expect(screen.getByText('Please select an email template')).toBeDefined()

    // Ensure POST was never sent
    const postCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(postCall).toBeUndefined()
  })

  it('9. Handles 400 Bad Request error from backend during campaign creation', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'BAD_REQUEST',
                message: 'Invalid template identifier',
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))

    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Test Campaign' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'tpl-101' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Send/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Validation error: Invalid template identifier')
    })
    expect(screen.getByText('Create Campaign')).toBeDefined()
  })

  it('10. Handles 401 Unauthorized during campaign creation', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'UNAUTHORIZED',
                message: 'Token expired',
              },
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Promo' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'tpl-101' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Send/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Unauthorized (401)')
    })
  })

  it('11. Handles 403 Forbidden during campaign creation', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
              },
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Promo' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'tpl-101' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Send/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Forbidden (403)')
    })
  })

  it('12. Handles generic server/network failure during campaign creation', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        return Promise.reject(new TypeError('Failed to fetch'))
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Network Test' },
    })
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'tpl-101' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Send/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Failed to fetch')
    })
  })
})
