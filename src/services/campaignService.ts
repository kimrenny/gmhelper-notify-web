export interface Campaign {
  id: string
  name: string
  status: string
  createdAt: string
}

export interface CampaignService {
  getCampaigns(): Promise<Campaign[]>
  getCampaign(id: string): Promise<Campaign | null>
  createCampaign(data: Partial<Campaign>): Promise<Campaign>
  updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign>
  deleteCampaign(id: string): Promise<void>
}

export const campaignService: CampaignService = {
  async getCampaigns() {
    return [
      { id: '1', name: 'Welcome campaign', status: 'Active', createdAt: '2026-07-01' },
      { id: '2', name: 'Reactivation campaign', status: 'Draft', createdAt: '2026-07-15' },
    ]
  },

  async getCampaign(id: string) {
    return {
      id,
      name: 'Sample campaign',
      status: 'Active',
      createdAt: '2026-07-20',
    }
  },

  async createCampaign(data) {
    return {
      id: 'new-campaign',
      name: data.name ?? 'New campaign',
      status: data.status ?? 'Draft',
      createdAt: '2026-07-28',
    }
  },

  async updateCampaign(id, data) {
    return {
      id,
      name: data.name ?? 'Updated campaign',
      status: data.status ?? 'Active',
      createdAt: '2026-07-28',
    }
  },

  async deleteCampaign() {
    return undefined
  },
}
