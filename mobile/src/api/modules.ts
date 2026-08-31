import { apiClient } from '@/api/client'
import type { MobileModuleDef } from '@/config/mobileModules'
import { useAuthStore } from '@/stores/auth'

function extractRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return []
  const payload = body as Record<string, unknown>
  if (Array.isArray(payload.data)) {
    return payload.data as Record<string, unknown>[]
  }
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>
    if (Array.isArray(nested.records)) return nested.records as Record<string, unknown>[]
    if (Array.isArray(nested.items)) return nested.items as Record<string, unknown>[]
  }
  if (Array.isArray(payload.records)) return payload.records as Record<string, unknown>[]
  return []
}

function resolveModuleRequest(mod: MobileModuleDef): { listPath: string; appKey?: string } {
  const auth = useAuthStore()
  if (mod.key === 'responses') {
    if (auth.preferredAppKey === 'AUDIT') {
      return { listPath: '/audit/responses', appKey: 'AUDIT' }
    }
    return { listPath: '/forms/responses/all', appKey: 'SALES' }
  }
  return { listPath: mod.apiPath, appKey: mod.appKey }
}

export async function fetchModuleList(
  mod: MobileModuleDef,
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('limit', String(params.limit || 30))
  if (params.search) query.set('search', params.search)

  const { listPath, appKey } = resolveModuleRequest(mod)
  const path = `${listPath}?${query.toString()}`

  const res = await apiClient.get<unknown>(path, { appKey })
  return extractRecords(res)
}

export async function fetchModuleDetail(
  mod: MobileModuleDef,
  recordId: string
): Promise<Record<string, unknown>> {
  const { appKey } = resolveModuleRequest(mod)
  const path =
    mod.key === 'responses'
      ? `/responses/${recordId}`
      : mod.detailApiPath || `${mod.apiPath}/${recordId}`
  const res = await apiClient.get<{ success?: boolean; data?: Record<string, unknown> }>(
    path,
    { appKey }
  )
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data
  }
  return (res as Record<string, unknown>) || {}
}
