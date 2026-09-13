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
})
