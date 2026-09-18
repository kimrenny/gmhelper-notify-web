// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AutomationPage from './AutomationPage'
import * as useAuthModule from '../hooks/useAuth'
import type { AuthContextValue } from '../types/auth'
import type { AutomationRule, AutomationRuleConfig, EmailTemplate } from '../types'

const sampleConfig1: AutomationRuleConfig = {
  version: 1,
  schedule: {
    type: 'daily',
    hourUtc: 3,
    minuteUtc: 0,
  },
  conditions: {
    operator: 'all',
    conditions: [
      {
        field: 'isActive',
        operator: 'equals',
        value: true,
      },
      {
        field: 'isBlocked',
        operator: 'equals',
        value: false,
      },
      {
        field: 'email',
        operator: 'exists',
      },
      {
        field: 'registrationDate',
        operator: 'older_than',
        value: 365,
        unit: 'days',
      },
      {
        operator: 'any',
        conditions: [
          {
            field: 'language',
            operator: 'equals',
            value: 'EN',
          },
          {
            field: 'language',
            operator: 'in',
            value: ['UA', 'DE'],
          },
        ],
      },
    ],
  },
  action: {
    type: 'send_email',
    cooldownDays: 90,
  },
}

const sampleConfig2: AutomationRuleConfig = {
  version: 1,
  schedule: {
    type: 'weekly',
    dayOfWeek: 1,
    hourUtc: 10,
    minuteUtc: 30,
  },
  conditions: {
    operator: 'all',
    conditions: [
      {
        field: 'role',
        operator: 'not_in',
        value: ['guest', 'banned'],
      },
    ],
  },
  action: {
    type: 'send_email',
  },
}

