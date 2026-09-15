import type { CampaignStatus } from './campaign'

export interface DashboardCampaignStats {
  total: number
  draft: number
  scheduled: number
  running: number
  sending: number
  completed: number
  partiallyFailed: number
  failed: number
  cancelled: number
}

export interface DashboardTemplateStats {
  total: number
  draft: number
  active: number
  archived: number
}

export interface DashboardDeliveryStats {
  totalMessages: number
  totalSent: number
  totalFailed: number
  totalPending: number
  totalSending: number
  successRate: number
}

export interface RecentCampaignItem {
  id: string
  name: string
  templateId?: string
  templateName?: string
  campaignType?: string
  status: CampaignStatus
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface DashboardStats {
  campaigns: DashboardCampaignStats
  templates: DashboardTemplateStats
  deliveries: DashboardDeliveryStats
  recentCampaigns: RecentCampaignItem[]
}
