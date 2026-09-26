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
      templateType: 'campaign',
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

  it('13. Opening an existing campaign loads campaign details by ID and populates form', async () => {
    const mockCampaign = {
      id: 'camp-edit-1',
      name: 'Spring Promo 2026',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-edit-1')) {
        return Promise.resolve(new Response(JSON.stringify(mockCampaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Spring Promo 2026')).toBeDefined()
    })

    const editBtn = screen.getByTestId('edit-campaign-btn-camp-edit-1')
    await act(async () => {
      fireEvent.click(editBtn)
    })

    // Verify GET /api/v1/campaigns/camp-edit-1 was made with Bearer token
    const getDetailsCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/campaigns/camp-edit-1') && (!call[1]?.method || call[1]?.method === 'GET')
    )
    expect(getDetailsCall).toBeDefined()
    const headers = new Headers(getDetailsCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer sample-access-token-xyz')

    // Verify composer title and populated values
    expect(screen.getByText('Edit Campaign')).toBeDefined()
    const nameInput = screen.getByPlaceholderText('Enter campaign name') as HTMLInputElement
    expect(nameInput.value).toBe('Spring Promo 2026')
    const templateSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(templateSelect.value).toBe('tpl-101')
    expect(screen.getByText('Subject: Welcome to our platform!')).toBeDefined()
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDefined()
  })

  it('14. Submitting updated campaign sends PUT to /api/v1/campaigns/{id}, refreshes list, and closes composer', async () => {
    let currentCampaign = {
      id: 'camp-update-1',
      name: 'Old Campaign Name',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-update-1') && options?.method === 'PUT') {
        const payload = JSON.parse(options.body as string)
        currentCampaign = { ...currentCampaign, ...payload }
        return Promise.resolve(new Response(JSON.stringify(currentCampaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-update-1')) {
        return Promise.resolve(new Response(JSON.stringify(currentCampaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([currentCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Old Campaign Name')).toBeDefined()
    })

    // Open edit composer
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-update-1'))
    })

    expect(screen.getByText('Edit Campaign')).toBeDefined()

    // Modify name
    const nameInput = screen.getByPlaceholderText('Enter campaign name')
    fireEvent.change(nameInput, { target: { value: 'Brand New Campaign Name' } })

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    // Verify PUT request
    const putCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/campaigns/camp-update-1') && call[1]?.method === 'PUT'
    )
    expect(putCall).toBeDefined()
    const requestBody = JSON.parse(putCall![1].body as string)
    expect(requestBody).toEqual({
      name: 'Brand New Campaign Name',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
    })
    const headers = new Headers(putCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer sample-access-token-xyz')

    // Verify composer closed and list refreshed with new name
    await waitFor(() => {
      expect(screen.queryByText('Edit Campaign')).toBeNull()
      expect(screen.getByText('Brand New Campaign Name')).toBeDefined()
    })
  })

  it('15. Prevents duplicate submissions while saving changes in edit mode', async () => {
    let putCallCount = 0
    let resolvePut: (res: Response) => void
    const putPromise = new Promise<Response>((resolve) => {
      resolvePut = resolve
    })

    const initialCampaign = {
      id: 'camp-dup-1',
      name: 'Duplicate Test Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-dup-1') && options?.method === 'PUT') {
        putCallCount++
        return putPromise
      }
      if (url.includes('/api/v1/campaigns/camp-dup-1')) {
        return Promise.resolve(new Response(JSON.stringify(initialCampaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([initialCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Duplicate Test Campaign')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-dup-1'))
    })

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i })

    // Click submit first time
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(putCallCount).toBe(1)
    expect(screen.getByRole('button', { name: /Saving\.\.\./i })).toBeDefined()
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true)

    // Click submit second time while in flight
    await act(async () => {
      fireEvent.click(saveBtn)
    })
    expect(putCallCount).toBe(1)

    // Resolve PUT request
    await act(async () => {
      resolvePut!(new Response(JSON.stringify(initialCampaign), { status: 200 }))
    })

    await waitFor(() => {
      expect(screen.queryByText('Edit Campaign')).toBeNull()
    })
  })

  it('16. Handles 400 Bad Request error during campaign update', async () => {
    const campaign = {
      id: 'camp-bad-1',
      name: 'Bad Input Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-bad-1') && options?.method === 'PUT') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'BAD_REQUEST',
                message: 'Invalid campaign status transition',
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-bad-1')) {
        return Promise.resolve(new Response(JSON.stringify(campaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([campaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Bad Input Campaign')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-bad-1'))
    })

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain(
        'Validation error: Invalid campaign status transition'
      )
    })
  })

  it('17. Handles 401 Unauthorized and 403 Forbidden errors during campaign update', async () => {
    const campaign = {
      id: 'camp-auth-err',
      name: 'Auth Test Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    let putStatus = 401

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-auth-err') && options?.method === 'PUT') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: putStatus === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
                message: putStatus === 401 ? 'Session expired' : 'Insufficient permissions',
              },
            }),
            {
              status: putStatus,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-auth-err')) {
        return Promise.resolve(new Response(JSON.stringify(campaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([campaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Auth Test Campaign')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-auth-err'))
    })

    // Test 401
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Unauthorized (401)')
    })

    // Test 403
    putStatus = 403
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Forbidden (403)')
    })
  })

  it('18. Handles failure when loading campaign details by ID', async () => {
    const campaign = {
      id: 'camp-fail-get',
      name: 'Get Failure Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-fail-get')) {
        return Promise.reject(new TypeError('Failed to load campaign'))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([campaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Get Failure Campaign')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-fail-get'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-error').textContent).toContain('Failed to load campaign')
    })
  })

  it('19. Shows delete action, displays confirmation card with campaign name, and cancels cleanly without calling API', async () => {
    const mockCampaign = {
      id: 'camp-to-cancel',
      name: 'Summer Promo Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Summer Promo Campaign')).toBeDefined()
    })

    // Verify Delete button exists
    const deleteBtn = screen.getByTestId('delete-campaign-btn-camp-to-cancel')
    expect(deleteBtn).toBeDefined()

    // Click Delete -> shows confirmation
    await act(async () => {
      fireEvent.click(deleteBtn)
    })

    expect(screen.getByTestId('delete-confirmation-card')).toBeDefined()
    expect(screen.getByText(/Are you sure you want to delete campaign/i)).toBeDefined()
    expect(screen.getAllByText('Summer Promo Campaign').length).toBeGreaterThanOrEqual(2)

    // Click Cancel -> hides confirmation, no DELETE request made
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    })

    expect(screen.queryByTestId('delete-confirmation-card')).toBeNull()

    const deleteCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'DELETE')
    expect(deleteCall).toBeUndefined()
  })

  it('20. Successfully deletes campaign, calls DELETE /api/v1/campaigns/{id} with auth token, and removes campaign from table', async () => {
    const customToken = 'delete-auth-token-123'
    setAuthMock({ accessToken: customToken })

    const mockCampaigns = [
      {
        id: 'camp-del-target',
        name: 'Target For Deletion',
        templateId: 'tpl-101',
        campaignType: 'broadcast',
        status: 'draft',
        createdAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'camp-keep',
        name: 'Campaign To Keep',
        templateId: 'tpl-101',
        campaignType: 'broadcast',
        status: 'draft',
        createdAt: '2026-09-01T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (init?.method === 'DELETE' && url.includes('/api/v1/campaigns/camp-del-target')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify(mockCampaigns), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Target For Deletion')).toBeDefined()
      expect(screen.getByText('Campaign To Keep')).toBeDefined()
    })

    // Click delete on target campaign
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-campaign-btn-camp-del-target'))
    })

    // Click confirm delete
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.queryByText('Target For Deletion')).toBeNull()
      expect(screen.getByText('Campaign To Keep')).toBeDefined()
    })

    // Verify DELETE fetch call
    const deleteCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/campaigns/camp-del-target') && call[1]?.method === 'DELETE'
    )
    expect(deleteCall).toBeDefined()
    const headers = new Headers(deleteCall![1].headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${customToken}`)
  })

  it('21. Closes composer safely if the currently edited campaign is deleted', async () => {
    const mockCampaign = {
      id: 'camp-editing-deleted',
      name: 'Editing Deletion Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.includes('/api/v1/campaigns/camp-editing-deleted')) {
        return Promise.resolve(new Response(JSON.stringify(mockCampaign), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Editing Deletion Campaign')).toBeDefined()
    })

    // Open edit composer
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-campaign-btn-camp-editing-deleted'))
    })

    await waitFor(() => {
      expect(screen.getByText('Edit Campaign')).toBeDefined()
    })

    // Now delete this same campaign
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-campaign-btn-camp-editing-deleted'))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      // Composer must be closed
      expect(screen.queryByText('Edit Campaign')).toBeNull()
      expect(screen.queryByText('Editing Deletion Campaign')).toBeNull()
    })
  })

  it('22. Handles 401, 403, 404, and generic errors during delete', async () => {
    const mockCampaign = {
      id: 'camp-err-test',
      name: 'Error Test Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-01T00:00:00Z',
    }

    let deleteStatus = 401
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (init?.method === 'DELETE') {
        if (deleteStatus === 401) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }), {
              status: 401,
            })
          )
        }
        if (deleteStatus === 403) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: 'Forbidden', code: 'FORBIDDEN' } }), {
              status: 403,
            })
          )
        }
        if (deleteStatus === 404) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: 'Not found', code: 'NOT_FOUND' } }), {
              status: 404,
            })
          )
        }
        return Promise.reject(new TypeError('Network failure'))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Error Test Campaign')).toBeDefined()
    })

    // 1. Test 401
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-campaign-btn-camp-err-test'))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('delete-error').textContent).toContain('Unauthorized (401)')
    })

    // 2. Test 403
    deleteStatus = 403
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('delete-error').textContent).toContain('Forbidden (403)')
    })

    // 3. Test Network error
    deleteStatus = 500
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('delete-error').textContent).toContain('Network failure')
    })

    // 4. Test 404 (removes from list and displays not found message)
    deleteStatus = 404
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('delete-error').textContent).toContain('Campaign not found')
    })
  })

  it('23. Draft campaign displays Schedule button, opens schedule modal, and validates empty or past date/time', async () => {
    const mockDraftCampaign = {
      id: 'camp-draft-1',
      name: 'Autumn Special',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-14T10:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockDraftCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Autumn Special')).toBeDefined()
    })

    // Verify Schedule button is visible for draft campaign
    const scheduleBtn = screen.getByTestId('schedule-campaign-btn-camp-draft-1')
    expect(scheduleBtn).toBeDefined()
    expect(scheduleBtn.textContent).toBe('Schedule')

    // Open schedule modal
    await act(async () => {
      fireEvent.click(scheduleBtn)
    })

    expect(screen.getByTestId('schedule-modal-card')).toBeDefined()
    expect(screen.getByText(/Select a future date and time to schedule campaign/i)).toBeDefined()

    // 1. Submit with empty date -> validation error
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })

    expect(screen.getByTestId('schedule-error').textContent).toBe('Scheduled date and time is required.')

    // 2. Submit with past date -> validation error
    const input = screen.getByTestId('schedule-datetime-input')
    fireEvent.change(input, { target: { value: '2020-01-01T10:00' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })

    expect(screen.getByTestId('schedule-error').textContent).toBe('Scheduled date and time must be in the future.')

    // 3. Cancel button closes modal
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-schedule-modal-btn'))
    })

    expect(screen.queryByTestId('schedule-modal-card')).toBeNull()
  })

  it('24. Successfully schedules a draft campaign: converts local time to UTC ISO-8601 and updates status to scheduled', async () => {
    const mockDraftCampaign = {
      id: 'camp-draft-2',
      name: 'Black Friday 2026',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-14T10:00:00Z',
    }

    let schedulePayload: { scheduledAt?: string } | null = null

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-draft-2/schedule') && options?.method === 'POST') {
        schedulePayload = JSON.parse(options.body as string)
        const scheduledResponse = {
          ...mockDraftCampaign,
          status: 'scheduled',
          scheduledAt: schedulePayload?.scheduledAt,
        }
        return Promise.resolve(new Response(JSON.stringify(scheduledResponse), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockDraftCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Black Friday 2026')).toBeDefined()
    })

    // Open schedule modal
    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-campaign-btn-camp-draft-2'))
    })

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const localDateTimeStr = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`

    const input = screen.getByTestId('schedule-datetime-input')
    fireEvent.change(input, { target: { value: localDateTimeStr } })

    // Click confirm schedule
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })

    // Verify API called with ISO UTC timestamp
    expect(mockFetch).toHaveBeenCalled()
    expect(schedulePayload).not.toBeNull()
    const expectedUtcIso = new Date(localDateTimeStr).toISOString()
    expect((schedulePayload as any)?.scheduledAt).toBe(expectedUtcIso)

    // Modal is closed and status badge updated to scheduled
    await waitFor(() => {
      expect(screen.queryByTestId('schedule-modal-card')).toBeNull()
      expect(screen.getByTestId('status-badge-camp-draft-2').textContent).toBe('scheduled')
      expect(screen.getByTestId('scheduled-time-camp-draft-2')).toBeDefined()
    })
  })

  it('25. Scheduled campaign displays scheduled time, shows Cancel button, and successfully cancels campaign', async () => {
    const mockScheduledCampaign = {
      id: 'camp-sched-3',
      name: 'Holiday Greetings',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'scheduled',
      scheduledAt: '2026-12-25T00:00:00Z',
      createdAt: '2026-09-14T10:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-sched-3/cancel') && options?.method === 'POST') {
        const cancelledResponse = {
          ...mockScheduledCampaign,
          status: 'cancelled',
        }
        return Promise.resolve(new Response(JSON.stringify(cancelledResponse), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockScheduledCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Holiday Greetings')).toBeDefined()
      expect(screen.getByTestId('scheduled-time-camp-sched-3')).toBeDefined()
    })

    // Verify scheduled campaign has Cancel button and not Schedule or Edit button
    expect(screen.getByTestId('cancel-campaign-btn-camp-sched-3')).toBeDefined()
    expect(screen.queryByTestId('schedule-campaign-btn-camp-sched-3')).toBeNull()
    expect(screen.queryByTestId('edit-campaign-btn-camp-sched-3')).toBeNull()

    // Click Cancel button
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-campaign-btn-camp-sched-3'))
    })

    expect(screen.getByTestId('cancel-confirmation-card')).toBeDefined()

    // Confirm cancel
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'))
    })

    // Verify campaign status updated to cancelled
    await waitFor(() => {
      expect(screen.queryByTestId('cancel-confirmation-card')).toBeNull()
      expect(screen.getByTestId('status-badge-camp-sched-3').textContent).toBe('cancelled')
    })
  })

  it('26. Schedule modal displays API errors properly (400, 401, 403, 500, network)', async () => {
    const mockCampaign = {
      id: 'camp-err-sched',
      name: 'Error Schedule Test',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      createdAt: '2026-09-14T10:00:00Z',
    }

    let responseStatus = 400
    let responseBody = { error: 'BAD_REQUEST', message: 'Campaign is already running or completed' }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-err-sched/schedule') && options?.method === 'POST') {
        if (responseStatus === 500) {
          return Promise.reject(new TypeError('Network schedule failure'))
        }
        return Promise.resolve(
          new Response(JSON.stringify(responseBody), {
            status: responseStatus,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Error Schedule Test')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-campaign-btn-camp-err-sched'))
    })

    const futureDate = new Date(Date.now() + 86400000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const localDateTimeStr = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}T12:00`
    fireEvent.change(screen.getByTestId('schedule-datetime-input'), { target: { value: localDateTimeStr } })

    // 1. Test 400
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('schedule-error').textContent).toContain('Campaign is already running or completed')
    })

    // 2. Test 401
    responseStatus = 401
    responseBody = { error: 'UNAUTHORIZED', message: 'Token expired' }
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('schedule-error').textContent).toContain('Unauthorized (401)')
    })

    // 3. Test 403
    responseStatus = 403
    responseBody = { error: 'FORBIDDEN', message: 'Access denied' }
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('schedule-error').textContent).toContain('Forbidden (403)')
    })

    // 4. Test Network Error
    responseStatus = 500
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-schedule-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('schedule-error').textContent).toContain('Network schedule failure')
    })
  })

  it('27. Cancel modal displays API errors properly (400, 401, 403, 500, network)', async () => {
    const mockCampaign = {
      id: 'camp-err-cancel',
      name: 'Error Cancel Test',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'scheduled',
      scheduledAt: '2026-12-01T10:00:00Z',
      createdAt: '2026-09-14T10:00:00Z',
    }

    let responseStatus = 400
    let responseBody = { error: 'BAD_REQUEST', message: 'Campaign is already running and cannot be cancelled' }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/campaigns/camp-err-cancel/cancel') && options?.method === 'POST') {
        if (responseStatus === 500) {
          return Promise.reject(new TypeError('Network cancel failure'))
        }
        return Promise.resolve(
          new Response(JSON.stringify(responseBody), {
            status: responseStatus,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns')) {
        return Promise.resolve(new Response(JSON.stringify([mockCampaign]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Error Cancel Test')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-campaign-btn-camp-err-cancel'))
    })

    // 1. Test 400
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('cancel-error').textContent).toContain('Campaign is already running and cannot be cancelled')
    })

    // 2. Test 401
    responseStatus = 401
    responseBody = { error: 'UNAUTHORIZED', message: 'Token expired' }
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('cancel-error').textContent).toContain('Unauthorized (401)')
    })

    // 3. Test 403
    responseStatus = 403
    responseBody = { error: 'FORBIDDEN', message: 'Access denied' }
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('cancel-error').textContent).toContain('Forbidden (403)')
    })

    // 4. Test Network Error
    responseStatus = 500
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('cancel-error').textContent).toContain('Network cancel failure')
    })
  })

  it('28. Only displays campaign templates in template selector and excludes non-campaign templates', async () => {
    const mixedTemplates = [
      {
        id: 'tpl-camp-valid',
        templateKey: 'camp_valid',
        name: 'Valid Campaign Template',
        templateType: 'campaign',
        subject: 'Camp Subject',
        htmlBody: '<p>Camp</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-direct-excl',
        templateKey: 'direct_excl',
        name: 'Excluded Direct Template',
        templateType: 'direct',
        subject: 'Direct Subject',
        htmlBody: '<p>Direct</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-agree-excl',
        templateKey: 'agree_excl',
        name: 'Excluded Agreement Template',
        templateType: 'user_agreement',
        subject: 'Agree Subject',
        htmlBody: '<p>Agree</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-auto-excl',
        templateKey: 'auto_excl',
        name: 'Excluded Automation Template',
        templateType: 'automation',
        subject: 'Auto Subject',
        htmlBody: '<p>Auto</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mixedTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    // Open composer
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))

    const templateSelect = screen.getByTestId('campaign-template-select') as HTMLSelectElement
    expect(templateSelect.textContent).toContain('Valid Campaign Template')
    expect(templateSelect.textContent).not.toContain('Excluded Direct Template')
    expect(templateSelect.textContent).not.toContain('Excluded Agreement Template')
    expect(templateSelect.textContent).not.toContain('Excluded Automation Template')
  })

  it('29. Submitting create campaign form sends audienceFilter in request payload when customized', async () => {
    let capturedCreatePayload: any = null

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        capturedCreatePayload = JSON.parse(options.body)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-new-1',
              name: capturedCreatePayload.name,
              templateId: capturedCreatePayload.templateId,
              campaignType: capturedCreatePayload.campaignType,
              status: 'draft',
              audienceFilter: capturedCreatePayload.audienceFilter,
              createdAt: '2026-09-25T00:00:00Z',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    // Open composer
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Targeted Spring Promo' },
    })
    fireEvent.change(screen.getByTestId('campaign-template-select'), {
      target: { value: 'tpl-101' },
    })

    // Fill audience filters
    fireEvent.change(screen.getByPlaceholderText('All roles'), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByPlaceholderText('Any date'), {
      target: { value: 'last_30_days' },
    })
    fireEvent.change(screen.getByPlaceholderText('All'), {
      target: { value: 'tr' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(capturedCreatePayload).not.toBeNull()
    })

    expect(capturedCreatePayload.name).toBe('Targeted Spring Promo')
    expect(capturedCreatePayload.templateId).toBe('tpl-101')
    expect(capturedCreatePayload.audienceFilter).toEqual({
      role: 'admin',
      registrationDate: 'last_30_days',
      language: 'tr',
    })
  })

  it('30. Submitting create campaign form does not send audienceFilter when filters remain default', async () => {
    let capturedCreatePayload: any = null

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns') && options?.method === 'POST') {
        capturedCreatePayload = JSON.parse(options.body)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'camp-broadcast-1',
              name: capturedCreatePayload.name,
              templateId: capturedCreatePayload.templateId,
              campaignType: capturedCreatePayload.campaignType,
              status: 'draft',
              createdAt: '2026-09-25T00:00:00Z',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Campaign/i })).toBeDefined()
    })

    // Open composer
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/i }))

    // Fill only required fields
    fireEvent.change(screen.getByPlaceholderText('Enter campaign name'), {
      target: { value: 'Broadcast General' },
    })
    fireEvent.change(screen.getByTestId('campaign-template-select'), {
      target: { value: 'tpl-101' },
    })

    // Submit without touching filters
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }))

    await waitFor(() => {
      expect(capturedCreatePayload).not.toBeNull()
    })

    expect(capturedCreatePayload.name).toBe('Broadcast General')
    expect(capturedCreatePayload.audienceFilter).toBeUndefined()
  })

  it('31. Restores persisted audienceFilter when editing an existing campaign and submits updated filters', async () => {
    const existingCampaign = {
      id: 'camp-edit-1',
      name: 'Existing Targeted Campaign',
      templateId: 'tpl-101',
      campaignType: 'broadcast',
      status: 'draft',
      audienceFilter: {
        role: 'VIP',
        language: 'en',
        registrationDate: 'today',
        emailConfirmed: 'confirmed',
        accountStatus: 'active',
      },
      createdAt: '2026-09-20T00:00:00Z',
    }

    let capturedUpdatePayload: any = null

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/campaigns/camp-edit-1') && options?.method === 'PUT') {
        capturedUpdatePayload = JSON.parse(options.body)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...existingCampaign,
              ...capturedUpdatePayload,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
      if (url.includes('/api/v1/campaigns/camp-edit-1')) {
        return Promise.resolve(
          new Response(JSON.stringify(existingCampaign), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([existingCampaign]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<CampaignsPage />)

    await waitFor(() => {
      expect(screen.getByText('Existing Targeted Campaign')).toBeDefined()
    })

    // Click edit on the campaign
    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)

    // Verify audience filter input fields are populated with persisted values
    await waitFor(() => {
      const roleInput = screen.getByDisplayValue('VIP') as HTMLInputElement
      expect(roleInput).toBeDefined()
      const langInput = screen.getByDisplayValue('en') as HTMLInputElement
      expect(langInput).toBeDefined()
      const dateInput = screen.getByDisplayValue('today') as HTMLInputElement
      expect(dateInput).toBeDefined()
      const emailConfInput = screen.getByDisplayValue('confirmed') as HTMLInputElement
      expect(emailConfInput).toBeDefined()
    })

    // Modify the role filter to 'SuperAdmin'
    fireEvent.change(screen.getByDisplayValue('VIP'), {
      target: { value: 'SuperAdmin' },
    })

    // Submit update
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => {
      expect(capturedUpdatePayload).not.toBeNull()
    })

    expect(capturedUpdatePayload.audienceFilter.role).toBe('SuperAdmin')
    expect(capturedUpdatePayload.audienceFilter.language).toBe('en')
    expect(capturedUpdatePayload.audienceFilter.registrationDate).toBe('today')
    expect(capturedUpdatePayload.audienceFilter.emailConfirmed).toBe('confirmed')
  })
})
