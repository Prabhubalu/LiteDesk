export type PlatformHomeWidgetType =
  | 'intent-bar'
  | 'today-brief'
  | 'alerts'
  | 'apps'
  | 'up-next'
  | 'recent-work'
  | 'inbox'
  | 'analytics'

export type PlatformHomeLayoutItem = {
  instanceId: string
  type: PlatformHomeWidgetType
  widgetId?: string | null
  enabled?: boolean
  x: number
  y: number
  w: number
  h: number
}

export type PlatformHomeLayout = {
  items: PlatformHomeLayoutItem[]
  widthMode?: 'compact' | 'wide'
}

export type PlatformHomeFocus = {
  key?: string
  overdue?: number
  dueToday?: number
  approvals?: number
  unread?: number
  attentionTotal?: number
  dangerSignal?: string | null
}

export type PlatformHomeAttentionItem = {
  kind: string
  id: string
  title: string
  attentionLabel?: string
  dueAt?: string | null
  isOverdue?: boolean
  sourceApp?: string
  relatedLabel?: string
  organizationLabel?: string
  routeTarget?: string
  allowComplete?: boolean
}

export type PlatformHomeQueueItem = {
  id: string
  title: string
  subtitle?: string | null
  route?: string
  kind?: string
  appKey?: string
  startAt?: string | null
  updatedAt?: string | null
  entity?: Record<string, unknown>
}

export type PlatformHomeResumeItem = {
  id: string
  title: string
  route: string
  sourceApp: string
  moduleKey: string
  updatedAt?: string | null
}

export type PlatformHomeAppPulse = {
  appKey: string
  name?: string
  route?: string
  signals?: Array<{
    text?: string
    severity?: string
    signalKey?: string
    route?: string
  }>
}

export type PlatformHomeSnapshot = {
  greeting?: { firstName?: string; timeOfDay?: string } | null
  focus?: PlatformHomeFocus | null
  attention: {
    items: PlatformHomeAttentionItem[]
    total: number
    summary: { total: number; overdue: number; dueToday: number }
  }
  shell: {
    approvalsPending: number
    approvalsPreview: PlatformHomeQueueItem[]
    nextEvent: PlatformHomeQueueItem | null
    mail: {
      all: number
      unread: number
      assignedToMe: number
      preview: PlatformHomeQueueItem[]
    }
    notifications: {
      unread: number
      preview: PlatformHomeQueueItem[]
    }
    documents: {
      pendingReview: number
      expiringSoon: number
      preview: PlatformHomeQueueItem[]
    }
  }
  resume: PlatformHomeResumeItem[]
  appPulses: PlatformHomeAppPulse[]
}

export type PlatformHomeAlert = {
  type: 'error' | 'warning'
  title: string
  message: string
}
