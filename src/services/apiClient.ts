const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  statusCode: number
  code?: string

  constructor(message: string, statusCode: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

export async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${API_BASE_URL}${normalizedEndpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`
      let errorCode: string | undefined

      try {
        const errorData = await response.json()
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message
          errorCode = errorData.error.code
        }
      } catch {
        // Response was not JSON
      }

      throw new ApiError(errorMessage, response.status, errorCode)
    }

    if (response.status === 204) {
      return undefined as unknown as T
    }

    return (await response.json()) as T
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Network connection error'
    throw new ApiError(message, 0, 'NETWORK_ERROR')
  }
}
