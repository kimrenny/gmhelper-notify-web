// Schedule Configuration
export type ScheduleType = 'daily' | 'weekly' | 'interval_hours'

export interface DailyScheduleConfig {
  type: 'daily'
  hourUtc: number
  minuteUtc: number
}

export interface WeeklyScheduleConfig {
  type: 'weekly'
  hourUtc: number
  minuteUtc: number
  dayOfWeek: number
}

export interface IntervalHoursScheduleConfig {
  type: 'interval_hours'
  intervalHours: number
}

export type ScheduleConfig =
  | DailyScheduleConfig
  | WeeklyScheduleConfig
  | IntervalHoursScheduleConfig

// Supported Condition Fields (v1)
export type ConditionField =
  | 'isBlocked'
  | 'isActive'
  | 'email'
  | 'language'
  | 'role'
  | 'username'
  | 'registrationDate'
  | 'lastActivityAt'

// Condition Operators
export type BooleanConditionOperator = 'equals' | 'not_equals'
export type EnumConditionOperator = 'equals' | 'not_equals' | 'in' | 'not_in'
export type TextConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'exists'
  | 'not_exists'
export type DateConditionOperator = 'older_than' | 'newer_than' | 'before' | 'after'
export type DateRelativeUnit = 'days' | 'months' | 'years'

export type ConditionOperator =
  | BooleanConditionOperator
  | EnumConditionOperator
  | TextConditionOperator
  | DateConditionOperator

// Strongly typed Condition Items by Field & Operator
export interface BooleanConditionItem {
  field: 'isBlocked' | 'isActive'
  operator: BooleanConditionOperator
  value: boolean
  unit?: never
}

export interface EnumScalarConditionItem {
  field: 'language' | 'role'
  operator: 'equals' | 'not_equals'
  value: string
  unit?: never
}

export interface EnumListConditionItem {
  field: 'language' | 'role'
  operator: 'in' | 'not_in'
  value: string[]
  unit?: never
}

export interface TextValuedConditionItem {
  field: 'email' | 'username'
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with'
  value: string
  unit?: never
}

export interface TextExistenceConditionItem {
  field: 'email' | 'username'
  operator: 'exists' | 'not_exists'
  value?: never
  unit?: never
}

export interface DateRelativeConditionItem {
  field: 'registrationDate' | 'lastActivityAt'
  operator: 'older_than' | 'newer_than'
  value: number
  unit: DateRelativeUnit
}

export interface DateAbsoluteConditionItem {
  field: 'registrationDate' | 'lastActivityAt'
  operator: 'before' | 'after'
  value: string
  unit?: never
}

export type ConditionItem =
  | BooleanConditionItem
  | EnumScalarConditionItem
  | EnumListConditionItem
  | TextValuedConditionItem
  | TextExistenceConditionItem
  | DateRelativeConditionItem
  | DateAbsoluteConditionItem

// Group Operators and Tree Structure
export type ConditionGroupOperator = 'all' | 'any'

export type ConditionNode = ConditionItem | ConditionGroup

export interface ConditionGroup {
  operator: ConditionGroupOperator
  conditions: ConditionNode[]
}

// Action Configuration (templateId is kept outside config as rule-level property)
export type ActionType = 'send_email'

export interface ActionConfig {
  type: ActionType
  cooldownDays?: number
}

// Root Versioned Configuration AST
export interface AutomationRuleConfig {
  version: number
  schedule: ScheduleConfig
  conditions: ConditionGroup
  action: ActionConfig
}

// Full Automation Rule Entity
export interface AutomationRule {
  id: string
  name: string
  templateId: string
  enabled: boolean
  config: AutomationRuleConfig
  lastEvaluatedAt?: string | null
  nextEvaluationAt?: string | null
  createdAt: string
  updatedAt: string
}

// API DTOs
export interface CreateAutomationRuleInput {
  name: string
  templateId: string
  enabled?: boolean
  config: AutomationRuleConfig
}

export interface UpdateAutomationRuleInput {
  name?: string
  templateId?: string
  enabled?: boolean
  config?: AutomationRuleConfig
}
