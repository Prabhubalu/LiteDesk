import { apiClient } from '@/api/client'

export type SearchResultRow = {
  _id?: string
  id?: string
  name?: string
  title?: string
  subject?: string
  subtitle?: string
  email?: string
  first_name?: string
  last_name?: string
  type?: string
  route?: string
  avatar?: string | null
  [key: string]: unknown
}

export type GlobalSearchResults = {
  query: string
  total: number
  results: {
    people: SearchResultRow[]
    organizations: SearchResultRow[]
    deals: SearchResultRow[]
    tasks: SearchResultRow[]
    events: SearchResultRow[]
    forms: SearchResultRow[]
    items: SearchResultRow[]
    cases?: SearchResultRow[]
    quotes?: SearchResultRow[]
  }
}

function titleForRow(row: SearchResultRow): string {
  if (row.name) return String(row.name)
  if (row.title) return String(row.title)
  if (row.subject) return String(row.subject)
  if (row.first_name) {
    return `${row.first_name}${row.last_name ? ` ${row.last_name}` : ''}`.trim()
  }
  if (row.email) return String(row.email)
  return 'Record'
}

export function searchRowId(row: SearchResultRow): string {
  return String(row._id || row.id || '')
}

export function searchRowTitle(row: SearchResultRow): string {
  return titleForRow(row)
}

export function searchRowSubtitle(row: SearchResultRow): string {
  return row.subtitle ? String(row.subtitle) : ''
}

export function searchRowRoute(row: SearchResultRow): string {
  return typeof row.route === 'string' ? row.route : ''
}

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  const q = encodeURIComponent(query.trim())
  const res = await apiClient.get<{ success?: boolean; data?: GlobalSearchResults }>(
    `/search?q=${q}`
  )
  if (res?.data) return res.data
  return {
    query,
    total: 0,
    results: {
      people: [],
      organizations: [],
      deals: [],
      tasks: [],
      events: [],
      forms: [],
      items: []
    }
  }
}
