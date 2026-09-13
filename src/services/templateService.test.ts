// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { templateService } from './templateService'
import { createApiClient } from './apiClient'
import type { CreateTemplateInput, EmailTemplate, UpdateTemplateInput } from '../types'

describe('templateService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getTemplates sends GET to /api/v1/templates with Authorization header', async () => {
    const mockTemplates: EmailTemplate[] = [
      {
        id: 'tpl-1',
        templateKey: 'welcome_email',
        name: 'Welcome Email',
        subject: 'Welcome to our platform!',
        htmlBody: '<p>Welcome</p>',
        locale: 'en',
        status: 'active',
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplates), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'test-token-jwt-123'
    const client = createApiClient(token)
    const result = await templateService.getTemplates(client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates')
    expect(calledOptions.method).toBe('GET')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(mockTemplates)
  })

  it('getTemplate sends GET to /api/v1/templates/{id}', async () => {
    const mockTemplate: EmailTemplate = {
      id: 'tpl-123',
      templateKey: 'password_reset',
      name: 'Password Reset',
      subject: 'Reset your password',
      htmlBody: '<p>Click link</p>',
      locale: 'en',
      status: 'active',
      version: 1,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockTemplate), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-abc')
    const result = await templateService.getTemplate('tpl-123', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates/tpl-123')
    expect(result).toEqual(mockTemplate)
  })

  it('createTemplate sends POST to /api/v1/templates with JSON payload', async () => {
    const input: CreateTemplateInput = {
      templateKey: 'order_receipt',
      name: 'Order Receipt',
      subject: 'Your receipt for order',
      htmlBody: '<p>Thank you for your order</p>',
      locale: 'en',
      status: 'active',
      version: 1,
    }

    const createdTemplate: EmailTemplate = {
      id: 'tpl-new',
      templateKey: input.templateKey,
      name: input.name,
      subject: input.subject,
      htmlBody: input.htmlBody,
      locale: input.locale ?? 'en',
      status: input.status ?? 'active',
      version: input.version ?? 1,
      createdAt: '2026-09-14T00:00:00Z',
      updatedAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdTemplate), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-create')
    const result = await templateService.createTemplate(input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(createdTemplate)
  })

  it('updateTemplate sends PUT to /api/v1/templates/{id} with JSON payload', async () => {
    const input: UpdateTemplateInput = {
      templateKey: 'welcome_email',
      name: 'Welcome Email Updated',
      subject: 'Updated Welcome Subject',
      htmlBody: '<p>Welcome updated</p>',
      locale: 'en',
      status: 'active',
      version: 2,
    }

    const updatedTemplate: EmailTemplate = {
      id: 'tpl-101',
      templateKey: input.templateKey,
      name: input.name,
      subject: input.subject,
      htmlBody: input.htmlBody,
      locale: input.locale ?? 'en',
      status: input.status ?? 'active',
      version: input.version ?? 2,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-14T00:00:00Z',
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedTemplate), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-update')
    const result = await templateService.updateTemplate('tpl-101', input, client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates/tpl-101')
    expect(calledOptions.method).toBe('PUT')
    expect(calledOptions.body).toBe(JSON.stringify(input))
    expect(result).toEqual(updatedTemplate)
  })

  it('deleteTemplate sends DELETE to /api/v1/templates/{id}', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    )
    globalThis.fetch = mockFetch

    const client = createApiClient('token-del')
    await templateService.deleteTemplate('tpl-101', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/templates/tpl-101')
    expect(calledOptions.method).toBe('DELETE')
  })
})
