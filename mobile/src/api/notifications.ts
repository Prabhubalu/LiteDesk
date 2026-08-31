import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

export type NotificationItem = {
  _id: string
  appKey: string
  title?: string
  body?: string
  read?: boolean
  priority?: string
  eventType?: string
  createdAt?: string
  entity?: { type?: string; id?: string; title?: string; name?: string }
  [key: string]: unknown
}

type ApiNotification = {
  id?: string
  _id?: string
  appKey?: string
  title?: string
  body?: string
  readAt?: string | null
  read?: boolean
  priority?: string
  eventType?: string
  createdAt?: string
  entity?: NotificationItem['entity']
}

function resolveAppKeys(): string[] {
  const auth = useAuthStore()
  const allowed = (auth.user?.allowedApps || [])
    .map((key) => String(key).toUpperCase())
    .filter(Boolean)
  const preferred = String(auth.preferredAppKey || 'SALES').toUpperCase()
  const keys = [...new Set([...allowed, preferred])]
  return keys.length ? keys : ['SALES']
}

function normalizeItem(raw: ApiNotification, fallbackAppKey: string): NotificationItem | null {
  const id = String(raw.id || raw._id || '')
  if (!id) return null
  return {
    _id: id,
    appKey: String(raw.appKey || fallbackAppKey).toUpperCase(),
    title: raw.title,
    body: raw.body,
    read: Boolean(raw.readAt) || raw.read === true,
    priority: raw.priority,
    eventType: raw.eventType,
    createdAt: raw.createdAt,
    entity: raw.entity
  }
}

async function fetchNotificationsForApp(appKey: string, limit: number): Promise<NotificationItem[]> {
  const res = await apiClient.get<{
    items?: ApiNotification[]
    data?: ApiNotification[]
    success?: boolean
  }>(`/notifications?limit=${limit}&appKey=${encodeURIComponent(appKey)}`, { appKey })

  const rows = Array.isArray(res?.items)
    ? res.items
    : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
        ? (res as ApiNotification[])
        : []

  return rows
    .map((row) => normalizeItem(row, appKey))
    .filter((row): row is NotificationItem => row !== null)
}

export async function fetchNotifications(limit = 40): Promise<NotificationItem[]> {
  const appKeys = resolveAppKeys()
  const perAppLimit = Math.max(10, Math.ceil(limit / Math.max(appKeys.length, 1)))
  const batches = await Promise.all(
    appKeys.map(async (appKey) => {
      try {
        return await fetchNotificationsForApp(appKey, perAppLimit)
      } catch {
        return [] as NotificationItem[]
      }
    })
  )

  const byId = new Map<string, NotificationItem>()
  for (const item of batches.flat()) {
    byId.set(item._id, item)
  }

  return [...byId.values()]
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, limit)
}

export async function markNotificationRead(id: string, appKey: string): Promise<void> {
  const key = String(appKey || 'SALES').toUpperCase()
  await apiClient.post(
    `/notifications/${id}/read?appKey=${encodeURIComponent(key)}`,
    { appKey: key },
    { appKey: key }
  )
}

export async function markAllNotificationsRead(): Promise<void> {
  const appKeys = resolveAppKeys()
  await Promise.all(
    appKeys.map((appKey) =>
      apiClient.post(
        `/notifications/read-all?appKey=${encodeURIComponent(appKey)}`,
        { appKey },
        { appKey }
      )
    )
  )
}
