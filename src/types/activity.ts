export type ActivityActorType = 'user' | 'system' | 'service'
export type ActivityStatus = 'success' | 'failure' | 'warning'
export type ActivityTargetType =
  | 'campaign'
  | 'direct_notification'
  | 'template'
  | 'automation_rule'
  | 'settings'
  | 'agreement'

export interface ActivityActor {
  type: ActivityActorType | string
  userId?: string | null
  name?: string | null
  role?: string | null
}

export interface ActivityTarget {
  type: ActivityTargetType | string
  id: string
  name?: string | null
}

export interface ActivityListItem {
  id: string
  eventType: string
  actor: ActivityActor
  target: ActivityTarget
  status: ActivityStatus | string
  summary: string
  createdAt: string
}

export type ActivityDetails =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null

export interface ActivityDetail {
  id: string
  eventType: string
  actor: ActivityActor
  target: ActivityTarget
  status: ActivityStatus | string
  summary: string
  details?: ActivityDetails
  errorMessage?: string | null
  createdAt: string
}

export interface ActivityListResponse {
  items: ActivityListItem[]
  total: number
  limit: number
  offset: number
}

export interface ActivityLogFilter {
  limit?: number
  offset?: number
  eventType?: string
  actorUserId?: string
  targetType?: ActivityTargetType | string
  targetId?: string
  status?: ActivityStatus | string
  fromDate?: string
  toDate?: string
}
