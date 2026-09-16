import { apiClient } from './apiClient'
import type { ApiClient } from '../types/api'
import type {
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../types/automation'

export type {
  ScheduleType,
  DailyScheduleConfig,
  WeeklyScheduleConfig,
  IntervalHoursScheduleConfig,
  ScheduleConfig,
  ConditionField,
  BooleanConditionOperator,
  EnumConditionOperator,
  TextConditionOperator,
  DateConditionOperator,
  DateRelativeUnit,
  ConditionOperator,
  BooleanConditionItem,
  EnumScalarConditionItem,
  EnumListConditionItem,
  TextValuedConditionItem,
  TextExistenceConditionItem,
  DateRelativeConditionItem,
  DateAbsoluteConditionItem,
  ConditionItem,
  ConditionGroupOperator,
  ConditionNode,
  ConditionGroup,
  ActionType,
  ActionConfig,
  AutomationRuleConfig,
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../types/automation'

export interface AutomationService {
  getRules(client?: ApiClient, signal?: AbortSignal): Promise<AutomationRule[]>
  getRule(id: string, client?: ApiClient, signal?: AbortSignal): Promise<AutomationRule>
  createRule(data: CreateAutomationRuleInput, client?: ApiClient, signal?: AbortSignal): Promise<AutomationRule>
  updateRule(id: string, data: UpdateAutomationRuleInput, client?: ApiClient, signal?: AbortSignal): Promise<AutomationRule>
  deleteRule(id: string, client?: ApiClient, signal?: AbortSignal): Promise<void>
}

export const automationService: AutomationService = {
  async getRules(client: ApiClient = apiClient, signal?: AbortSignal): Promise<AutomationRule[]> {
    return client.get<AutomationRule[]>('/api/v1/automation/rules', { signal })
  },

  async getRule(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<AutomationRule> {
    return client.get<AutomationRule>(`/api/v1/automation/rules/${encodeURIComponent(id)}`, { signal })
  },

  async createRule(
    data: CreateAutomationRuleInput,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<AutomationRule> {
    return client.post<AutomationRule>('/api/v1/automation/rules', data, { signal })
  },

  async updateRule(
    id: string,
    data: UpdateAutomationRuleInput,
    client: ApiClient = apiClient,
    signal?: AbortSignal
  ): Promise<AutomationRule> {
    return client.put<AutomationRule>(`/api/v1/automation/rules/${encodeURIComponent(id)}`, data, { signal })
  },

  async deleteRule(id: string, client: ApiClient = apiClient, signal?: AbortSignal): Promise<void> {
    return client.delete<void>(`/api/v1/automation/rules/${encodeURIComponent(id)}`, { signal })
  },
}