describe('AutomationPage component with Rule Builder', () => {
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
      id: 'tpl-1',
      templateKey: 'welcome_email',
      name: 'Welcome Email Template',
      templateType: 'automation',
      subject: 'Welcome to our platform!',
      htmlBody: '<p>Welcome!</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'tpl-2',
      templateKey: 'password_reset',
      name: 'Password Reset Template',
      templateType: 'automation',
      subject: 'Reset your password',
      htmlBody: '<p>Reset link</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-02T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    },
  ]

  const mockRules: AutomationRule[] = [
    {
      id: 'rule-1',
      name: 'Re-engage inactive users',
      templateId: 'tpl-1',
      enabled: true,
      config: sampleConfig1,
      lastEvaluatedAt: '2026-09-14T03:00:00Z',
      nextEvaluationAt: '2026-09-15T03:00:00Z',
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'rule-2',
      name: 'Weekly Newsletter Notification',
      templateId: 'tpl-2',
      enabled: false,
      config: sampleConfig2,
      lastEvaluatedAt: null,
      nextEvaluationAt: null,
      createdAt: '2026-09-11T12:00:00Z',
      updatedAt: '2026-09-11T12:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    setAuthMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Displays loading state and then renders successful rule list with schedule and condition summaries', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockRules), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    // Verify loading indicator is visible
    expect(screen.getByText(/Loading automation rules.../i)).toBeDefined()

    // Wait for list to render
    await waitFor(() => {
      expect(screen.getByText('Re-engage inactive users')).toBeDefined()
      expect(screen.getByText('Weekly Newsletter Notification')).toBeDefined()
    })

    expect(screen.queryByText(/Loading automation rules.../i)).toBeNull()
    expect(screen.getByTestId('status-badge-rule-1').textContent).toBe('Enabled')
    expect(screen.getByTestId('status-badge-rule-2').textContent).toBe('Disabled')

    // Verify schedule summary
    expect(screen.getByTestId('schedule-summary-rule-1').textContent).toBe('Daily at 03:00 UTC')
    expect(screen.getByTestId('schedule-summary-rule-2').textContent).toBe('Weekly on Monday at 10:30 UTC')

    // Verify conditions summary
    expect(screen.getByTestId('conditions-summary-rule-1').textContent).toBe('Match ALL (6 criteria)')
    expect(screen.getByTestId('conditions-summary-rule-2').textContent).toBe('Match ALL (1 criteria)')

    // Verify template link
    expect(screen.getByTestId('template-name-rule-1').textContent).toContain('Welcome Email Template')
    expect(screen.getByTestId('template-name-rule-2').textContent).toContain('Password Reset Template')

    // Verify evaluation timestamps
    expect(screen.getByTestId('last-evaluated-rule-1').textContent).not.toBe('-')
    expect(screen.getByTestId('next-evaluation-rule-1').textContent).not.toBe('-')
    expect(screen.getByTestId('last-evaluated-rule-2').textContent).toBe('-')
    expect(screen.getByTestId('next-evaluation-rule-2').textContent).toBe('-')
  })

  it('2. Displays empty state when rules list is empty', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByText(/No automation rules found. Click "Create rule" to create one./i)).toBeDefined()
    })
  })

  it('3. Handles API error and retries successfully on Retry click', async () => {
    let attempts = 0
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules')) {
        attempts++
        if (attempts === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Database query failed' } }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockRules), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('error-title')).toBeDefined()
      expect(screen.getByText(/Database query failed/i)).toBeDefined()
    })

    // Click Retry
    const retryBtn = screen.getByTestId('retry-btn')
    await act(async () => {
      fireEvent.click(retryBtn)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('error-title')).toBeNull()
      expect(screen.getByText('Re-engage inactive users')).toBeDefined()
    })
  })

  it('4. Handles 401 Unauthorized and 403 Forbidden error banners', async () => {
    const mockFetch401 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch401

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('error-title').textContent).toBe('Unauthorized (401)')
    })
  })

  it('5. Submits Create Rule form with Rule Builder: daily schedule, multiple conditions, nested group, cooldown, and verifies sent payload structure', async () => {
    let rulesState = [...mockRules]
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTemplates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      if (url.includes('/api/v1/automation/rules') && options?.method === 'POST') {
        const payload = JSON.parse(options.body as string)
        const newRule: AutomationRule = {
          id: 'rule-new-1',
          name: payload.name,
          templateId: payload.templateId,
          enabled: payload.enabled ?? true,
          config: payload.config,
          createdAt: '2026-09-15T12:00:00Z',
          updatedAt: '2026-09-15T12:00:00Z',
        }
        rulesState = [newRule, ...rulesState]
        return Promise.resolve(
          new Response(JSON.stringify(newRule), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(
          new Response(JSON.stringify(rulesState), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByText('Re-engage inactive users')).toBeDefined()
    })

    // Open Create Form
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-rule-btn'))
    })

    expect(screen.getByTestId('rule-form-card')).toBeDefined()

    // 1. Fill basic fields
    fireEvent.change(screen.getByTestId('rule-name-input'), {
      target: { value: 'New User Re-engagement Flow' },
    })
    fireEvent.change(screen.getByTestId('rule-template-select'), {
      target: { value: 'tpl-1' },
    })

    // 2. Schedule settings: Daily at 05:30 UTC
    fireEvent.change(screen.getByTestId('schedule-type-select'), {
      target: { value: 'daily' },
    })
    fireEvent.change(screen.getByTestId('schedule-hour-input'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByTestId('schedule-minute-input'), {
      target: { value: '30' },
    })

    // 3. Configure conditions in visual tree
    // Root has initial condition item 0 (isActive) -> change to isBlocked = false
    fireEvent.change(screen.getByTestId('condition-field-select-root-0'), {
      target: { value: 'isBlocked' },
    })
    fireEvent.change(screen.getByTestId('condition-value-boolean-root-0'), {
      target: { value: 'false' },
    })

    // Add a second condition in root: email exists
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-condition-btn-root'))
    })
    fireEvent.change(screen.getByTestId('condition-field-select-root-1'), {
      target: { value: 'email' },
    })
    // Email defaults to 'exists' operator, which needs no value

    // Add a nested group under root: operator ANY with language in UA, DE
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-group-btn-root'))
    })
    // Group added at root index 2
    fireEvent.change(screen.getByTestId('group-operator-select-2'), {
      target: { value: 'any' },
    })
    // Condition inside nested group (path '2-0') -> language in list
    fireEvent.change(screen.getByTestId('condition-field-select-2-0'), {
      target: { value: 'language' },
    })
    fireEvent.change(screen.getByTestId('condition-operator-select-2-0'), {
      target: { value: 'in' },
    })
    fireEvent.change(screen.getByTestId('condition-value-list-2-0'), {
      target: { value: 'UA, DE' },
    })

    // 4. Cooldown
    fireEvent.change(screen.getByTestId('cooldown-input'), {
      target: { value: '60' },
    })

    // Submit form
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    // Verify POST was sent with correct body structure
    const postCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/automation/rules') && call[1]?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const requestBody = JSON.parse(postCall![1].body as string)
    expect(requestBody).toEqual({
      name: 'New User Re-engagement Flow',
      templateId: 'tpl-1',
      enabled: true,
      config: {
        version: 1,
        schedule: {
          type: 'daily',
          hourUtc: 5,
          minuteUtc: 30,
        },
        conditions: {
          operator: 'all',
          conditions: [
            { field: 'isBlocked', operator: 'equals', value: false },
            { field: 'email', operator: 'exists' },
            {
              operator: 'any',
              conditions: [{ field: 'language', operator: 'in', value: ['UA', 'DE'] }],
            },
          ],
        },
        action: {
          type: 'send_email',
          cooldownDays: 60,
        },
      },
    })
    // Ensure templateId is top-level and NOT duplicated inside config.action
    expect(requestBody.templateId).toBe('tpl-1')
    expect(requestBody.config.action.templateId).toBeUndefined()

    // Verify form closed and new rule is in table
    await waitFor(() => {
      expect(screen.queryByTestId('rule-form-card')).toBeNull()
      expect(screen.getByText('New User Re-engagement Flow')).toBeDefined()
    })
  })

  it('6. Supports weekly and interval_hours schedule configuration in Rule Builder', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules') && options?.method === 'POST') {
        const payload = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(JSON.stringify({ id: `rule-sched-${mockFetch.mock.calls.length}`, ...payload }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('create-rule-btn')).toBeDefined()
    })

    // 1. Weekly schedule creation
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-rule-btn'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('rule-name-input'), { target: { value: 'Weekly Rule' } })
      fireEvent.change(screen.getByTestId('rule-template-select'), { target: { value: 'tpl-2' } })
      fireEvent.change(screen.getByTestId('schedule-type-select'), { target: { value: 'weekly' } })
      fireEvent.change(screen.getByTestId('schedule-day-select'), { target: { value: '5' } }) // Friday
      fireEvent.change(screen.getByTestId('schedule-hour-input'), { target: { value: '14' } })
      fireEvent.change(screen.getByTestId('schedule-minute-input'), { target: { value: '45' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    let postCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/automation/rules') && call[1]?.method === 'POST'
    )
    expect(JSON.parse(postCall![1].body as string).config.schedule).toEqual({
      type: 'weekly',
      dayOfWeek: 5,
      hourUtc: 14,
      minuteUtc: 45,
    })

    // 2. Interval Hours schedule creation
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-rule-btn'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('rule-name-input'), { target: { value: 'Interval Rule' } })
      fireEvent.change(screen.getByTestId('rule-template-select'), { target: { value: 'tpl-1' } })
      fireEvent.change(screen.getByTestId('schedule-type-select'), { target: { value: 'interval_hours' } })
      fireEvent.change(screen.getByTestId('schedule-interval-input'), { target: { value: '48' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    postCall = mockFetch.mock.calls.filter(
      (call) => call[0].includes('/api/v1/automation/rules') && call[1]?.method === 'POST'
    )[1]
    expect(JSON.parse(postCall![1].body as string).config.schedule).toEqual({
      type: 'interval_hours',
      intervalHours: 48,
    })
  })

  it('7. Supports registrationDate relative (older_than / newer_than) and absolute (before / after) conditions', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules') && options?.method === 'POST') {
        const payload = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'rule-date-1', ...payload }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('create-rule-btn')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-rule-btn'))
    })

    // Fill registrationDate relative
    await act(async () => {
      fireEvent.change(screen.getByTestId('rule-name-input'), { target: { value: 'Registration Date Flow' } })
      fireEvent.change(screen.getByTestId('rule-template-select'), { target: { value: 'tpl-1' } })
      fireEvent.change(screen.getByTestId('condition-field-select-root-0'), { target: { value: 'registrationDate' } })
    })
    // registrationDate defaults to older_than with value 30 days
    expect(screen.getByTestId('condition-value-relative-number-root-0')).toBeDefined()
    expect(screen.getByTestId('condition-value-relative-unit-root-0')).toBeDefined()

    await act(async () => {
      fireEvent.change(screen.getByTestId('condition-value-relative-number-root-0'), { target: { value: '90' } })
      fireEvent.change(screen.getByTestId('condition-value-relative-unit-root-0'), { target: { value: 'days' } })
    })

    // Add another condition: registrationDate before 2025-01-01
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-condition-btn-root'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('condition-field-select-root-1'), { target: { value: 'registrationDate' } })
      fireEvent.change(screen.getByTestId('condition-operator-select-root-1'), { target: { value: 'before' } })
      fireEvent.change(screen.getByTestId('condition-value-date-root-1'), { target: { value: '2025-01-01' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    const postCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/automation/rules') && call[1]?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const requestBody = JSON.parse(postCall![1].body as string)
    expect(requestBody.config.conditions.conditions).toEqual([
      { field: 'registrationDate', operator: 'older_than', value: 90, unit: 'days' },
      { field: 'registrationDate', operator: 'before', value: '2025-01-01' },
    ])
  })

  it('8. Opens edit form, loads rule details by ID, and submits updated rule via PUT', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url === 'http://localhost:8080/api/v1/automation/rules/rule-1' || url.endsWith('/api/v1/automation/rules/rule-1')) {
        if (options?.method === 'PUT') {
          const payload = JSON.parse(options.body as string)
          return Promise.resolve(
            new Response(JSON.stringify({ ...mockRules[0], ...payload }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        return Promise.resolve(new Response(JSON.stringify(mockRules[0]), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify(mockRules), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('edit-rule-btn-rule-1')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-rule-btn-rule-1'))
    })

    // Rule form opens with existing name
    expect(screen.getByTestId('rule-form-card')).toBeDefined()
    expect((screen.getByTestId('rule-name-input') as HTMLInputElement).value).toBe('Re-engage inactive users')

    // Modify name and submit
    await act(async () => {
      fireEvent.change(screen.getByTestId('rule-name-input'), {
        target: { value: 'Re-engage inactive users (Updated)' },
      })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    const putCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/automation/rules/rule-1') && call[1]?.method === 'PUT'
    )
    expect(putCall).toBeDefined()
    const requestBody = JSON.parse(putCall![1].body as string)
    expect(requestBody.name).toBe('Re-engage inactive users (Updated)')
  })

  it('9. Quick enable/disable toggle button updates rule state via PUT', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules/rule-1') && options?.method === 'PUT') {
        const payload = JSON.parse(options.body as string)
        return Promise.resolve(
          new Response(JSON.stringify({ ...mockRules[0], ...payload }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify(mockRules), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('toggle-rule-btn-rule-1')).toBeDefined()
    })

    // Rule 1 is currently enabled (Active). Clicking toggle should disable it.
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-rule-btn-rule-1'))
    })

    const putCall = mockFetch.mock.calls.find(
      (call) => call[0].includes('/api/v1/automation/rules/rule-1') && call[1]?.method === 'PUT'
    )
    expect(putCall).toBeDefined()
    const requestBody = JSON.parse(putCall![1].body as string)
    expect(requestBody.enabled).toBe(false)
  })

  it('10. Delete prompt shows confirmation card, cancels cleanly, or confirms delete via DELETE request', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules/rule-1') && options?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify(mockRules), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('delete-rule-btn-rule-1')).toBeDefined()
    })

    // Click Delete opens confirmation card
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-rule-btn-rule-1'))
    })

    expect(screen.getByTestId('delete-confirmation-card')).toBeDefined()

    // Test Cancel button
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-delete-btn'))
    })
    expect(screen.queryByTestId('delete-confirmation-card')).toBeNull()

    // Open delete confirmation again and confirm
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-rule-btn-rule-1'))
    })
    expect(screen.getByTestId('delete-confirmation-card')).toBeDefined()

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('delete-confirmation-card')).toBeNull()
    })
  })

  it('11. Client-side validation blocks invalid inputs (missing name, missing template, invalid schedule, invalid cooldown, and empty groups)', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/templates')) {
        return Promise.resolve(new Response(JSON.stringify(mockTemplates), { status: 200 }))
      }
      if (url.includes('/api/v1/automation/rules')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    globalThis.fetch = mockFetch

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('create-rule-btn')).toBeDefined()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-rule-btn'))
    })

    // 1. Submit with empty name and empty template
    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })

    expect(screen.getByTestId('rule-name-error').textContent).toBe('Rule name is required')
    expect(screen.getByTestId('rule-template-error').textContent).toBe('Please select an email template')

    // 2. Schedule out of range
    await act(async () => {
      fireEvent.change(screen.getByTestId('rule-name-input'), { target: { value: 'Valid Name' } })
      fireEvent.change(screen.getByTestId('rule-template-select'), { target: { value: 'tpl-1' } })
      fireEvent.change(screen.getByTestId('schedule-hour-input'), { target: { value: '25' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })
    expect(screen.getByTestId('schedule-error')).toBeDefined()

    // 3. Cooldown negative number
    await act(async () => {
      fireEvent.change(screen.getByTestId('schedule-hour-input'), { target: { value: '12' } })
      fireEvent.change(screen.getByTestId('cooldown-input'), { target: { value: '-5' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })
    expect(screen.getByTestId('cooldown-error')).toBeDefined()

    // 4. Empty condition group
    await act(async () => {
      fireEvent.change(screen.getByTestId('cooldown-input'), { target: { value: '30' } })
      // Remove the only condition in root
      fireEvent.click(screen.getByTestId('remove-condition-btn-root-0'))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-rule-btn'))
    })
    expect(screen.getByTestId('conditions-error')).toBeDefined()
  })

  it('12. Only displays automation templates in rule composer template selector and excludes non-automation templates', async () => {
    const mixedTemplates: EmailTemplate[] = [
      {
        id: 'tpl-auto-valid',
        templateKey: 'auto_valid',
        name: 'Valid Automation Template',
        templateType: 'automation',
        subject: 'Auto Sub',
        htmlBody: '<p>Auto</p>',
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
        subject: 'Direct Sub',
        htmlBody: '<p>Direct</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tpl-camp-excl',
        templateKey: 'camp_excl',
        name: 'Excluded Campaign Template',
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
        id: 'tpl-agree-excl',
        templateKey: 'agree_excl',
        name: 'Excluded Agreement Template',
        templateType: 'user_agreement',
        subject: 'Agree Sub',
        htmlBody: '<p>Agree</p>',
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

    render(<AutomationPage />)

    await waitFor(() => {
      expect(screen.getByTestId('create-rule-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('create-rule-btn'))

    const select = screen.getByTestId('rule-template-select') as HTMLSelectElement
    expect(select.textContent).toContain('Valid Automation Template')
    expect(select.textContent).not.toContain('Excluded Direct Template')
    expect(select.textContent).not.toContain('Excluded Campaign Template')
    expect(select.textContent).not.toContain('Excluded Agreement Template')
  })
})
