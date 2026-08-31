import { apiClient } from '@/api/client'

export type PeopleListAppContext = 'ALL' | 'SALES' | 'HELPDESK'

export type ListSavedView = {
  id: string
  label: string
  description?: string
  filters?: Record<string, unknown>
  config?: Record<string, unknown>
  peopleContext?: PeopleListAppContext
  isDefault?: boolean
  isSystem?: boolean
}

const STORAGE_PREFIX = 'arivu-listview'

function activeViewKey(moduleKey: string, userId?: string | null): string {
  const uid = userId ? String(userId) : ''
  return uid
    ? `${STORAGE_PREFIX}-${moduleKey}-${uid}-active-view`
    : `${STORAGE_PREFIX}-${moduleKey}-active-view`
}

export function loadActiveSavedViewId(moduleKey: string, userId?: string | null): string | null {
  try {
    return localStorage.getItem(activeViewKey(moduleKey, userId))
  } catch {
    return null
  }
}

export function saveActiveSavedViewId(
  moduleKey: string,
  userId: string | null | undefined,
  viewId: string | null
): void {
  try {
    const key = activeViewKey(moduleKey, userId)
    if (viewId) localStorage.setItem(key, viewId)
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Tasks system views — keep in sync with client moduleListRegistry.tasks.systemViews */
export const TASKS_SYSTEM_VIEWS: ListSavedView[] = [
  { id: 'all', label: 'All Tasks', filters: {}, isDefault: true, isSystem: true },
  { id: 'assigned-to-me', label: 'My Tasks', filters: { assignedTo: 'me' }, isSystem: true }
]

/** People system views — keep in sync with client moduleListRegistry.people.systemViews */
export const PEOPLE_SYSTEM_VIEWS: ListSavedView[] = [
  {
    id: 'assigned-to-me',
    label: 'My People',
    filters: { assignedTo: 'me' },
    peopleContext: 'ALL',
    isDefault: true,
    isSystem: true
  },
  { id: 'all', label: 'All People', filters: {}, peopleContext: 'ALL', isSystem: true },
  { id: 'sales', label: 'Sales People', filters: {}, peopleContext: 'SALES', isSystem: true },
  {
    id: 'helpdesk',
    label: 'Helpdesk People',
    filters: {},
    peopleContext: 'HELPDESK',
    isSystem: true
  }
]

export async function fetchCustomSavedViews(moduleKey: string): Promise<ListSavedView[]> {
  const res = await apiClient.get<{ success: boolean; data: ListSavedView[] }>(
    `/user-preferences/list-saved-views?moduleKey=${encodeURIComponent(moduleKey)}`
  )
  const rows = Array.isArray(res.data) ? res.data : []
  return rows.map((view) => ({
    id: String(view.id),
    label: String(view.label || view.id),
    description: view.description ? String(view.description) : undefined,
    filters: (view.filters && typeof view.filters === 'object' ? view.filters : {}) as Record<string, unknown>,
    config: view.config && typeof view.config === 'object' ? view.config : undefined,
    isSystem: false
  }))
}

export async function loadModuleListViews(moduleKey: string): Promise<ListSavedView[]> {
  if (moduleKey === 'tasks') {
    const custom = await fetchCustomSavedViews(moduleKey).catch(() => [])
    return [...TASKS_SYSTEM_VIEWS, ...custom]
  }
  if (moduleKey === 'people') {
    const custom = await fetchCustomSavedViews(moduleKey).catch(() => [])
    return [...PEOPLE_SYSTEM_VIEWS, ...custom]
  }
  const custom = await fetchCustomSavedViews(moduleKey).catch(() => [])
  return custom
}
