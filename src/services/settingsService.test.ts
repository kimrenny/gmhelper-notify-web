// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsService } from './settingsService'
import { ApiError, createApiClient } from './apiClient'
import type { Settings, UpdateSettingsInput } from '../types/settings'

describe('settingsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mockSettings: Settings = {
    defaultFromName: 'GMHelper Notifications',
    replyToEmail: 'support@gmhelper.com',
    defaultLocale: 'en',
  }

  describe('getSettings', () => {
    it('sends GET to /api/v1/settings with Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const token = 'test-token-jwt-settings'
      const client = createApiClient(token)
      const result = await settingsService.getSettings(client)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain('/api/v1/settings')
      expect(calledOptions.method).toBe('GET')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(result).toEqual(mockSettings)
    })

    it('returns typed Settings object correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const result = await settingsService.getSettings()

      expect(result.defaultFromName).toBe('GMHelper Notifications')
      expect(result.replyToEmail).toBe('support@gmhelper.com')
      expect(result.defaultLocale).toBe('en')
    })

    it('passes AbortSignal to underlying GET fetch call', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      await settingsService.getSettings(undefined, controller.signal)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, calledOptions] = mockFetch.mock.calls[0]
      expect(calledOptions.signal).toBe(controller.signal)
    })

    it('propagates 401 Unauthorized as ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const client = createApiClient('expired-token')
      await expect(settingsService.getSettings(client)).rejects.toMatchObject({
        status: 401,
        isUnauthorized: true,
      })
    })

    it('propagates 403 Forbidden as ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const client = createApiClient('regular-user-token')
      await expect(settingsService.getSettings(client)).rejects.toMatchObject({
        status: 403,
        isForbidden: true,
      })
    })

    it('propagates network failure as ApiError', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
      globalThis.fetch = mockFetch

      const client = createApiClient('token-net')
      await expect(settingsService.getSettings(client)).rejects.toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      })
    })
  })

  describe('updateSettings', () => {
    const updateInput: UpdateSettingsInput = {
      defaultFromName: 'GMHelper Alerts',
      replyToEmail: 'alerts@gmhelper.com',
      defaultLocale: 'ua',
    }

    const updatedSettings: Settings = {
      defaultFromName: 'GMHelper Alerts',
      replyToEmail: 'alerts@gmhelper.com',
      defaultLocale: 'ua',
    }

    it('sends PUT to /api/v1/settings with correct payload and headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(updatedSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const token = 'admin-jwt-token'
      const client = createApiClient(token)
      const result = await settingsService.updateSettings(updateInput, client)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain('/api/v1/settings')
      expect(calledOptions.method).toBe('PUT')

      const headers = new Headers(calledOptions.headers)
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(JSON.parse(calledOptions.body as string)).toEqual(updateInput)
      expect(result).toEqual(updatedSettings)
    })

    it('returns updated Settings object correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(updatedSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      const result = await settingsService.updateSettings(updateInput)

      expect(result.defaultFromName).toBe('GMHelper Alerts')
      expect(result.replyToEmail).toBe('alerts@gmhelper.com')
      expect(result.defaultLocale).toBe('ua')
    })

    it('passes AbortSignal to underlying PUT fetch call', async () => {
      const controller = new AbortController()
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(updatedSettings), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      globalThis.fetch = mockFetch

      await settingsService.updateSettings(updateInput, undefined, controller.signal)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, calledOptions] = mockFetch.mock.calls[0]
      expect(calledOptions.signal).toBe(controller.signal)
    })

    it('propagates 400 Bad Request on invalid input', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'INVALID_INPUT',
                message: 'invalid email address format: invalid-email',
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      )
      globalThis.fetch = mockFetch

      const badInput: UpdateSettingsInput = {
        replyToEmail: 'invalid-email',
      }

      await expect(settingsService.updateSettings(badInput)).rejects.toThrow(ApiError)
      await expect(settingsService.updateSettings(badInput)).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_INPUT',
        message: 'invalid email address format: invalid-email',
      })
    })

    it('propagates 500 Internal Server Error as ApiError', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'failed to update settings',
              },
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      )
      globalThis.fetch = mockFetch

      await expect(settingsService.updateSettings(updateInput)).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
      })
    })
  })
})
