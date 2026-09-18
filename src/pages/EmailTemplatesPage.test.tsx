// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EmailTemplatesPage from './EmailTemplatesPage'
import * as useAuthModule from '../hooks/useAuth'
import type { AuthContextValue } from '../types/auth'

describe('EmailTemplatesPage component', () => {
  const setAuthMock = (overrides: Partial<AuthContextValue> = {}) => {
    const defaultAuth: AuthContextValue = {
      user: {
        nickname: 'AdminUser',
        avatar: null,
        language: 'en',
      },
      accessToken: 'template-jwt-access-token-123',
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
      id: 'tpl-1',
      templateKey: 'welcome_email',
      name: 'Welcome Email',
      templateType: 'campaign',
      subject: 'Welcome to GMHelper!',
      htmlBody: '<p>Welcome!</p>',
      plainTextBody: 'Welcome!',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'tpl-2',
      templateKey: 'reminder_email',
      name: 'Reminder Email',
      templateType: 'direct',
      subject: 'Action Required',
      htmlBody: '<p>Reminder</p>',
      locale: 'en',
      status: 'draft',
      version: 1,
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Loads template list and sends Authorization Bearer token', async () => {
    const customToken = 'custom-auth-bearer-token'
    setAuthMock({ accessToken: customToken })

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    expect(screen.getByText(/Loading templates.../i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
      expect(screen.getByText('Reminder Email')).toBeDefined()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates')
    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${customToken}`)
  })

  it('2. Displays empty state when no templates exist', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText(/No email templates found\. Click "Add template" to create one\./i)).toBeDefined()
    })
  })

  it('3. Handles 401 Unauthorized error on template list load', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'missing authorization header',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('templates-error-message').textContent).toContain('Unauthorized (401)')
    })
  })

  it('4. Handles 403 Forbidden error on template list load', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'insufficient permissions',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('templates-error-message').textContent).toContain('Forbidden (403)')
    })
  })

  it('5. Creates template using authenticated API client', async () => {
    let templatesState: any[] = []

    const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const payload = JSON.parse(options.body as string)
        const created = {
          id: 'tpl-created-99',
          ...payload,
          createdAt: '2026-09-14T00:00:00Z',
          updatedAt: '2026-09-14T00:00:00Z',
        }
        templatesState = [created, ...templatesState]
        return Promise.resolve(
          new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(templatesState), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add template/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add template/i }))
    expect(screen.getByText('New Email Template')).toBeDefined()

    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome Email'), {
      target: { value: 'Verification Email' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. welcome_email'), {
      target: { value: 'verify_email' },
    })
    fireEvent.change(screen.getByTestId('template-type-select'), {
      target: { value: 'campaign' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
      target: { value: 'Please verify your email' },
    })
    fireEvent.change(screen.getByPlaceholderText('<p>Hello, welcome to our service...</p>'), {
      target: { value: '<p>Click to verify</p>' },
    })

    const submitBtn = screen.getByRole('button', { name: /Create Template/i })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    const postCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(postCall).toBeDefined()
    const headers = new Headers(postCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer template-jwt-access-token-123')

    await waitFor(() => {
      expect(screen.getByText('Verification Email')).toBeDefined()
    })
  })

  it('6. Updates template using authenticated API client', async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        const payload = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockTemplates[0],
              ...payload,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
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
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    fireEvent.click(editButtons[0])

    expect(screen.getByText(/Edit Template: Welcome Email/i)).toBeDefined()

    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome Email'), {
      target: { value: 'Welcome Email (Updated)' },
    })

    const saveBtn = screen.getByRole('button', { name: /Update Template/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    const putCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(putCall).toBeDefined()
    const headers = new Headers(putCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer template-jwt-access-token-123')

    await waitFor(() => {
      expect(screen.getByText('Welcome Email (Updated)')).toBeDefined()
    })
  })

  it('7. Deletes template using authenticated API client', async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i })
    fireEvent.click(deleteButtons[0])

    expect(screen.getByRole('heading', { name: /Confirm Delete/i })).toBeDefined()

    const confirmBtn = screen.getByRole('button', { name: /Confirm Delete/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    const deleteCall = mockFetch.mock.calls.find((call) => call[1]?.method === 'DELETE')
    expect(deleteCall).toBeDefined()
    const headers = new Headers(deleteCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer template-jwt-access-token-123')

    await waitFor(() => {
      expect(screen.queryByText('Confirm Delete')).toBeNull()
    })
  })

  it('8. Live preview is visible by default and renders live preview after debouncing', async () => {
    const mockPreviewResponse = {
      subject: 'Rendered Welcome to GMHelper!',
      htmlBody: '<div><strong>Rendered Welcome HTML</strong></div>',
      plainTextBody: 'Rendered Welcome Plaintext',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
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

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    fireEvent.click(editButtons[0])

    // Live preview card must be visible by default
    expect(screen.getByTestId('template-preview-card')).toBeDefined()
    expect(screen.getByTestId('toggle-preview-btn').textContent).toBe('Hide Preview')

    // Wait for debounced preview request and rendered content
    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe(mockPreviewResponse.subject)
      expect(screen.getByTestId('preview-rendered-html').innerHTML).toContain('<strong>Rendered Welcome HTML</strong>')
      expect(screen.getByTestId('preview-rendered-plaintext').textContent).toBe(mockPreviewResponse.plainTextBody)
    })

    const previewCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/preview') && call[1]?.method === 'POST'
    )
    expect(previewCall).toBeDefined()
    expect(previewCall![0]).toContain('/api/v1/templates/tpl-1/preview')

    const body = JSON.parse(previewCall![1].body as string)
    expect(body.subject).toBe(mockTemplates[0].subject)
    expect(body.htmlBody).toBe(mockTemplates[0].htmlBody)

    const headers = new Headers(previewCall![1].headers)
    expect(headers.get('Authorization')).toBe('Bearer template-jwt-access-token-123')
  })

  it('9. Toggles preview visibility with Hide Preview / Show Preview button', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              subject: 'Rendered Subject',
              htmlBody: '<p>Rendered HTML</p>',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
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
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0])

    // Initially visible
    expect(screen.getByTestId('template-preview-card')).toBeDefined()
    const toggleBtn = screen.getByTestId('toggle-preview-btn')
    expect(toggleBtn.textContent).toBe('Hide Preview')

    // Click Hide Preview
    fireEvent.click(toggleBtn)
    expect(screen.queryByTestId('template-preview-card')).toBeNull()
    expect(toggleBtn.textContent).toBe('Show Preview')

    // Click Show Preview
    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('template-preview-card')).toBeDefined()
    expect(toggleBtn.textContent).toBe('Hide Preview')

    // Close preview from inside the preview card
    fireEvent.click(screen.getByTestId('close-preview-btn'))
    expect(screen.queryByTestId('template-preview-card')).toBeNull()
    expect(screen.getByTestId('toggle-preview-btn').textContent).toBe('Show Preview')
  })

  it('10. Live preview automatically updates with debounced unsaved values', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        const body = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              subject: `Rendered: ${body.subject}`,
              htmlBody: `Rendered: ${body.htmlBody}`,
              plainTextBody: body.plainTextBody ? `Rendered: ${body.plainTextBody}` : undefined,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
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
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0])

    // Wait for initial preview
    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toContain('Rendered: Welcome to GMHelper!')
    })

    // Modify subject and html body with unsaved values
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
      target: { value: 'Live Unsaved Subject {{name}}' },
    })
    fireEvent.change(screen.getByPlaceholderText('<p>Hello, welcome to our service...</p>'), {
      target: { value: '<p>Live Unsaved HTML Body</p>' },
    })

    // Wait for debounced live preview update
    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe('Rendered: Live Unsaved Subject {{name}}')
      expect(screen.getByTestId('preview-rendered-html').innerHTML).toContain('Rendered: <p>Live Unsaved HTML Body</p>')
    })
  })

  it('11. Displays empty notice when subject or html body is blank', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add template/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add template/i }))

    // Preview panel is open by default but fields are empty
    expect(screen.getByTestId('template-preview-card')).toBeDefined()
    expect(screen.getByTestId('preview-empty-notice').textContent).toContain(
      'Enter a subject and HTML body to see the live rendered preview.'
    )

    // No preview API call was made
    const previewCalls = mockFetch.mock.calls.filter(
      (call) => call[0].includes('/preview') && call[1]?.method === 'POST'
    )
    expect(previewCalls.length).toBe(0)
  })

  it('12. Prevents stale older preview responses from overwriting newer preview', async () => {
    let resolveFirstPreview: (value: Response) => void
    let resolveSecondPreview: (value: Response) => void

    let callCount = 0
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        callCount++
        if (callCount === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirstPreview = resolve
          })
        }
        return new Promise<Response>((resolve) => {
          resolveSecondPreview = resolve
        })
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockTemplates), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0])

    // Wait for first preview call to be dispatched
    await waitFor(() => {
      expect(mockFetch.mock.calls.filter((c) => c[0].includes('/preview')).length).toBe(1)
    })

    // User types quickly, triggering second preview
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
      target: { value: 'Newest Typed Subject' },
    })

    await waitFor(() => {
      expect(mockFetch.mock.calls.filter((c) => c[0].includes('/preview')).length).toBe(2)
    })

    // Resolve second (newer) preview first
    await act(async () => {
      resolveSecondPreview!(
        new Response(
          JSON.stringify({
            subject: 'Rendered: Newest Typed Subject',
            htmlBody: '<p>Newest HTML</p>',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe('Rendered: Newest Typed Subject')
    })

    // Now resolve first (stale) preview later
    await act(async () => {
      resolveFirstPreview!(
        new Response(
          JSON.stringify({
            subject: 'Rendered: Stale Older Subject',
            htmlBody: '<p>Stale Older HTML</p>',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    })

    // The rendered subject must remain the newer one
    expect(screen.getByTestId('preview-rendered-subject').textContent).toBe('Rendered: Newest Typed Subject')
  })

  it('13. Displays error states (401, 403, and network errors) in live preview', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'FORBIDDEN', message: 'insufficient permissions' },
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
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
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[0])

    await waitFor(() => {
      expect(screen.getByTestId('preview-error').textContent).toContain('Forbidden (403)')
    })
  })

  it('14. Switching between templates reinitializes live preview correctly', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        const body = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              subject: `Rendered: ${body.subject}`,
              htmlBody: `Rendered: ${body.htmlBody}`,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
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
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Email')).toBeDefined()
    })

    // Open first template
    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe(
        `Rendered: ${mockTemplates[0].subject}`
      )
    })

    // Cancel / close editor
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByTestId('template-preview-card')).toBeNull()

    // Open second template
    fireEvent.click(screen.getAllByRole('button', { name: /Edit/i })[1])

    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe(
        `Rendered: ${mockTemplates[1].subject}`
      )
    })
  })

  it('15. Proves changing editor fields sends exact unsaved values in request body and renders returned preview without clicking Update Template', async () => {
    const savedTemplate = {
      id: 'tpl-saved-1',
      templateKey: 'saved_key',
      name: 'Saved Name',
      templateType: 'campaign',
      subject: 'Original',
      htmlBody: '<p>Original</p>',
      plainTextBody: 'Original Text',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/preview') && options?.method === 'POST') {
        const body = JSON.parse(options.body as string)
        if (body.subject === 'Changed' && body.htmlBody === '<p>Changed</p>') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                subject: 'LIVE PREVIEW SUBJECT',
                htmlBody: '<p>LIVE PREVIEW BODY</p>',
                plainTextBody: 'LIVE PREVIEW TEXT',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              subject: 'Initial Rendered Subject',
              htmlBody: '<p>Initial Rendered HTML</p>',
              plainTextBody: 'Initial Plain',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([savedTemplate]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Saved Name')).toBeDefined()
    })

    // Open edit form
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

    // Initial values are "Original" and "<p>Original</p>"
    expect(screen.getByDisplayValue('Original')).toBeDefined()
    expect(screen.getByDisplayValue('<p>Original</p>')).toBeDefined()

    // Change editor values to "Changed" and "<p>Changed</p>"
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
      target: { value: 'Changed' },
    })
    fireEvent.change(screen.getByPlaceholderText('<p>Hello, welcome to our service...</p>'), {
      target: { value: '<p>Changed</p>' },
    })
    fireEvent.change(screen.getByPlaceholderText('Hello, welcome to our service...'), {
      target: { value: 'Changed Text' },
    })

    // Wait for debounced live preview request
    await waitFor(() => {
      expect(screen.getByTestId('preview-rendered-subject').textContent).toBe('LIVE PREVIEW SUBJECT')
      expect(screen.getByTestId('preview-rendered-html').innerHTML).toContain('<p>LIVE PREVIEW BODY</p>')
      expect(screen.getByTestId('preview-rendered-plaintext').textContent).toBe('LIVE PREVIEW TEXT')
    })

    // Assert that the preview request contained the exact unsaved editor values
    const previewCalls = mockFetch.mock.calls.filter(
      (call) => call[0].includes('/preview') && call[1]?.method === 'POST'
    )
    expect(previewCalls.length).toBeGreaterThanOrEqual(1)

    const latestPreviewCall = previewCalls[previewCalls.length - 1]
    expect(latestPreviewCall[0]).toContain('/api/v1/templates/tpl-saved-1/preview')

    const sentBody = JSON.parse(latestPreviewCall[1].body as string)
    expect(sentBody.subject).toBe('Changed')
    expect(sentBody.htmlBody).toBe('<p>Changed</p>')
    expect(sentBody.plainTextBody).toBe('Changed Text')

    // Confirm that "Update Template" was NEVER clicked (no PUT call was sent)
    const putCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'PUT')
    expect(putCalls.length).toBe(0)
  })

  it('16. Create form requires selecting a template type and shows validation error when omitted', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add template/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add template/i }))

    // Fill all required fields EXCEPT templateType
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome Email'), {
      target: { value: 'Test Template' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. welcome_email'), {
      target: { value: 'test_key' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
      target: { value: 'Test Subject' },
    })
    fireEvent.change(screen.getByPlaceholderText('<p>Hello, welcome to our service...</p>'), {
      target: { value: '<p>Test Body</p>' },
    })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Create Template/i }))

    // Expect validation error for template type
    expect(screen.getByTestId('template-type-error').textContent).toBe('Template type is required')

    // Confirm no POST call was dispatched
    const postCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'POST')
    expect(postCalls.length).toBe(0)
  })

  it('17. Create form renders all four supported template types in the dropdown', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add template/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add template/i }))

    const select = screen.getByTestId('template-type-select') as HTMLSelectElement
    const options = Array.from(select.options).map((opt) => ({
      value: opt.value,
      label: opt.text,
      disabled: opt.disabled,
    }))

    expect(options).toEqual([
      { value: '', label: 'Select a template type...', disabled: true },
      { value: 'direct', label: 'Direct Message', disabled: false },
      { value: 'campaign', label: 'Campaign', disabled: false },
      { value: 'user_agreement', label: 'User Agreement', disabled: false },
      { value: 'automation', label: 'Automation', disabled: false },
    ])
  })

  it('18. Create request sends the selected templateType for each of the four supported types', async () => {
    const typesToTest = [
      { value: 'direct', label: 'Direct Message' },
      { value: 'campaign', label: 'Campaign' },
      { value: 'user_agreement', label: 'User Agreement' },
      { value: 'automation', label: 'Automation' },
    ] as const

    for (const testType of typesToTest) {
      let createdPayload: any = null
      const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          createdPayload = JSON.parse(options.body as string)
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: `tpl-${testType.value}`,
                ...createdPayload,
                createdAt: '2026-09-17T00:00:00Z',
                updatedAt: '2026-09-17T00:00:00Z',
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } }
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

      const { unmount } = render(<EmailTemplatesPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add template/i })).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /Add template/i }))

      fireEvent.change(screen.getByPlaceholderText('e.g. Welcome Email'), {
        target: { value: `${testType.label} Template` },
      })
      fireEvent.change(screen.getByPlaceholderText('e.g. welcome_email'), {
        target: { value: `key_${testType.value}` },
      })
      fireEvent.change(screen.getByTestId('template-type-select'), {
        target: { value: testType.value },
      })
      fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to GMHelper!'), {
        target: { value: `Subject for ${testType.label}` },
      })
      fireEvent.change(screen.getByPlaceholderText('<p>Hello, welcome to our service...</p>'), {
        target: { value: `<p>Body for ${testType.label}</p>` },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Template/i }))
      })

      expect(createdPayload).not.toBeNull()
      expect(createdPayload.templateType).toBe(testType.value)

      unmount()
      cleanup()
    }
  })

  it('19. Edit form displays existing template type as immutable readonly text and does not allow editing', async () => {
    const mockTemplate = {
      id: 'tpl-agreement-1',
      templateKey: 'terms_update',
      name: 'Terms Update Agreement',
      templateType: 'user_agreement',
      subject: 'Updated Terms of Service',
      htmlBody: '<p>Please accept updated terms.</p>',
      plainTextBody: 'Please accept updated terms.',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([mockTemplate]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Terms Update Agreement')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

    // Readonly template type container should be present and show "User Agreement"
    const readonlyType = screen.getByTestId('readonly-template-type')
    expect(readonlyType.textContent).toContain('User Agreement')
    expect(readonlyType.textContent).toContain('Immutable')
    expect(screen.getByText('Template type cannot be changed after creation.')).toBeDefined()

    // The editable select must NOT be in the document
    expect(screen.queryByTestId('template-type-select')).toBeNull()
  })

  it('20. Edit form preserves templateType in update request', async () => {
    const mockTemplate = {
      id: 'tpl-auto-1',
      templateKey: 'auto_alert',
      name: 'Automation Alert',
      templateType: 'automation',
      subject: 'System Alert',
      htmlBody: '<p>System alert body</p>',
      plainTextBody: 'System alert body',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }

    let putPayload: any = null
    const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        putPayload = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockTemplate,
              ...putPayload,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify([mockTemplate]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Automation Alert')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome Email'), {
      target: { value: 'Automation Alert (Renamed)' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Update Template/i }))
    })

    expect(putPayload).not.toBeNull()
    expect(putPayload.templateType).toBe('automation')
  })

  it('21. Template list displays human-readable type labels for all template types', async () => {
    const allTypeTemplates = [
      {
        id: 't-1',
        templateKey: 'direct_msg',
        name: 'Direct Notice',
        templateType: 'direct',
        subject: 'Direct Message Subject',
        htmlBody: '<p>Direct</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 't-2',
        templateKey: 'campaign_msg',
        name: 'Newsletter Campaign',
        templateType: 'campaign',
        subject: 'Campaign Subject',
        htmlBody: '<p>Campaign</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 't-3',
        templateKey: 'agreement_msg',
        name: 'EULA Agreement',
        templateType: 'user_agreement',
        subject: 'User Agreement Subject',
        htmlBody: '<p>Agreement</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 't-4',
        templateKey: 'automation_msg',
        name: 'Auto Rule Alert',
        templateType: 'automation',
        subject: 'Automation Subject',
        htmlBody: '<p>Automation</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(allTypeTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-type-badge-t-1').textContent).toBe('Direct Message')
      expect(screen.getByTestId('template-type-badge-t-2').textContent).toBe('Campaign')
      expect(screen.getByTestId('template-type-badge-t-3').textContent).toBe('User Agreement')
      expect(screen.getByTestId('template-type-badge-t-4').textContent).toBe('Automation')
    })
  })

  it('22. Type filter shows all supported options', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByTestId('template-type-filter')).toBeDefined()
    })

    const filterSelect = screen.getByTestId('template-type-filter') as HTMLSelectElement
    const options = Array.from(filterSelect.options).map((opt) => ({
      value: opt.value,
      label: opt.text,
    }))

    expect(options).toEqual([
      { value: 'all', label: 'All Types' },
      { value: 'direct', label: 'Direct Message' },
      { value: 'campaign', label: 'Campaign' },
      { value: 'user_agreement', label: 'User Agreement' },
      { value: 'automation', label: 'Automation' },
    ])
  })

  it('23. Filtering by each type shows only matching templates and All Types restores complete list', async () => {
    const multiTypeTemplates = [
      {
        id: 't-dir',
        templateKey: 't_dir',
        name: 'Direct Template',
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
        id: 't-camp',
        templateKey: 't_camp',
        name: 'Campaign Template',
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
        id: 't-agree',
        templateKey: 't_agree',
        name: 'Agreement Template',
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
        id: 't-auto',
        templateKey: 't_auto',
        name: 'Automation Template',
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

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(multiTypeTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Direct Template')).toBeDefined()
      expect(screen.getByText('Campaign Template')).toBeDefined()
      expect(screen.getByText('Agreement Template')).toBeDefined()
      expect(screen.getByText('Automation Template')).toBeDefined()
    })

    const filterSelect = screen.getByTestId('template-type-filter')

    // Filter by direct
    fireEvent.change(filterSelect, { target: { value: 'direct' } })
    expect(screen.getByText('Direct Template')).toBeDefined()
    expect(screen.queryByText('Campaign Template')).toBeNull()
    expect(screen.queryByText('Agreement Template')).toBeNull()
    expect(screen.queryByText('Automation Template')).toBeNull()

    // Filter by campaign
    fireEvent.change(filterSelect, { target: { value: 'campaign' } })
    expect(screen.queryByText('Direct Template')).toBeNull()
    expect(screen.getByText('Campaign Template')).toBeDefined()
    expect(screen.queryByText('Agreement Template')).toBeNull()
    expect(screen.queryByText('Automation Template')).toBeNull()

    // Filter by user_agreement
    fireEvent.change(filterSelect, { target: { value: 'user_agreement' } })
    expect(screen.queryByText('Direct Template')).toBeNull()
    expect(screen.queryByText('Campaign Template')).toBeNull()
    expect(screen.getByText('Agreement Template')).toBeDefined()
    expect(screen.queryByText('Automation Template')).toBeNull()

    // Filter by automation
    fireEvent.change(filterSelect, { target: { value: 'automation' } })
    expect(screen.queryByText('Direct Template')).toBeNull()
    expect(screen.queryByText('Campaign Template')).toBeNull()
    expect(screen.queryByText('Agreement Template')).toBeNull()
    expect(screen.getByText('Automation Template')).toBeDefined()

    // Restore All Types
    fireEvent.change(filterSelect, { target: { value: 'all' } })
    expect(screen.getByText('Direct Template')).toBeDefined()
    expect(screen.getByText('Campaign Template')).toBeDefined()
    expect(screen.getByText('Agreement Template')).toBeDefined()
    expect(screen.getByText('Automation Template')).toBeDefined()
  })

  it('24. Filter works in combination with search query and handles empty filter results', async () => {
    const templatesList = [
      {
        id: 't-1',
        templateKey: 'welcome_direct',
        name: 'Welcome Direct',
        templateType: 'direct',
        subject: 'Welcome to Platform',
        htmlBody: '<p>Direct</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 't-2',
        templateKey: 'welcome_campaign',
        name: 'Welcome Campaign',
        templateType: 'campaign',
        subject: 'Welcome to Platform',
        htmlBody: '<p>Campaign</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 't-3',
        templateKey: 'promo_campaign',
        name: 'Promo Campaign',
        templateType: 'campaign',
        subject: 'Special 50% Off Promo',
        htmlBody: '<p>Promo</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(templatesList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Welcome Direct')).toBeDefined()
      expect(screen.getByText('Welcome Campaign')).toBeDefined()
      expect(screen.getByText('Promo Campaign')).toBeDefined()
    })

    const searchInput = screen.getByTestId('template-search-input')
    const filterSelect = screen.getByTestId('template-type-filter')

    // Search "Welcome" - matches 2 templates (one direct, one campaign)
    fireEvent.change(searchInput, { target: { value: 'Welcome' } })
    expect(screen.getByText('Welcome Direct')).toBeDefined()
    expect(screen.getByText('Welcome Campaign')).toBeDefined()
    expect(screen.queryByText('Promo Campaign')).toBeNull()

    // Narrow down by type = "campaign"
    fireEvent.change(filterSelect, { target: { value: 'campaign' } })
    expect(screen.queryByText('Welcome Direct')).toBeNull()
    expect(screen.getByText('Welcome Campaign')).toBeDefined()

    // Search term with no match for type "campaign"
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } })
    expect(screen.getByText('No email templates match your filter criteria.')).toBeDefined()

    // Reset filters button
    fireEvent.click(screen.getByTestId('reset-filter-btn'))
    expect(screen.getByText('Welcome Direct')).toBeDefined()
    expect(screen.getByText('Welcome Campaign')).toBeDefined()
    expect(screen.getByText('Promo Campaign')).toBeDefined()
  })
})



