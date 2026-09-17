import type { Campaign } from './campaign'

export interface CreateAgreementBroadcastInput {
  templateId: string
  name?: string
}

export type AgreementBroadcastResponse = Campaign
