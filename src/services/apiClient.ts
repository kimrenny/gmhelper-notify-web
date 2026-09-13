import type { ApiClient, ApiErrorPayload, RequestOptions } from '../types/api'

export const NOTIFY_API_BASE_URL = (
  import.meta.env.VITE_NOTIFY_API_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8080'
).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly isUnauthorized: boolean
  readonly isForbidden: boolean
  readonly isNetworkError: boolean
  readonly details?: unknown

  get statusCode(): number {
    return this.status
  }

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.isUnauthorized = status === 401
    this.isForbidden = status === 403
    this.isNetworkError = status === 0 || code === 'NETWORK_ERROR'
  }
}

export function buildUrl(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const rawUrl = `${baseUrl}${normalizedEndpoint}`

  if (!params) {
    return rawUrl
  }

  const url = new URL(rawUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  }

  return url.toString()
}

export async function request<T>(
  endpoint: string,
  options?: RequestOptions,
  baseUrl: string = NOTIFY_API_BASE_URL
): Promise<T> {
  const url = buildUrl(baseUrl, endpoint, options?.params)
  const headers = new Headers(options?.headers)

  const token = options?.accessToken
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let body: BodyInit | undefined
  if (options?.body !== undefined && options?.body !== null) {
    if (
      typeof options.body === 'string' ||
      options.body instanceof FormData ||
      options.body instanceof Blob ||
      options.body instanceof ArrayBuffer
    ) {
      body = options.body as BodyInit
    } else {
      body = JSON.stringify(options.body)
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body,
  }

  let response: Response
  try {
    response = await fetch(url, fetchOptions)
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Network connection error'
    throw new ApiError(message, 0, 'NETWORK_ERROR')
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    let errorCode: string | undefined
    let errorDetails: unknown

    try {
      const errorData = (await response.json()) as ApiErrorPayload
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message
        errorCode = errorData.error.code
        errorDetails = errorData.error.details
      } else if (errorData?.message) {
        errorMessage = errorData.message
        errorCode = errorData.code
      }
    } catch {
      // Response body was not JSON
    }

    throw new ApiError(errorMessage, response.status, errorCode, errorDetails)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as unknown as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export function createApiClient(
  defaultAccessToken?: string | null,
  baseUrl: string = NOTIFY_API_BASE_URL
): ApiClient {
  return {
    request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
      const mergedOptions: RequestOptions = {
        ...options,
        accessToken: options?.accessToken !== undefined ? options.accessToken : defaultAccessToken,
      }
      return request<T>(endpoint, mergedOptions, baseUrl)
    },

    get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'GET' })
    },

    post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'POST', body })
    },

    put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'PUT', body })
    },

    patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
    },

    delete<T = void>(endpoint: string, options?: RequestOptions): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'DELETE' })
    },
  }
}

export const apiClient: ApiClient = createApiClient()
