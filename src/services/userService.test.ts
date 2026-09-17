// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userService } from './userService'
import { ApiError, createApiClient } from './apiClient'
import type { UserSearchResult } from '../types/user'

describe('userService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('searchUsers returns empty array immediately when query is empty or only whitespace', async () => {
    const mockFetch = vi.fn()
    globalThis.fetch = mockFetch

    const res1 = await userService.searchUsers('')
    const res2 = await userService.searchUsers('   ')

    expect(mockFetch).not.toHaveBeenCalled()
    expect(res1).toEqual([])
    expect(res2).toEqual([])
  })

  it('searchUsers sends GET to /api/v1/users/search with correctly encoded query and returns user data', async () => {
    const mockUsers: UserSearchResult[] = [
      {
        id: 'usr-1',
        username: 'alice_smith',
        email: 'alice@example.com',
        role: 'user',
        language: 'en',
        isActive: true,
        isBlocked: false,
        registrationDate: '2026-01-10T08:00:00Z',
      },
      {
        id: 'usr-2',
        username: 'alice_jones',
        email: 'alice.jones+test@example.com',
        role: 'Admin',
        language: 'de',
        isActive: true,
        isBlocked: false,
        registrationDate: '2026-02-14T09:30:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockUsers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const token = 'token-user-search'
    const client = createApiClient(token)
    const result = await userService.searchUsers('alice smith', client)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0]
    expect(calledUrl).toContain('/api/v1/users/search?q=alice+smith')
    expect(calledOptions.method).toBe('GET')

    const headers = new Headers(calledOptions.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
    expect(result).toEqual(mockUsers)
  })

  it('searchUsers includes limit parameter when provided', async () => {
    const mockUsers: UserSearchResult[] = [
      {
        id: 'usr-1',
        username: 'bob',
        email: 'bob@example.com',
        role: 'user',
        language: 'en',
        isActive: true,
        isBlocked: false,
        registrationDate: '2026-03-01T10:00:00Z',
      },
    ]

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockUsers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    const result = await userService.searchUsers('bob', 5)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockFetch.mock.calls[0]
    const parsedUrl = new URL(calledUrl)
    expect(parsedUrl.pathname).toBe('/api/v1/users/search')
    expect(parsedUrl.searchParams.get('q')).toBe('bob')
    expect(parsedUrl.searchParams.get('limit')).toBe('5')
    expect(result).toEqual(mockUsers)
  })

  it('searchUsers encodes special characters and symbols in search query', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await userService.searchUsers('john+doe@example.com & co')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockFetch.mock.calls[0]
    const parsedUrl = new URL(calledUrl)
    expect(parsedUrl.searchParams.get('q')).toBe('john+doe@example.com & co')
  })

  it('passes AbortSignal to the underlying fetch call', async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await userService.searchUsers('test', 10, undefined, controller.signal)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, calledOptions] = mockFetch.mock.calls[0]
    expect(calledOptions.signal).toBe(controller.signal)
  })

  it('propagates ApiError on failed upstream search', async () => {
    const errorBody = {
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'failed to search users from gmhelper-api',
      },
    }

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    globalThis.fetch = mockFetch

    await expect(userService.searchUsers('failing_query')).rejects.toThrow(ApiError)
  })
})
