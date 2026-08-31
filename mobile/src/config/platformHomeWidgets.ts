import type { PlatformHomeLayout, PlatformHomeLayoutItem, PlatformHomeWidgetType } from '@/types/platformHome'

const BUILTIN_WIDGETS: PlatformHomeWidgetType[] = [
  'intent-bar',
  'today-brief',
  'alerts',
  'apps',
  'up-next',
  'recent-work',
  'inbox'
]

const DEFAULT_ORDER: PlatformHomeWidgetType[] = [...BUILTIN_WIDGETS]

function createItem(type: PlatformHomeWidgetType, y: number, x = 0): PlatformHomeLayoutItem {
  return {
    instanceId: type,
    type,
    enabled: true,
    x,
    y,
    w: 12,
    h: type === 'up-next' || type === 'recent-work' ? 5 : 2
  }
}

export function createDefaultPlatformHomeLayout(): PlatformHomeLayout {
  const items: PlatformHomeLayoutItem[] = []
  let y = 0
  let workspaceRowY: number | null = null

  for (const type of DEFAULT_ORDER) {
    if (type === 'up-next') workspaceRowY = y
    const itemY = type === 'recent-work' && workspaceRowY !== null ? workspaceRowY : y
    items.push(createItem(type, itemY, type === 'recent-work' ? 6 : 0))
    if (type === 'up-next') {
      y += 5
      continue
    }
    if (type === 'recent-work') continue
    y += type === 'inbox' ? 4 : 2
  }

  return { items, widthMode: 'compact' }
}

export function normalizePlatformHomeLayout(raw: PlatformHomeLayout | null): PlatformHomeLayout {
  if (!raw?.items?.length) return createDefaultPlatformHomeLayout()

  const items = raw.items
    .filter((item) => item.enabled !== false && BUILTIN_WIDGETS.includes(item.type))
    .map((item) => ({
      instanceId: item.instanceId || item.type,
      type: item.type,
      enabled: true,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      w: Number(item.w) || 12,
      h: Number(item.h) || 2
    }))

  if (!items.length) return createDefaultPlatformHomeLayout()
  return { items, widthMode: raw.widthMode || 'compact' }
}

export function sortedEnabledWidgets(layout: PlatformHomeLayout): PlatformHomeLayoutItem[] {
  return [...layout.items]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export const PLATFORM_HOME_WIDGET_LABELS: Record<PlatformHomeWidgetType, string> = {
  'intent-bar': 'Search & create',
  'today-brief': 'Today',
  alerts: 'Alerts',
  apps: 'Your apps',
  'up-next': 'Up next',
  'recent-work': 'Recent work',
  inbox: 'Inbox',
  analytics: 'Analytics'
}
