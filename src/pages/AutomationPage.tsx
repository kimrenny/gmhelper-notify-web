import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { ApiError, automationService, templateService } from '../services'
import type {
  ActionConfig,
  AutomationRule,
  AutomationRuleConfig,
  BooleanConditionOperator,
  ConditionField,
  ConditionGroup,
  ConditionGroupOperator,
  ConditionItem,
  ConditionNode,
  DateRelativeUnit,
  EmailTemplate,
  ScheduleConfig,
  ScheduleType,
} from '../types'
import { filterTemplatesByType } from '../utils'

interface ErrorInfo {
  type: 'unauthorized' | 'forbidden' | 'api' | 'network'
  message: string
}

interface RuleFormState {
  name: string
  templateId: string
  enabled: boolean
  scheduleType: ScheduleType
  scheduleHourUtc: number
  scheduleMinuteUtc: number
  scheduleDayOfWeek: number
  scheduleIntervalHours: number
  conditions: ConditionGroup
  cooldownDays: string
}

const FIELD_OPTIONS: Array<{ value: ConditionField; label: string }> = [
  { value: 'isActive', label: 'User is active (isActive)' },
  { value: 'isBlocked', label: 'User is blocked (isBlocked)' },
  { value: 'email', label: 'Email address (email)' },
  { value: 'username', label: 'Username (username)' },
  { value: 'language', label: 'Language (language)' },
  { value: 'role', label: 'User role (role)' },
  { value: 'registrationDate', label: 'Registration date (registrationDate)' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

function isConditionGroup(node: ConditionNode): node is ConditionGroup {
  return 'operator' in node && 'conditions' in node
}

function createDefaultConditionItem(field: ConditionField = 'isActive'): ConditionItem {
  switch (field) {
    case 'isBlocked':
    case 'isActive':
      return { field, operator: 'equals', value: true }
    case 'language':
    case 'role':
      return { field, operator: 'equals', value: '' }
    case 'email':
    case 'username':
      return { field, operator: 'exists' }
    case 'registrationDate':
      return { field, operator: 'older_than', value: 30, unit: 'days' }
  }
}

const initialFormState: RuleFormState = {
  name: '',
  templateId: '',
  enabled: true,
  scheduleType: 'daily',
  scheduleHourUtc: 3,
  scheduleMinuteUtc: 0,
  scheduleDayOfWeek: 1,
  scheduleIntervalHours: 24,
  conditions: {
    operator: 'all',
    conditions: [createDefaultConditionItem('isActive')],
  },
  cooldownDays: '',
}

function padTwo(num: number): string {
  return num < 10 ? `0${num}` : `${num}`
}

function formatScheduleSummary(schedule: ScheduleConfig): string {
  if (!schedule) return 'No schedule'
  switch (schedule.type) {
    case 'daily':
      return `Daily at ${padTwo(schedule.hourUtc)}:${padTwo(schedule.minuteUtc)} UTC`
    case 'weekly': {
      const dayName = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label || `Day ${schedule.dayOfWeek}`
      return `Weekly on ${dayName} at ${padTwo(schedule.hourUtc)}:${padTwo(schedule.minuteUtc)} UTC`
    }
    case 'interval_hours':
      return `Every ${schedule.intervalHours} hour${schedule.intervalHours === 1 ? '' : 's'}`
    default:
      return 'Custom schedule'
  }
}

function countLeafConditions(group: ConditionGroup): number {
  let count = 0
  for (const cond of group.conditions) {
    if (isConditionGroup(cond)) {
      count += countLeafConditions(cond)
    } else {
      count++
    }
  }
  return count
}

function formatConditionsSummary(group: ConditionGroup): string {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return 'No conditions'
  }
  const total = countLeafConditions(group)
  const opLabel = group.operator === 'any' ? 'Match ANY' : 'Match ALL'
  return `${opLabel} (${total} criteria)`
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getEnabledBadgeStyle(enabled: boolean) {
  if (enabled) {
    return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
  }
  return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }
}

function updateGroupAtPath(
  root: ConditionGroup,
  path: number[],
  fn: (g: ConditionGroup) => ConditionGroup
): ConditionGroup {
  if (path.length === 0) {
    return fn(root)
  }
  const [head, ...rest] = path
  return {
    ...root,
    conditions: root.conditions.map((child, idx) => {
      if (idx !== head) return child
      if (isConditionGroup(child)) {
        return updateGroupAtPath(child, rest, fn)
      }
      return child
    }),
  }
}

function ruleToFormState(rule: AutomationRule): RuleFormState {
  const cfg = rule.config
  const sched = cfg?.schedule
  const scheduleType: ScheduleType = sched?.type || 'daily'
  const scheduleHourUtc = sched && 'hourUtc' in sched ? sched.hourUtc : 3
  const scheduleMinuteUtc = sched && 'minuteUtc' in sched ? sched.minuteUtc : 0
  const scheduleDayOfWeek = sched && 'dayOfWeek' in sched ? sched.dayOfWeek : 1
  const scheduleIntervalHours = sched && 'intervalHours' in sched ? sched.intervalHours : 24

  const cooldownDays =
    cfg?.action?.cooldownDays !== undefined && cfg.action.cooldownDays !== null
      ? String(cfg.action.cooldownDays)
      : ''

  return {
    name: rule.name || '',
    templateId: rule.templateId || '',
    enabled: rule.enabled ?? true,
    scheduleType,
    scheduleHourUtc,
    scheduleMinuteUtc,
    scheduleDayOfWeek,
    scheduleIntervalHours,
    conditions: cfg?.conditions || {
      operator: 'all',
      conditions: [createDefaultConditionItem('isActive')],
    },
    cooldownDays,
  }
}

function validateConditionsTree(group: ConditionGroup): string | null {
  if (!group.conditions || group.conditions.length === 0) {
    return 'Every condition group must contain at least one condition.'
  }
  for (const node of group.conditions) {
    if (isConditionGroup(node)) {
      const err = validateConditionsTree(node)
      if (err) return err
    } else {
      const item = node as unknown as Record<string, unknown>
      const field = item.field as string
      const operator = item.operator as string
      const value = item.value

      if (field === 'isBlocked' || field === 'isActive') {
        if (typeof value !== 'boolean') {
          return `Field "${field}" requires a true/false selection.`
        }
      } else if (field === 'email' || field === 'username') {
        if (operator !== 'exists' && operator !== 'not_exists') {
          if (typeof value !== 'string' || !value.trim()) {
            return `Please enter a value for "${field}".`
          }
        }
      } else if (field === 'language' || field === 'role') {
        if (operator === 'in' || operator === 'not_in') {
          if (!Array.isArray(value) || value.length === 0) {
            return `Please provide at least one value for "${field}".`
          }
        } else {
          if (typeof value !== 'string' || !value.trim()) {
            return `Please enter a value for "${field}".`
          }
        }
      } else if (field === 'registrationDate') {
        if (operator === 'older_than' || operator === 'newer_than') {
          if (typeof value !== 'number' || isNaN(value) || value <= 0) {
            return 'Registration date relative duration must be a positive number.'
          }
          const unit = item.unit as string | undefined
          if (!unit || !['days', 'months', 'years'].includes(unit)) {
            return 'Please select a valid time unit (days, months, or years).'
          }
        } else if (operator === 'before' || operator === 'after') {
          if (typeof value !== 'string' || !value.trim()) {
            return 'Please select or enter a date.'
          }
        }
      }
    }
  }
  return null
}

function AutomationPage() {
  const apiClient = useApiClient()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)

  // Rule Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [isLoadingRule, setIsLoadingRule] = useState(false)
  const [formData, setFormData] = useState<RuleFormState>(initialFormState)
  const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete State
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Quick Toggle State
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null)

  const loadRules = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await automationService.getRules(apiClient, signal)
        setRules(data ?? [])
      } catch (err) {
        if (signal?.aborted) return

        if (err instanceof ApiError) {
          if (err.isUnauthorized || err.statusCode === 401) {
            setError({
              type: 'unauthorized',
              message: 'You do not have access to automation rules. Please verify your authentication.',
            })
          } else if (err.isForbidden || err.statusCode === 403) {
            setError({
              type: 'forbidden',
              message: 'You do not have permission to access automation rules.',
            })
          } else if (err.isNetworkError || err.statusCode === 0) {
            setError({
              type: 'network',
              message: err.message || 'Network connection lost.',
            })
          } else {
            setError({
              type: 'api',
              message: err.message || 'Failed to load automation rules.',
            })
          }
        } else {
          const message = err instanceof Error ? err.message : 'An unexpected error occurred while loading automation rules.'
          setError({ type: 'network', message })
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [apiClient]
  )

  const loadTemplates = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await templateService.getTemplates(apiClient, signal)
        const automationTemplates = filterTemplatesByType(data, 'automation')
        setTemplates(automationTemplates)
      } catch {
        // Non-blocking template loading
      }
    },
    [apiClient]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadRules(controller.signal)
    void loadTemplates(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadRules, loadTemplates])

  const openCreateForm = () => {
    if (isSubmitting || isLoadingRule) return
    setEditingRuleId(null)
    setFormData(initialFormState)
    setFormValidationErrors({})
    setFormError(null)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSubmitting || isLoadingRule) return
    setIsFormOpen(false)
    setEditingRuleId(null)
    setFormData(initialFormState)
    setFormValidationErrors({})
    setFormError(null)
  }

  const openEditForm = async (rule: AutomationRule) => {
    if (isSubmitting || isLoadingRule) return
    setIsFormOpen(true)
    setEditingRuleId(rule.id)
    setFormError(null)
    setFormValidationErrors({})

    // Populate with existing rule data immediately
    setFormData(ruleToFormState(rule))

    // Fetch fresh details by ID
    setIsLoadingRule(true)
    try {
      const freshRule = await automationService.getRule(rule.id, apiClient)
      setFormData(ruleToFormState(freshRule))
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setFormError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setFormError('Forbidden (403): You do not have permission to view this rule.')
        } else {
          setFormError(err.message || 'Failed to load rule details.')
        }
      } else {
        setFormError('An unexpected error occurred while loading rule details.')
      }
    } finally {
      setIsLoadingRule(false)
    }
  }

  // Condition Tree Operations
  const handleGroupOperatorChange = (path: number[], operator: ConditionGroupOperator) => {
    setFormData((prev) => ({
      ...prev,
      conditions: updateGroupAtPath(prev.conditions, path, (g) => ({ ...g, operator })),
    }))
  }

  const handleAddCondition = (path: number[]) => {
    setFormData((prev) => ({
      ...prev,
      conditions: updateGroupAtPath(prev.conditions, path, (g) => ({
        ...g,
        conditions: [...g.conditions, createDefaultConditionItem('isActive')],
      })),
    }))
  }

  const handleAddGroup = (path: number[]) => {
    setFormData((prev) => ({
      ...prev,
      conditions: updateGroupAtPath(prev.conditions, path, (g) => ({
        ...g,
        conditions: [
          ...g.conditions,
          {
            operator: 'any',
            conditions: [createDefaultConditionItem('language')],
          },
        ],
      })),
    }))
  }

  const handleRemoveNode = (path: number[], childIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: updateGroupAtPath(prev.conditions, path, (g) => ({
        ...g,
        conditions: g.conditions.filter((_, idx) => idx !== childIndex),
      })),
    }))
  }

  const handleUpdateConditionItem = (path: number[], childIndex: number, item: ConditionItem) => {
    setFormData((prev) => ({
      ...prev,
      conditions: updateGroupAtPath(prev.conditions, path, (g) => ({
        ...g,
        conditions: g.conditions.map((child, idx) => (idx === childIndex ? item : child)),
      })),
    }))
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) {
      errors.name = 'Rule name is required'
    }
    if (!formData.templateId.trim()) {
      errors.templateId = 'Please select an email template'
    }

    // Schedule validation
    if (formData.scheduleType === 'daily' || formData.scheduleType === 'weekly') {
      if (formData.scheduleHourUtc < 0 || formData.scheduleHourUtc > 23 || isNaN(formData.scheduleHourUtc)) {
        errors.schedule = 'Hour must be between 0 and 23 UTC'
      }
      if (formData.scheduleMinuteUtc < 0 || formData.scheduleMinuteUtc > 59 || isNaN(formData.scheduleMinuteUtc)) {
        errors.schedule = 'Minute must be between 0 and 59 UTC'
      }
    }
    if (formData.scheduleType === 'weekly') {
      if (formData.scheduleDayOfWeek < 0 || formData.scheduleDayOfWeek > 6 || isNaN(formData.scheduleDayOfWeek)) {
        errors.schedule = 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
      }
    }
    if (formData.scheduleType === 'interval_hours') {
      if (formData.scheduleIntervalHours < 1 || formData.scheduleIntervalHours > 168 || isNaN(formData.scheduleIntervalHours)) {
        errors.schedule = 'Interval hours must be between 1 and 168 hours'
      }
    }

    // Cooldown validation
    if (formData.cooldownDays.trim() !== '') {
      const cd = Number(formData.cooldownDays.trim())
      if (isNaN(cd) || cd < 0 || !Number.isInteger(cd)) {
        errors.cooldownDays = 'Cooldown must be a non-negative integer (days)'
      }
    }

    // Condition tree validation
    const treeErr = validateConditionsTree(formData.conditions)
    if (treeErr) {
      errors.conditions = treeErr
    }

    setFormValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting || isLoadingRule) return
    if (!validateForm()) return

    setIsSubmitting(true)
    setFormError(null)

    const schedule: ScheduleConfig =
      formData.scheduleType === 'daily'
        ? {
            type: 'daily',
            hourUtc: Number(formData.scheduleHourUtc),
            minuteUtc: Number(formData.scheduleMinuteUtc),
          }
        : formData.scheduleType === 'weekly'
          ? {
              type: 'weekly',
              dayOfWeek: Number(formData.scheduleDayOfWeek),
              hourUtc: Number(formData.scheduleHourUtc),
              minuteUtc: Number(formData.scheduleMinuteUtc),
            }
          : {
              type: 'interval_hours',
              intervalHours: Number(formData.scheduleIntervalHours),
            }

    const cooldownNum = formData.cooldownDays.trim() !== '' ? Number(formData.cooldownDays.trim()) : undefined

    const action: ActionConfig = {
      type: 'send_email',
      ...(cooldownNum !== undefined && !isNaN(cooldownNum) ? { cooldownDays: cooldownNum } : {}),
    }

    const config: AutomationRuleConfig = {
      version: 1,
      schedule,
      conditions: formData.conditions,
      action,
    }

    try {
      if (editingRuleId) {
        const updated = await automationService.updateRule(
          editingRuleId,
          {
            name: formData.name.trim(),
            templateId: formData.templateId.trim(),
            enabled: formData.enabled,
            config,
          },
          apiClient
        )
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } else {
        const created = await automationService.createRule(
          {
            name: formData.name.trim(),
            templateId: formData.templateId.trim(),
            enabled: formData.enabled,
            config,
          },
          apiClient
        )
        setRules((prev) => [created, ...prev])
      }

      setIsFormOpen(false)
      setEditingRuleId(null)
      setFormData(initialFormState)
      setFormValidationErrors({})
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setFormError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setFormError(
            editingRuleId
              ? 'Forbidden (403): You do not have permission to modify automation rules.'
              : 'Forbidden (403): You do not have permission to create automation rules.'
          )
        } else if (err.statusCode === 400) {
          setFormError(`Validation error: ${err.message}`)
        } else {
          setFormError(
            err.message ||
              (editingRuleId
                ? 'Failed to update automation rule. Please try again.'
                : 'Failed to create automation rule. Please try again.')
          )
        }
      } else {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving the rule.'
        setFormError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleRule = async (rule: AutomationRule) => {
    if (togglingRuleId || isSubmitting || isLoadingRule || isDeleting) return

    setTogglingRuleId(rule.id)
    try {
      const updated = await automationService.updateRule(
        rule.id,
        { enabled: !rule.enabled },
        apiClient
      )
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setError({
            type: 'unauthorized',
            message: 'Unauthorized (401): Session expired or invalid.',
          })
        } else if (err.isForbidden || err.statusCode === 403) {
          setError({
            type: 'forbidden',
            message: 'Forbidden (403): You do not have permission to modify automation rules.',
          })
        } else {
          setError({
            type: 'api',
            message: err.message || 'Failed to update rule status.',
          })
        }
      } else {
        setError({
          type: 'network',
          message: 'Network error occurred while updating rule status.',
        })
      }
    } finally {
      setTogglingRuleId(null)
    }
  }

  const promptDelete = (rule: AutomationRule) => {
    setRuleToDelete(rule)
    setDeleteError(null)
  }

  const cancelDelete = () => {
    if (isDeleting) return
    setRuleToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!ruleToDelete || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await automationService.deleteRule(ruleToDelete.id, apiClient)
      if (editingRuleId === ruleToDelete.id) {
        setIsFormOpen(false)
        setEditingRuleId(null)
        setFormData(initialFormState)
        setFormValidationErrors({})
        setFormError(null)
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id))
      setRuleToDelete(null)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized || err.statusCode === 401) {
          setDeleteError('Unauthorized (401): Session expired or invalid.')
        } else if (err.isForbidden || err.statusCode === 403) {
          setDeleteError('Forbidden (403): You do not have permission to delete automation rules.')
        } else if (err.statusCode === 404) {
          setDeleteError('Automation rule not found. It may have already been deleted.')
          setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id))
        } else {
          setDeleteError(err.message || 'Failed to delete automation rule.')
        }
      } else {
        setDeleteError('Network error occurred while deleting the automation rule.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Recursive Condition Group Component
  const renderConditionGroup = (group: ConditionGroup, path: number[] = [], isRoot = false) => {
    return (
      <div
        key={`group-${path.join('-')}`}
        style={{
          background: isRoot ? 'rgba(0, 0, 0, 0.2)' : 'rgba(170, 59, 255, 0.05)',
          border: isRoot ? '1px solid rgba(255, 255, 255, 0.1)' : '1px dashed rgba(170, 59, 255, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
              {isRoot ? 'Conditions match rule:' : 'Nested match rule:'}
            </span>
            <select
              className="gm-admin-select"
              style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              value={group.operator}
              onChange={(e) => handleGroupOperatorChange(path, e.target.value as ConditionGroupOperator)}
              disabled={isSubmitting || isLoadingRule}
              data-testid={`group-operator-select-${path.join('-') || 'root'}`}
            >
              <option value="all">Match ALL conditions</option>
              <option value="any">Match ANY condition</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="gm-admin-btn"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              onClick={() => handleAddCondition(path)}
              disabled={isSubmitting || isLoadingRule}
              data-testid={`add-condition-btn-${path.join('-') || 'root'}`}
            >
              + Add condition
            </button>
            <button
              type="button"
              className="gm-admin-btn"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              onClick={() => handleAddGroup(path)}
              disabled={isSubmitting || isLoadingRule}
              data-testid={`add-group-btn-${path.join('-') || 'root'}`}
            >
              + Add group
            </button>
            {!isRoot && (
              <button
                type="button"
                className="gm-admin-btn"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                onClick={() => {
                  const parentPath = path.slice(0, -1)
                  const childIndex = path[path.length - 1]
                  handleRemoveNode(parentPath, childIndex)
                }}
                disabled={isSubmitting || isLoadingRule}
                data-testid={`remove-group-btn-${path.join('-')}`}
              >
                Remove group
              </button>
            )}
          </div>
        </div>

        {group.conditions.length === 0 ? (
          <div style={{ padding: '0.75rem', color: '#f87171', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px' }}>
            This group has no conditions. Click "+ Add condition" to add one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {group.conditions.map((node, index) => {
              if (isConditionGroup(node)) {
                return renderConditionGroup(node, [...path, index], false)
              }
              return renderConditionItem(node, path, index)
            })}
          </div>
        )}
      </div>
    )
  }

  // Single Condition Item Component
  const renderConditionItem = (item: ConditionItem, groupPath: number[], itemIndex: number) => {
    const pathKey = `${groupPath.join('-') || 'root'}-${itemIndex}`

    const onFieldChange = (newField: ConditionField) => {
      handleUpdateConditionItem(groupPath, itemIndex, createDefaultConditionItem(newField))
    }

    const onOperatorChange = (newOp: string) => {
      if (item.field === 'isBlocked' || item.field === 'isActive') {
        handleUpdateConditionItem(groupPath, itemIndex, {
          field: item.field,
          operator: newOp as BooleanConditionOperator,
          value: typeof item.value === 'boolean' ? item.value : true,
        })
      } else if (item.field === 'email' || item.field === 'username') {
        if (newOp === 'exists' || newOp === 'not_exists') {
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp,
          })
        } else {
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp as 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with',
            value: typeof item.value === 'string' ? item.value : '',
          })
        }
      } else if (item.field === 'language' || item.field === 'role') {
        if (newOp === 'in' || newOp === 'not_in') {
          const listVal = Array.isArray(item.value)
            ? item.value
            : typeof item.value === 'string' && item.value.trim()
              ? [item.value.trim()]
              : []
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp,
            value: listVal,
          })
        } else {
          const scalarVal = typeof item.value === 'string' ? item.value : Array.isArray(item.value) ? item.value.join(', ') : ''
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp as 'equals' | 'not_equals',
            value: scalarVal,
          })
        }
      } else if (item.field === 'registrationDate') {
        if (newOp === 'older_than' || newOp === 'newer_than') {
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp,
            value: typeof item.value === 'number' ? item.value : 30,
            unit: (item.unit as DateRelativeUnit) || 'days',
          })
        } else {
          handleUpdateConditionItem(groupPath, itemIndex, {
            field: item.field,
            operator: newOp as 'before' | 'after',
            value: typeof item.value === 'string' ? item.value : '',
          })
        }
      }
    }

    return (
      <div
        key={`cond-${pathKey}`}
        data-testid={`condition-item-${pathKey}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '6px',
          padding: '0.6rem 0.8rem',
        }}
      >
        {/* Field Selector */}
        <select
          className="gm-admin-select"
          style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
          value={item.field}
          onChange={(e) => onFieldChange(e.target.value as ConditionField)}
          disabled={isSubmitting || isLoadingRule}
          data-testid={`condition-field-select-${pathKey}`}
        >
          {FIELD_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Operator Selector */}
        <select
          className="gm-admin-select"
          style={{ width: '150px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
          value={item.operator}
          onChange={(e) => onOperatorChange(e.target.value)}
          disabled={isSubmitting || isLoadingRule}
          data-testid={`condition-operator-select-${pathKey}`}
        >
          {item.field === 'isBlocked' || item.field === 'isActive' ? (
            <>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
            </>
          ) : item.field === 'email' || item.field === 'username' ? (
            <>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="starts_with">starts with</option>
              <option value="ends_with">ends with</option>
              <option value="exists">exists</option>
              <option value="not_exists">not exists</option>
            </>
          ) : item.field === 'language' || item.field === 'role' ? (
            <>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="in">in list</option>
              <option value="not_in">not in list</option>
            </>
          ) : item.field === 'registrationDate' ? (
            <>
              <option value="older_than">older than</option>
              <option value="newer_than">newer than</option>
              <option value="before">before date</option>
              <option value="after">after date</option>
            </>
          ) : null}
        </select>

        {/* Value Controls */}
        {item.field === 'isBlocked' || item.field === 'isActive' ? (
          <select
            className="gm-admin-select"
            style={{ width: '120px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            value={item.value ? 'true' : 'false'}
            onChange={(e) =>
              handleUpdateConditionItem(groupPath, itemIndex, {
                ...item,
                value: e.target.value === 'true',
              })
            }
            disabled={isSubmitting || isLoadingRule}
            data-testid={`condition-value-boolean-${pathKey}`}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : item.field === 'email' || item.field === 'username' ? (
          item.operator === 'exists' || item.operator === 'not_exists' ? (
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.4rem 0.5rem' }}>
              (No value needed)
            </span>
          ) : (
            <input
              type="text"
              className="gm-admin-input"
              style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              placeholder={`Enter ${item.field}`}
              value={typeof item.value === 'string' ? item.value : ''}
              onChange={(e) =>
                handleUpdateConditionItem(groupPath, itemIndex, {
                  ...item,
                  value: e.target.value,
                } as ConditionItem)
              }
              disabled={isSubmitting || isLoadingRule}
              data-testid={`condition-value-text-${pathKey}`}
            />
          )
        ) : item.field === 'language' || item.field === 'role' ? (
          item.operator === 'in' || item.operator === 'not_in' ? (
            <input
              type="text"
              className="gm-admin-input"
              style={{ width: '220px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              placeholder="Comma-separated e.g. EN, UA"
              value={Array.isArray(item.value) ? item.value.join(', ') : ''}
              onChange={(e) => {
                const parts = e.target.value
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
                handleUpdateConditionItem(groupPath, itemIndex, {
                  ...item,
                  value: parts,
                } as ConditionItem)
              }}
              disabled={isSubmitting || isLoadingRule}
              data-testid={`condition-value-list-${pathKey}`}
            />
          ) : (
            <input
              type="text"
              className="gm-admin-input"
              style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              placeholder={`Enter ${item.field}`}
              value={typeof item.value === 'string' ? item.value : ''}
              onChange={(e) =>
                handleUpdateConditionItem(groupPath, itemIndex, {
                  ...item,
                  value: e.target.value,
                } as ConditionItem)
              }
              disabled={isSubmitting || isLoadingRule}
              data-testid={`condition-value-scalar-${pathKey}`}
            />
          )
        ) : item.field === 'registrationDate' ? (
          item.operator === 'older_than' || item.operator === 'newer_than' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                min="1"
                className="gm-admin-input"
                style={{ width: '80px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={typeof item.value === 'number' ? item.value : 30}
                onChange={(e) =>
                  handleUpdateConditionItem(groupPath, itemIndex, {
                    ...item,
                    value: Number(e.target.value),
                  } as ConditionItem)
                }
                disabled={isSubmitting || isLoadingRule}
                data-testid={`condition-value-relative-number-${pathKey}`}
              />
              <select
                className="gm-admin-select"
                style={{ width: '100px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={item.unit || 'days'}
                onChange={(e) =>
                  handleUpdateConditionItem(groupPath, itemIndex, {
                    ...item,
                    unit: e.target.value as DateRelativeUnit,
                  } as ConditionItem)
                }
                disabled={isSubmitting || isLoadingRule}
                data-testid={`condition-value-relative-unit-${pathKey}`}
              >
                <option value="days">days</option>
                <option value="months">months</option>
                <option value="years">years</option>
              </select>
            </div>
          ) : (
            <input
              type="date"
              className="gm-admin-input"
              style={{ width: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              value={typeof item.value === 'string' ? item.value : ''}
              onChange={(e) =>
                handleUpdateConditionItem(groupPath, itemIndex, {
                  ...item,
                  value: e.target.value,
                } as ConditionItem)
              }
              disabled={isSubmitting || isLoadingRule}
              data-testid={`condition-value-date-${pathKey}`}
            />
          )
        ) : null}

        {/* Remove Button */}
        <button
          type="button"
          className="gm-admin-btn"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: '#f87171', marginLeft: 'auto' }}
          onClick={() => handleRemoveNode(groupPath, itemIndex)}
          disabled={isSubmitting || isLoadingRule}
          title="Remove condition"
          data-testid={`remove-condition-btn-${pathKey}`}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <section className="gm-admin-page">
      <div className="gm-admin-page__header">
        <div>
          <h1 className="gm-admin-page__title">Automation</h1>
          <p className="gm-admin-page__description">
            Schedule automatic evaluation of user conditions and send targeted notification emails.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            className="gm-admin-btn gm-admin-btn--primary"
            onClick={openCreateForm}
            disabled={isSubmitting || isLoadingRule}
            data-testid="create-rule-btn"
          >
            Create rule
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div
          className="gm-admin-warning"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            borderColor:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.4)'
                : error.type === 'unauthorized'
                  ? 'rgba(248, 113, 113, 0.4)'
                  : 'rgba(255, 0, 0, 0.2)',
            background:
              error.type === 'forbidden'
                ? 'rgba(234, 179, 8, 0.12)'
                : error.type === 'unauthorized'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(255, 0, 0, 0.12)',
            color: error.type === 'forbidden' ? '#fef08a' : '#ffd3d3',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <strong data-testid="error-title">
              {error.type === 'unauthorized' && 'Unauthorized (401)'}
              {error.type === 'forbidden' && 'Forbidden (403)'}
              {error.type === 'api' && 'Automation API Error'}
              {error.type === 'network' && 'Connection Error'}
            </strong>
            <span data-testid="error-message">{error.message}</span>
          </div>

          <button
            type="button"
            className="gm-admin-btn"
            onClick={() => void loadRules()}
            data-testid="retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Delete Confirmation Card */}
      {ruleToDelete && (
        <div
          className="gm-admin-card"
          data-testid="delete-confirmation-card"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(26, 17, 23, 0.95)',
          }}
        >
          <h2 className="gm-admin-card__title" style={{ color: '#fca5a5' }}>
            Confirm Delete
          </h2>
          <p style={{ color: '#e2e8f0', margin: '0.5rem 0 1rem', lineHeight: 1.6 }}>
            Are you sure you want to delete automation rule <strong>{ruleToDelete.name}</strong>? This action cannot be undone.
          </p>

          {deleteError && (
            <div className="gm-admin-warning" role="alert" data-testid="delete-error" style={{ marginBottom: '1rem' }}>
              {deleteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gm-admin-btn"
              onClick={cancelDelete}
              disabled={isDeleting}
              data-testid="cancel-delete-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="gm-admin-btn"
              style={{
                background: '#dc2626',
                borderColor: '#ef4444',
                color: '#ffffff',
                opacity: isDeleting ? 0.7 : 1,
              }}
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
              data-testid="confirm-delete-btn"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Rule Builder Form Card */}
      {isFormOpen && (
        <div className="gm-admin-card" data-testid="rule-form-card" style={{ maxWidth: '960px' }}>
          <h2 className="gm-admin-card__title">
            {editingRuleId ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </h2>
          <p className="gm-admin-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            Configure when to evaluate users, which conditions they must match, and the notification email to send.
          </p>

          {formError && (
            <div
              className="gm-admin-warning"
              role="alert"
              data-testid="form-error"
              style={{ marginBottom: '1.25rem' }}
            >
              {formError}
            </div>
          )}

          <form
            onSubmit={(e) => void handleFormSubmit(e)}
            noValidate
            style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}
          >
            {/* 1. Basic Fields */}
            <div className="gm-admin-grid gm-admin-grid--2">
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  Rule name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  name="name"
                  className="gm-admin-input"
                  placeholder="e.g. Re-engage inactive users"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                    if (formValidationErrors.name) {
                      setFormValidationErrors((prev) => {
                        const next = { ...prev }
                        delete next.name
                        return next
                      })
                    }
                  }}
                  disabled={isSubmitting || isLoadingRule}
                  data-testid="rule-name-input"
                />
                {formValidationErrors.name && (
                  <span data-testid="rule-name-error" style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                    {formValidationErrors.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  Email template <span style={{ color: '#f87171' }}>*</span>
                </label>
                <select
                  name="templateId"
                  className="gm-admin-select"
                  value={formData.templateId}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, templateId: e.target.value }))
                    if (formValidationErrors.templateId) {
                      setFormValidationErrors((prev) => {
                        const next = { ...prev }
                        delete next.templateId
                        return next
                      })
                    }
                  }}
                  disabled={isSubmitting || isLoadingRule}
                  data-testid="rule-template-select"
                >
                  <option value="">Select an email template</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.templateKey})
                    </option>
                  ))}
                </select>
                {formValidationErrors.templateId && (
                  <span data-testid="rule-template-error" style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                    {formValidationErrors.templateId}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Schedule Section */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Evaluation Schedule
              </div>
              <div className="gm-admin-grid gm-admin-grid--2" style={{ alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Schedule Type
                  </label>
                  <select
                    className="gm-admin-select"
                    value={formData.scheduleType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduleType: e.target.value as ScheduleType,
                      }))
                    }
                    disabled={isSubmitting || isLoadingRule}
                    data-testid="schedule-type-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="interval_hours">Interval (Hours)</option>
                  </select>
                </div>

                {formData.scheduleType === 'daily' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Hour (UTC)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        className="gm-admin-input"
                        value={formData.scheduleHourUtc}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduleHourUtc: Number(e.target.value) }))
                        }
                        disabled={isSubmitting || isLoadingRule}
                        data-testid="schedule-hour-input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Minute (UTC)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        className="gm-admin-input"
                        value={formData.scheduleMinuteUtc}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduleMinuteUtc: Number(e.target.value) }))
                        }
                        disabled={isSubmitting || isLoadingRule}
                        data-testid="schedule-minute-input"
                      />
                    </div>
                  </div>
                )}

                {formData.scheduleType === 'weekly' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 1.2 }}>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Day of Week
                      </label>
                      <select
                        className="gm-admin-select"
                        value={formData.scheduleDayOfWeek}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduleDayOfWeek: Number(e.target.value) }))
                        }
                        disabled={isSubmitting || isLoadingRule}
                        data-testid="schedule-day-select"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 0.9 }}>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Hour (UTC)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        className="gm-admin-input"
                        value={formData.scheduleHourUtc}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduleHourUtc: Number(e.target.value) }))
                        }
                        disabled={isSubmitting || isLoadingRule}
                        data-testid="schedule-hour-input"
                      />
                    </div>
                    <div style={{ flex: 0.9 }}>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        Minute
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        className="gm-admin-input"
                        value={formData.scheduleMinuteUtc}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scheduleMinuteUtc: Number(e.target.value) }))
                        }
                        disabled={isSubmitting || isLoadingRule}
                        data-testid="schedule-minute-input"
                      />
                    </div>
                  </div>
                )}

                {formData.scheduleType === 'interval_hours' && (
                  <div>
                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      Repeat Interval (1..168 Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      className="gm-admin-input"
                      value={formData.scheduleIntervalHours}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, scheduleIntervalHours: Number(e.target.value) }))
                      }
                      disabled={isSubmitting || isLoadingRule}
                      data-testid="schedule-interval-input"
                    />
                  </div>
                )}
              </div>
              {formValidationErrors.schedule && (
                <span data-testid="schedule-error" style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.5rem' }}>
                  {formValidationErrors.schedule}
                </span>
              )}
            </div>

            {/* 3. Conditions Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem' }}>
                  User Conditions
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  Targeted users must satisfy these rules
                </span>
              </div>

              {renderConditionGroup(formData.conditions, [], true)}

              {formValidationErrors.conditions && (
                <span data-testid="conditions-error" style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.5rem' }}>
                  {formValidationErrors.conditions}
                </span>
              )}
            </div>

            {/* 4. Action & Cooldown */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                Action & Cooldown
              </div>
              <div className="gm-admin-grid gm-admin-grid--2">
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Action Type
                  </label>
                  <input
                    type="text"
                    className="gm-admin-input"
                    value="Send Email (send_email)"
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Cooldown (Days, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 90 (prevent re-sending for 90 days)"
                    className="gm-admin-input"
                    value={formData.cooldownDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, cooldownDays: e.target.value }))
                    }
                    disabled={isSubmitting || isLoadingRule}
                    data-testid="cooldown-input"
                  />
                  {formValidationErrors.cooldownDays && (
                    <span data-testid="cooldown-error" style={{ color: '#f87171', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                      {formValidationErrors.cooldownDays}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Enabled Switch */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <span style={{ display: 'block', color: '#ffffff', fontWeight: 500, fontSize: '0.95rem' }}>
                  Enable Rule
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  When enabled, this rule will be periodically evaluated according to the schedule.
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Off</span>
                <input
                  type="checkbox"
                  name="enabled"
                  data-testid="rule-enabled-toggle"
                  checked={formData.enabled}
                  onChange={(e) => setFormData((prev) => ({ ...prev, enabled: e.target.checked }))}
                  disabled={isSubmitting || isLoadingRule}
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: '#aa3bff', cursor: 'pointer' }}
                />
                <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>On</span>
              </label>
            </div>

            {/* Submit & Cancel Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="gm-admin-btn"
                onClick={closeForm}
                disabled={isSubmitting || isLoadingRule}
                data-testid="cancel-form-btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="gm-admin-btn gm-admin-btn--primary"
                disabled={isSubmitting || isLoadingRule}
                style={{ opacity: isSubmitting || isLoadingRule ? 0.7 : 1 }}
                data-testid="submit-rule-btn"
              >
                {isSubmitting
                  ? editingRuleId
                    ? 'Saving...'
                    : 'Creating...'
                  : editingRuleId
                    ? 'Save changes'
                    : 'Create rule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List / Table */}
      {isLoading ? (
        <div className="gm-admin-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <p className="gm-admin-muted" style={{ margin: 0 }}>
            Loading automation rules...
          </p>
        </div>
      ) : rules.length === 0 && !error ? (
        <div className="gm-admin-card">
          <div
            className="gm-admin-empty"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '12rem' }}
          >
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              No automation rules found. Click "Create rule" to create one.
            </p>
          </div>
        </div>
      ) : rules.length > 0 ? (
        <div className="gm-admin-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="gm-admin-table" data-testid="automation-rules-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Schedule</th>
                <th>Conditions</th>
                <th>Linked Template</th>
                <th>Status</th>
                <th>Last Evaluated</th>
                <th>Next Evaluation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const linkedTpl = templates.find((t) => t.id === rule.templateId)
                return (
                  <tr key={rule.id} data-testid={`rule-row-${rule.id}`}>
                    <td>
                      <div data-testid={`rule-name-${rule.id}`} style={{ fontWeight: 600 }}>
                        {rule.name}
                      </div>
                    </td>
                    <td>
                      <span
                        data-testid={`schedule-summary-${rule.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          background: 'rgba(170, 59, 255, 0.15)',
                          color: '#c084fc',
                        }}
                      >
                        {formatScheduleSummary(rule.config?.schedule)}
                      </span>
                    </td>
                    <td>
                      <span
                        data-testid={`conditions-summary-${rule.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                        }}
                      >
                        {formatConditionsSummary(rule.config?.conditions)}
                      </span>
                    </td>
                    <td>
                      <div data-testid={`template-name-${rule.id}`}>
                        {linkedTpl ? (
                          <>
                            <span style={{ fontWeight: 500 }}>{linkedTpl.name}</span>
                            <span className="gm-admin-muted" style={{ fontSize: '0.8rem', marginLeft: '0.35rem' }}>
                              ({linkedTpl.templateKey})
                            </span>
                          </>
                        ) : (
                          <span className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                            {rule.templateId || '-'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        data-testid={`status-badge-${rule.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          ...getEnabledBadgeStyle(rule.enabled),
                        }}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span data-testid={`last-evaluated-${rule.id}`} className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                        {formatDateTime(rule.lastEvaluatedAt)}
                      </span>
                    </td>
                    <td>
                      <span data-testid={`next-evaluation-${rule.id}`} className="gm-admin-muted" style={{ fontSize: '0.85rem' }}>
                        {formatDateTime(rule.nextEvaluationAt)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="gm-admin-btn"
                          onClick={() => void openEditForm(rule)}
                          disabled={isSubmitting || isLoadingRule || isDeleting || togglingRuleId === rule.id}
                          data-testid={`edit-rule-btn-${rule.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="gm-admin-btn"
                          style={{
                            color: rule.enabled ? '#fef08a' : '#4ade80',
                            borderColor: rule.enabled ? 'rgba(234, 179, 8, 0.4)' : 'rgba(34, 197, 94, 0.4)',
                          }}
                          onClick={() => void handleToggleRule(rule)}
                          disabled={isSubmitting || isLoadingRule || isDeleting || togglingRuleId === rule.id}
                          data-testid={`toggle-rule-btn-${rule.id}`}
                        >
                          {togglingRuleId === rule.id
                            ? 'Updating...'
                            : rule.enabled
                              ? 'Disable'
                              : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="gm-admin-btn"
                          style={{ color: '#fecaca', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                          onClick={() => promptDelete(rule)}
                          disabled={isSubmitting || isLoadingRule || isDeleting || togglingRuleId === rule.id}
                          data-testid={`delete-rule-btn-${rule.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default AutomationPage
