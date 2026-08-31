import type {
  PlatformHomeAppPulse,
  PlatformHomeFocus,
  PlatformHomeWidgetType
} from '@/types/platformHome'

export function formatPlatformGreeting(
  greeting: { firstName?: string; timeOfDay?: string } | null | undefined,
  fallbackFirstName = ''
): string {
  const firstName = (greeting?.firstName || fallbackFirstName || '').trim()
  const hour = new Date().getHours()
  const timeOfDay =
    greeting?.timeOfDay ||
    (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening')

  const prefix =
    timeOfDay === 'morning'
      ? 'Good morning'
      : timeOfDay === 'afternoon'
        ? 'Good afternoon'
        : 'Good evening'

  return firstName ? `${prefix}, ${firstName}` : prefix
}

export function formatPlatformFocus(focus: PlatformHomeFocus | null | undefined): string {
  if (!focus?.key) return "You're all caught up for now."

  const {
    key,
    overdue = 0,
    dueToday = 0,
    approvals = 0,
    unread = 0,
    attentionTotal = 0,
    dangerSignal = ''
  } = focus

  switch (key) {
    case 'overdue':
      if (dueToday > 0) return `${overdue} overdue · ${dueToday} due today`
      return overdue === 1 ? '1 item overdue' : `${overdue} items overdue`
    case 'app_danger':
      return dangerSignal ? `Needs attention: ${dangerSignal}` : 'Something needs your attention'
    case 'approvals':
      return approvals === 1 ? '1 approval waiting' : `${approvals} approvals waiting`
    case 'due_today':
      return dueToday === 1 ? '1 item due today' : `${dueToday} items due today`
    case 'unread_mail':
      return unread === 1 ? '1 unread message' : `${unread} unread messages`
    case 'attention':
      return attentionTotal === 1 ? '1 item in your queue' : `${attentionTotal} items in your queue`
    case 'caught_up':
      return "You're all caught up."
    default:
      return 'Light day ahead.'
  }
}

export type BriefSignal = {
  id: string
  appKey?: string
  text: string
  severity?: string
  route?: string | null
}

export function extractBriefSignals(appPulses: PlatformHomeAppPulse[], limit = 4): BriefSignal[] {
  const items: BriefSignal[] = []
  for (const pulse of appPulses) {
    for (const signal of pulse.signals || []) {
      if (!signal.text || signal.text === 'No urgent items') continue
      items.push({
        id: `${pulse.appKey}-${signal.text}`,
        appKey: pulse.appKey,
        text: signal.text,
        severity: signal.severity || 'info',
        route: signal.route || pulse.route || null
      })
    }
  }
  return items.slice(0, limit)
}

export function mobilePathFromWebRoute(route: string | undefined | null): string | null {
  if (!route) return null

  if (route.startsWith('/tasks/')) return route
  const salesTask = route.match(/^\/sales\/tasks\/([^/?#]+)/)
  if (salesTask) return `/tasks/${salesTask[1]}`

  const inboxThread = route.match(/[?&]thread=([^&]+)/)
  if (inboxThread) return `/inbox/${decodeURIComponent(inboxThread[1])}`
  if (route.startsWith('/inbox/')) return route.split('?')[0]

  const caseMatch = route.match(/^\/helpdesk\/cases\/([^/?#]+)/)
  if (caseMatch) return `/modules/cases/${caseMatch[1]}`

  for (const moduleKey of ['people', 'organizations', 'deals', 'events', 'forms', 'items'] as const) {
    const match = route.match(new RegExp(`^/${moduleKey}/([^/?#]+)`))
    if (match) return `/modules/${moduleKey}/${match[1]}`
  }

  if (route.startsWith('/notifications')) return '/notifications'
  return null
}

export function defaultMobileRouteForApp(appKey: string): string {
  switch (appKey.toUpperCase()) {
    case 'HELPDESK':
      return '/modules/cases'
    case 'AUDIT':
      return '/modules/responses'
    case 'SALES':
      return '/modules/deals'
    default:
      return '/apps'
  }
}

export function widgetMetricCards(snapshot: {
  attention: { summary: { overdue: number; dueToday: number } }
  shell: {
    mail: { unread: number }
    notifications: { unread: number }
    approvalsPending: number
  }
}) {
  return [
    {
      key: 'tasks',
      label: 'Tasks',
      primary: snapshot.attention.summary.overdue + snapshot.attention.summary.dueToday,
      secondary:
        snapshot.attention.summary.overdue > 0
          ? `${snapshot.attention.summary.overdue} overdue`
          : 'Due today',
      to: '/tasks',
      active: true
    },
    {
      key: 'inbox',
      label: 'Inbox',
      primary: snapshot.shell.mail.unread,
      secondary: snapshot.shell.mail.unread ? 'Unread threads' : 'No unread',
      to: '/inbox'
    },
    {
      key: 'alerts',
      label: 'Alerts',
      primary: snapshot.shell.notifications.unread,
      secondary: 'Notifications',
      to: '/notifications'
    },
    {
      key: 'approvals',
      label: 'Approvals',
      primary: snapshot.shell.approvalsPending,
      secondary: 'Pending',
      to: '/apps'
    }
  ]
}

export function widgetTypeAccent(type: PlatformHomeWidgetType): string {
  switch (type) {
    case 'today-brief':
      return '#6049E7'
    case 'up-next':
      return '#f59e0b'
    case 'recent-work':
      return '#10b981'
    case 'inbox':
      return '#3b82f6'
    case 'apps':
      return '#8b5cf6'
    default:
      return '#6049E7'
  }
}

export type AppPillTone =
  | 'sales'
  | 'helpdesk'
  | 'audit'
  | 'projects'
  | 'portal'
  | 'inventory'
  | 'marketing'
  | 'default'

export function appPillTone(appKey: string): AppPillTone {
  switch (String(appKey || '').toUpperCase()) {
    case 'SALES':
      return 'sales'
    case 'HELPDESK':
      return 'helpdesk'
    case 'AUDIT':
      return 'audit'
    case 'PROJECTS':
      return 'projects'
    case 'PORTAL':
      return 'portal'
    case 'INVENTORY':
      return 'inventory'
    case 'MARKETING':
      return 'marketing'
    default:
      return 'default'
  }
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

export function formatUpcomingTime(value?: string | null): string {
  if (!value) return ''
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return ''
  const diffMs = start.getTime() - Date.now()
  if (diffMs <= 0) return 'soon'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return minutes <= 1 ? 'in 1 minute' : `in ${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'in 1 hour' : `in ${hours} hours`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'in 1 day' : `in ${days} days`
}
