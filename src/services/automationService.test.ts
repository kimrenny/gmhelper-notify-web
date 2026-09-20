// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { automationService } from './automationService'
import { ApiError, createApiClient } from './apiClient'
import type {
  AutomationRule,
  AutomationRuleConfig,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../types/automation'

describe('automationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const sampleConfig: AutomationRuleConfig = {
    version: 1,
    trigger: 'user.registered',
    schedule: {
      type: 'daily',
      hourUtc: 3,
      minuteUtc: 0,
    },
    conditions: {
      operator: 'all',
      conditions: [
        {
          field: 'isBlocked',
          operator: 'equals',
          value: false,
        },
        {
          field: 'isActive',
          operator: 'equals',
          value: true,
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

  const mockRules: AutomationRule[] = [
    {
      id: 'rule-1',
      name: 'Re-engage inactive users',
      templateId: 'tpl-1',
      enabled: true,
      config: sampleConfig,
      lastEvaluatedAt: '2026-09-14T03:00:00Z',
      nextEvaluationAt: '2026-09-15T03:00:00Z',
      createdAt: '2026-09-14T00:00:00Z',
      updatedAt: '2026-09-14T00:00:00Z',
    },
    {
      id: 'rule-2',
      name: 'Weekly Newsletter Reminder',
      templateId: 'tpl-2',
      enabled: false,
      config: {
        version: 1,
        trigger: 'user.inactive',
        schedule: {
          type: 'weekly',
          hourUtc: 10,
          minuteUtc: 30,
          dayOfWeek: 1,
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
      },
      lastEvaluatedAt: null,
      nextEvaluationAt: null,
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    },
  ]

  it('getRules sends GET to /api/v1/automation/rules with authorization header and parses responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockRules), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-jwt-automation'
    const client = createApiClient(token)
    const result = await automationService.getRules(client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules')
    expect(calledOptions.method).toBe('GET')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(mockRules)
    expect(result[0].config.action.cooldownDays).toBe(90)
    expect(result[0].templateId).toBe('tpl-1')
  })

  it('getRule sends GET to /api/v1/automation/rules/{id} and parses single rule response', async () => {
    const mockRule = mockRules[0]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockRule), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-abc')
    const result = await automationService.getRule('rule-1', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules/rule-1')
    expect(calledOptions.method).toBe('GET')
    expect(result).toEqual(mockRule)
    expect(result.config.schedule.type).toBe('daily')
  })

  it('createRule sends POST to /api/v1/automation/rules with valid payload including multiple conditions, nested groups, schedule, and action cooldown', async () => {
    const input: CreateAutomationRuleInput = {
      name: 'Re-engage inactive users',
      templateId: 'tpl-1',
      enabled: true,
      config: sampleConfig,
    }

    const createdResponse: AutomationRule = {
      id: 'rule-new-1',
      name: input.name,
      templateId: input.templateId,
      enabled: input.enabled ?? true,
      config: input.config,
      createdAt: '2026-09-15T12:00:00Z',
      updatedAt: '2026-09-15T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-create')
    const result = await automationService.createRule(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules')
    expect(calledOptions.method).toBe('POST')

    const sentPayload = JSON.parse(calledOptions.body as string)
    // Structure assertions
    expect(sentPayload).toEqual({
      name: 'Re-engage inactive users',
      templateId: 'tpl-1',
      enabled: true,
      config: {
        version: 1,
        trigger: 'user.registered',
        schedule: {
          type: 'daily',
          hourUtc: 3,
          minuteUtc: 0,
        },
        conditions: {
          operator: 'all',
          conditions: [
            { field: 'isBlocked', operator: 'equals', value: false },
            { field: 'isActive', operator: 'equals', value: true },
            { field: 'email', operator: 'exists' },
            { field: 'registrationDate', operator: 'older_than', value: 365, unit: 'days' },
            {
              operator: 'any',
              conditions: [
                { field: 'language', operator: 'equals', value: 'EN' },
                { field: 'language', operator: 'in', value: ['UA', 'DE'] },
              ],
            },
          ],
        },
        action: {
          type: 'send_email',
          cooldownDays: 90,
        },
      },
    })
    // Ensure templateId is top-level and NOT duplicated inside config.action
    expect(sentPayload.templateId).toBe('tpl-1')
    expect(sentPayload.config.action.templateId).toBeUndefined()
    expect(result).toEqual(createdResponse)
  })

  it('updateRule sends PUT to /api/v1/automation/rules/{id} with updated config', async () => {
    const updatedConfig: AutomationRuleConfig = {
      version: 1,
      trigger: 'password.changed',
      schedule: {
        type: 'interval_hours',
        intervalHours: 48,
      },
      conditions: {
        operator: 'all',
        conditions: [
          {
            field: 'username',
            operator: 'starts_with',
            value: 'admin_',
          },
        ],
      },
      action: {
        type: 'send_email',
        cooldownDays: 0,
      },
    }

    const input: UpdateAutomationRuleInput = {
      name: 'Updated Rule Name',
      templateId: 'tpl-updated-99',
      enabled: false,
      config: updatedConfig,
    }

    const updatedResponse: AutomationRule = {
      id: 'rule-123',
      name: 'Updated Rule Name',
      templateId: 'tpl-updated-99',
      enabled: false,
      config: updatedConfig,
      createdAt: '2026-09-14T00:00:00Z',
      updatedAt: '2026-09-15T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-update')
    const result = await automationService.updateRule('rule-123', input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules/rule-123')
    expect(calledOptions.method).toBe('PUT')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(updatedResponse)
  })

  it('deleteRule sends DELETE to /api/v1/automation/rules/{id}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-delete')
    await automationService.deleteRule('rule-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules/rule-123')
    expect(calledOptions.method).toBe('DELETE')
  })

  it('passes AbortSignal to the underlying fetch call on requests', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await automationService.getRules(undefined, controller.signal)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, calledOptions] = mockFetch.mock.calls[0]
    expect(calledOptions.signal).toBe(controller.signal)
  })

  it('propagates HTTP error when API returns 500 status', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Database failure' } }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-err')
    await expect(automationService.getRules(client)).rejects.toThrow(ApiError)
  })

  it('propagates 400 Bad Request error as ApiError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid condition field' } }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-err')
    await expect(
      automationService.createRule(
        {
          name: '',
          templateId: '',
          config: sampleConfig,
        },
        client
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
    })
  })

  it('propagates 401 Unauthorized as ApiError with isUnauthorized flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('expired-token')
    await expect(automationService.getRules(client)).rejects.toMatchObject({
      status: 401,
      isUnauthorized: true,
    })
  })

  it('propagates 403 Forbidden as ApiError with isForbidden flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied' } }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('user-token')
    await expect(automationService.getRules(client)).rejects.toMatchObject({
      status: 403,
      isForbidden: true,
    })
  })

  it('propagates 404 Not Found as ApiError with isNotFound flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Rule not found' } }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('admin-token')
    await expect(automationService.getRule('missing-id', client)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('getRuleExecutions sends GET to /api/v1/automation/rules/{id}/executions with query params', async () => {
    const mockResponse = {
      items: [
        {
          id: 'exec-1',
          ruleId: 'rule-1',
          eventId: 'evt-1',
          recipientEmail: 'user@example.com',
          externalUserId: 'usr-1',
          notificationId: 'notif-1',
          status: 'success',
          executedAt: '2026-09-20T12:00:00Z',
          createdAt: '2026-09-20T12:00:00Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-hist')
    const result = await automationService.getRuleExecutions('rule-1', { limit: 20, offset: 0 }, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/automation/rules/rule-1/executions?limit=20&offset=0')
    expect(calledOptions.method).toBe('GET')
    expect(result).toEqual(mockResponse)
  })

  it('propagates network failure as ApiError with isNetworkError flag', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network disconnected'))
    globalThis.fetch = mockFetch

    const client = createApiClient('token-net')
    await expect(automationService.getRules(client)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      isNetworkError: true,
    })
  })
})

