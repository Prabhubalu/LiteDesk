import { apiClient } from '@/api/client'
import { fetchModuleList } from '@/api/modules'
import { fetchPeople, type PeopleRecord } from '@/api/people'
import { fetchAssignableUsers } from '@/api/tasks'
import { getMobileModule } from '@/config/mobileModules'

export type LookupOption = {
  id: string
  label: string
  subtitle?: string
  avatar?: string
}

const FIELD_KEY_LOOKUP_TARGETS: Record<string, string> = {
  organization: 'organizations',
  organizationid: 'organizations',
  organizationrefid: 'organizations',
  accountid: 'organizations',
  vendorid: 'organizations',
  customerid: 'organizations',
  contactid: 'people',
  personid: 'people',
  assignedto: 'users',
  ownerid: 'users',
  reviewerid: 'users',
  auditorid: 'users',
  dealid: 'deals',
  projectid: 'projects'
}

function displayName(record: Record<string, unknown>): string {
  const name = record.name || record.title || record.subject || record.eventName
  if (name) return String(name)
  const first = record.first_name || record.firstName
  const last = record.last_name || record.lastName
  if (first) return `${first}${last ? ` ${last}` : ''}`.trim()
  if (record.email) return String(record.email)
  return 'Record'
}

function userLabel(user: Record<string, unknown>): string {
  const first = user.firstName || user.first_name
  const last = user.lastName || user.last_name
  if (first || last) return `${first || ''} ${last || ''}`.trim()
  if (user.email) return String(user.email)
  return 'User'
}

export function inferLookupTarget(
  fieldKey: string,
  lookupSettings?: { targetModule?: string }
): string {
  const fromSettings = String(lookupSettings?.targetModule || '').toLowerCase().trim()
  if (fromSettings) return fromSettings
  const normalized = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return FIELD_KEY_LOOKUP_TARGETS[normalized] || ''
}

export async function fetchLookupOptions(
  targetModule: string,
  search = '',
  appKey?: string
): Promise<LookupOption[]> {
  const target = targetModule.toLowerCase().trim()
  const query = search.trim()

  if (target === 'users') {
    const res = await fetchAssignableUsers()
    const users = Array.isArray(res.data) ? res.data : []
    return users
      .map((user) => ({
        id: String(user._id || ''),
        label: userLabel(user as Record<string, unknown>),
        subtitle: user.email ? String(user.email) : undefined,
        avatar: user.avatar ? String(user.avatar) : undefined
      }))
      .filter((row) => row.id)
      .filter((row) => {
        if (!query) return true
        const hay = `${row.label} ${row.subtitle || ''}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      })
  }

  if (target === 'people') {
    const res = await fetchPeople({ search: query || undefined, page: 1, limit: 30 })
    const records = res.data || []
    return records
      .map((person: PeopleRecord) => ({
        id: String(person._id || ''),
        label: person.name || displayName(person as Record<string, unknown>),
        subtitle: person.email ? String(person.email) : undefined,
        avatar: person.avatar ? String(person.avatar) : undefined
      }))
      .filter((row: LookupOption) => row.id)
  }

  const mod = getMobileModule(target)
  if (mod) {
    const records = await fetchModuleList(mod, { search: query || undefined, page: 1, limit: 30 })
    return records
      .map((record) => ({
        id: String(record._id || record.id || ''),
        label: displayName(record),
        subtitle: record.email ? String(record.email) : record.status ? String(record.status) : undefined
      }))
      .filter((row) => row.id)
  }

  if (target === 'organizations') {
    const res = await apiClient.get<unknown>(
      `/v2/organization?page=1&limit=30${query ? `&search=${encodeURIComponent(query)}` : ''}`,
      { appKey: appKey || 'PLATFORM' }
    )
    const records = extractRecords(res)
    return records
      .map((record) => ({
        id: String(record._id || record.id || ''),
        label: displayName(record)
      }))
      .filter((row) => row.id)
  }

  const path = `/${target}?page=1&limit=30${query ? `&search=${encodeURIComponent(query)}` : ''}`
  const res = await apiClient.get<unknown>(path, { appKey })
  return extractRecords(res)
    .map((record) => ({
      id: String(record._id || record.id || ''),
      label: displayName(record)
    }))
    .filter((row) => row.id)
}

function extractRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return []
  const payload = body as Record<string, unknown>
  if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[]
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>
    if (Array.isArray(nested.records)) return nested.records as Record<string, unknown>[]
    if (Array.isArray(nested.items)) return nested.items as Record<string, unknown>[]
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[]
  }
  if (Array.isArray(payload.records)) return payload.records as Record<string, unknown>[]
  return []
}
