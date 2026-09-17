// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { directService } from './directService'
import { ApiError, createApiClient } from './apiClient'
import type {
  CreateDirectNotificationInput,
  DirectNotification,
} from '../types/direct'

describe('directService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('createNotification sends POST to /api/v1/notifications/direct with externalUserId and payload', async () => {
    const input: CreateDirectNotificationInput = {
      templateId: 'tpl-123',
      externalUserId: 'user-456',
      recipientEmail: 'user@example.com',
      recipientName: 'John Doe',
      notificationType: 'direct',
      payload: {
        customVar: 'hello-world',
        orderId: 99,
      },
    }

    const createdResponse: DirectNotification = {
      id: 'notif-1',
      templateId: input.templateId,
      externalUserId: input.externalUserId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      payload: input.payload,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-direct'
    const client = createApiClient(token)
    const result = await directService.createNotification(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify(input))

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(createdResponse)
  })

  it('createNotification sends POST without externalUserId for arbitrary recipients', async () => {
    const input: CreateDirectNotificationInput = {
      templateId: 'tpl-789',
      recipientEmail: 'arbitrary@example.com',
    }

    const createdResponse: DirectNotification = {
      id: 'notif-2',
      templateId: input.templateId,
      recipientEmail: input.recipientEmail,
      notificationType: 'direct',
      deliveryStatus: 'pending',
      attemptsCount: 0,
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const result = await directService.createNotification(input)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(createdResponse)
  })

  it('deliverNotification sends POST to /api/v1/notifications/direct/{id}/deliver with empty object body', async () => {
    const deliverResponse: DirectNotification = {
      id: 'notif-123',
      templateId: 'tpl-1',
      recipientEmail: 'john@example.com',
      notificationType: 'direct',
      deliveryStatus: 'sent',
      attemptsCount: 1,
      sentAt: '2026-09-17T12:05:00Z',
      createdAt: '2026-09-17T12:00:00Z',
      updatedAt: '2026-09-17T12:05:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(deliverResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-deliver')
    const result = await directService.deliverNotification('notif-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct/notif-123/deliver')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify({}))
    expect(result).toEqual(deliverResponse)
  })

  it('deliverNotification correctly URL-encodes special characters in notification id', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'special/id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await directService.deliverNotification('special/id')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct/special%2Fid/deliver')
  })

  it('getNotification sends GET to /api/v1/notifications/direct/{id}', async () => {
    const mockNotification: DirectNotification = {
      id: 'notif-456',
      templateId: 'tpl-1',
      recipientEmail: 'alex@example.com',
      notificationType: 'direct',
      deliveryStatus: 'failed',
      attemptsCount: 3,
      errorMessage: 'SMTP connection timeout',
      createdAt: '2026-09-17T10:00:00Z',
      updatedAt: '2026-09-17T10:03:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockNotification), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-get')
    const result = await directService.getNotification('notif-456', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct/notif-456')
    expect(calledOptions.method).toBe('GET')
    expect(result).toEqual(mockNotification)
  })

  it('listPending sends GET to /api/v1/notifications/direct/pending', async () => {
    const pendingList: DirectNotification[] = [
      {
        id: 'notif-pending-1',
        templateId: 'tpl-1',
        recipientEmail: 'p1@example.com',
        notificationType: 'direct',
        deliveryStatus: 'pending',
        attemptsCount: 0,
        createdAt: '2026-09-17T11:00:00Z',
        updatedAt: '2026-09-17T11:00:00Z',
      },
      {
        id: 'notif-pending-2',
        templateId: 'tpl-2',
        recipientEmail: 'p2@example.com',
        notificationType: 'direct',
        deliveryStatus: 'pending',
        attemptsCount: 1,
        errorMessage: 'Temporary network failure',
        createdAt: '2026-09-17T11:02:00Z',
        updatedAt: '2026-09-17T11:05:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(pendingList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-pending')
    const result = await directService.listPending(client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/notifications/direct/pending')
    expect(calledOptions.method).toBe('GET')
    expect(result).toEqual(pendingList)
  })

  it('passes AbortSignal to underlying fetch calls', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await directService.listPending(undefined, controller.signal)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, calledOptions] = mockFetch.mock.calls[0]
    expect(calledOptions.signal).toBe(controller.signal)
  })

  it('propagates ApiError when server returns an error response', async () => {
    const errorBody = {
      error: {
        code: 'BAD_REQUEST',
        message: 'template is not active for delivery',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await expect(
      directService.createNotification({
        templateId: 'inactive-tpl',
        recipientEmail: 'test@example.com',
      })
    ).rejects.toThrow(ApiError)
  })
})
