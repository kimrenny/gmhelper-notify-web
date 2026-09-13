import { useMemo } from 'react'
import { createApiClient } from '../services/apiClient'
import type { ApiClient } from '../types/api'
import { useAuth } from './useAuth'

export function useApiClient(): ApiClient {
  const { accessToken } = useAuth()

  return useMemo(() => {
    return createApiClient(accessToken)
  }, [accessToken])
}
