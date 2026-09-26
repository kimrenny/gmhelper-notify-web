export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'partially_failed'
  | 'failed'
  | 'cancelled'
  | string

export interface CampaignAudienceFilter {
  role?: string
  registrationDate?: string
  emailConfirmed?: string
  language?: string
  accountStatus?: string
}

export interface Campaign {
  id: string
  name: string
  templateId?: string
  campaignType?: string
  status: CampaignStatus
  audienceFilter?: CampaignAudienceFilter
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt?: string
}

export interface CreateCampaignInput {
  name: string
  templateId: string
  campaignType: string
  status?: CampaignStatus
  audienceFilter?: CampaignAudienceFilter
  scheduledAt?: string
}

export interface UpdateCampaignInput {
  name?: string
  templateId?: string
  campaignType?: string
  status?: CampaignStatus
  audienceFilter?: CampaignAudienceFilter
  scheduledAt?: string
}

export interface ScheduleCampaignInput {
  scheduledAt: string
}


