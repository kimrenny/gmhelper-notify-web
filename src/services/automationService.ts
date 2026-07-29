export interface AutomationRule {
  id: string
  name: string
  event: string
  enabled: boolean
}

export interface AutomationService {
  getRules(): Promise<AutomationRule[]>
  getRule(id: string): Promise<AutomationRule | null>
  createRule(data: Partial<AutomationRule>): Promise<AutomationRule>
  updateRule(id: string, data: Partial<AutomationRule>): Promise<AutomationRule>
  deleteRule(id: string): Promise<void>
}

export const automationService: AutomationService = {
  async getRules() {
    return [
      { id: '1', name: 'Welcome rule', event: 'User registered', enabled: true },
      { id: '2', name: 'Reactivation rule', event: 'User inactive', enabled: false },
    ]
  },

  async getRule(id: string) {
    return {
      id,
      name: 'Sample rule',
      event: 'Email confirmed',
      enabled: true,
    }
  },

  async createRule(data) {
    return {
      id: 'new-rule',
      name: data.name ?? 'New rule',
      event: data.event ?? 'User registered',
      enabled: data.enabled ?? true,
    }
  },

  async updateRule(id, data) {
    return {
      id,
      name: data.name ?? 'Updated rule',
      event: data.event ?? 'Password changed',
      enabled: data.enabled ?? true,
    }
  },

  async deleteRule() {
    return undefined
  },
}
