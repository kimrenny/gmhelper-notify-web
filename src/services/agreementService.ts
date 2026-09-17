import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type { Campaign } from '../types/campaign'
import type { CreateAgreementBroadcastInput } from '../types/agreement'

export type {
  AgreementBroadcastResponse,
  CreateAgreementBroadcastInput,
} from '../types/agreement'

export interface AgreementService {
  createBroadcast(
    input: CreateAgreementBroadcastInput,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<Campaign>
  createBroadcast(
    templateId: string,
    name?: string,
    client?: ApiClient,
    signal?: AbortSignal
  ): Promise<Campaign>
}

export const agreementService: AgreementService = {
  async createBroadcast(
    inputOrTemplateId: CreateAgreementBroadcastInput | string,
    nameOrClient?: string | ApiClient,
    clientOrSignal?: ApiClient | AbortSignal,
    maybeSignal?: AbortSignal
  ): Promise<Campaign> {
    let payload: CreateAgreementBroadcastInput
    let client: ApiClient = apiClient
    let signal: AbortSignal | undefined

    if (typeof inputOrTemplateId === 'string') {
      const templateId = inputOrTemplateId
      let name: string | undefined

      if (typeof nameOrClient === 'string') {
        name = nameOrClient
        if (clientOrSignal && typeof (clientOrSignal as ApiClient).post === 'function') {
          client = clientOrSignal as ApiClient
          signal = maybeSignal
        } else if (clientOrSignal instanceof AbortSignal) {
          signal = clientOrSignal
        }
      } else if (nameOrClient && typeof (nameOrClient as ApiClient).post === 'function') {
        client = nameOrClient as ApiClient
        if (clientOrSignal instanceof AbortSignal) {
          signal = clientOrSignal
        }
      } else if (nameOrClient instanceof AbortSignal) {
        signal = nameOrClient
      }

      payload = name !== undefined && name !== '' ? { templateId, name } : { templateId }
    } else {
      payload =
        inputOrTemplateId.name !== undefined && inputOrTemplateId.name !== ''
          ? { templateId: inputOrTemplateId.templateId, name: inputOrTemplateId.name }
          : { templateId: inputOrTemplateId.templateId }

      if (nameOrClient && typeof (nameOrClient as ApiClient).post === 'function') {
        client = nameOrClient as ApiClient
        if (clientOrSignal instanceof AbortSignal) {
          signal = clientOrSignal
        }
      } else if (nameOrClient instanceof AbortSignal) {
        signal = nameOrClient
      } else if (clientOrSignal instanceof AbortSignal) {
        signal = clientOrSignal
      }
    }

    return client.post<Campaign>('/api/v1/agreements/broadcast', payload, { signal })
  },
}
