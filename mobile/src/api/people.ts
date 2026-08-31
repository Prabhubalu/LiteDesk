import { apiClient } from '@/api/client'

export type PeopleAssignee = {
  _id?: string
  firstName?: string
  lastName?: string
  first_name?: string
  last_name?: string
  email?: string
  avatar?: string
}

export type PeopleActivityLog = {
  _id?: string
  timestamp?: string
  user?: string
  userId?: string | { _id?: string }
  action?: string
  details?: Record<string, unknown> | string | null
}

export type PeopleRecord = {
  _id: string
  first_name?: string
  last_name?: string
  name?: string
  email?: string
  phone?: string
  mobile?: string
  job_title?: string
  avatar?: string | null
  image?: string | null
  description?: string
  source?: string
  sales_type?: string
  helpdesk_role?: string
  derivedStatus?: string
  tags?: string[]
  assignedTo?: PeopleAssignee | string | null
  organization?: { _id?: string; name?: string } | string | null
  createdAt?: string
  updatedAt?: string
  lastActivity?: string
  [key: string]: unknown
}

export type PeopleListStatistics = {
  totalPeople?: number
  myPeople?: number
  unassigned?: number
  withOrganization?: number
  withoutOrganization?: number
}

export type FetchPeopleParams = {
  page?: number
  limit?: number
  search?: string
  assignedTo?: string
  organization?: 'has' | 'null'
  peopleContext?: 'ALL' | 'SALES' | 'HELPDESK'
}

export type FetchPeopleResult = {
  success?: boolean
  data: PeopleRecord[]
  pagination?: {
    currentPage?: number
    totalPages?: number
    totalRecords?: number
  }
  listStatistics?: PeopleListStatistics
}

export async function fetchPeople(params: FetchPeopleParams = {}): Promise<FetchPeopleResult> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('limit', String(Math.min(params.limit || 50, 100)))
  query.set('appKey', 'PLATFORM')
  if (params.search) query.set('search', params.search)
  if (params.assignedTo) query.set('assignedTo', params.assignedTo)
  if (params.organization) query.set('organization', params.organization)
  if (params.peopleContext && params.peopleContext !== 'ALL') {
    query.set('peopleContext', params.peopleContext)
  }
  return apiClient.get<FetchPeopleResult>(`/people?${query.toString()}`, { appKey: 'PLATFORM' })
}

export async function fetchPerson(personId: string) {
  return apiClient.get<{ success?: boolean; data: PeopleRecord }>(`/people/${personId}`, {
    appKey: 'PLATFORM'
  })
}

export async function updatePerson(personId: string, data: Record<string, unknown>) {
  return apiClient.put<{ success?: boolean; data: PeopleRecord }>(`/people/${personId}`, data, {
    appKey: 'PLATFORM'
  })
}

export async function fetchPersonActivityLogs(personId: string) {
  return apiClient.get<{ success?: boolean; data: PeopleActivityLog[] }>(
    `/people/${personId}/activity-logs`,
    { appKey: 'PLATFORM' }
  )
}

export async function addPersonActivityLog(
  personId: string,
  payload: { user: string; action: string; details?: Record<string, unknown> | string | null }
) {
  return apiClient.post<{ success?: boolean; data: PeopleActivityLog }>(
    `/people/${personId}/activity-logs`,
    payload,
    { appKey: 'PLATFORM' }
  )
}

export async function deletePerson(personId: string) {
  return apiClient.delete(`/people/${personId}`, { appKey: 'PLATFORM' })
}
