export interface ApiErrorDetail {
  code?: string
  message: string
  details?: unknown
}

export interface ApiErrorPayload {
  error?: ApiErrorDetail
  message?: string
  code?: string
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  accessToken?: string | null
  body?: unknown
  params?: Record<string, string | number | boolean | undefined | null>
}

export interface ApiClient {
  request<T>(endpoint: string, options?: RequestOptions): Promise<T>
  get<T>(endpoint: string, options?: RequestOptions): Promise<T>
  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>
  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T = void>(endpoint: string, options?: RequestOptions): Promise<T>
}
