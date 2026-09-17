import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { UserSearchResult } from '../types/user'

export type { UserSearchResult } from '../types/user'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
}

export interface UserService {
  searchUsers(
    query: string,
    limit?: number,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<UserSearchResult[]>
  searchUsers(
    query: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<UserSearchResult[]>
}

export const userService: UserService = {
  async searchUsers(
    query: string,
    limitOrClient?: number | ApiClient,
    clientOrSignal?: ApiClient | AbortSignal,
    maybeSignal?: AbortSignal
  ): Promise<UserSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    let limit: number | undefined
    let client: ApiClient = apiClient
    let signal: AbortSignal | undefined

    if (typeof limitOrClient === 'number') {
      limit = limitOrClient
      if (clientOrSignal && typeof (clientOrSignal as ApiClient).get === 'function') {
        client = clientOrSignal as ApiClient
      } else if (clientOrSignal instanceof AbortSignal) {
        signal = clientOrSignal
      }
      if (maybeSignal instanceof AbortSignal) {
        signal = maybeSignal
      }
    } else if (limitOrClient && typeof (limitOrClient as ApiClient).get === 'function') {
      client = limitOrClient as ApiClient
      if (clientOrSignal instanceof AbortSignal) {
        signal = clientOrSignal
      }
    } else if (limitOrClient instanceof AbortSignal) {
      signal = limitOrClient
    }

    return client.get<UserSearchResult[]>('/api/v1/users/search', {
      params: {
        q: trimmed,
        ...(typeof limit === 'number' && limit > 0 ? { limit } : {}),
      },
      signal,
    })
  },
}
