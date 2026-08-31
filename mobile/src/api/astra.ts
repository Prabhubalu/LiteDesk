import { apiClient } from '@/api/client'

const ASTRA_OPTS = { skipAuthLogout: true as const }

export type AstraSuggestion = string | { label: string; prompt: string }

export type AstraProposal = {
  id: string
  kind: string
  label: string
  rationale?: string
  moduleKey?: string
  recordId?: string
  fields?: Record<string, unknown>
  status?: 'pending' | 'completed' | 'dismissed'
  href?: string
  navigateLabel?: string
}

export type AstraNbaItem = {
  id: string
  kind: string
  label: string
  rationale?: string
  prompt?: string
  moduleKey?: string
  recordId?: string
}

export type AstraAskContext = {
  moduleKey?: string
  recordId?: string
  recordName?: string
  conversationId?: string
  history?: Array<{ role: string; content: string }>
}

export type AstraAskResult = {
  answer: string
  proposals: AstraProposal[]
  suggestions: AstraSuggestion[]
  conversationId?: string
  conversationTitle?: string
}

export type AstraConversationSummary = {
  id: string
  title: string
  preview?: string
  messageCount?: number
  updatedAt?: string | null
  createdAt?: string | null
}

export type AstraConversationMessage = {
  id: string
  role: 'user' | 'assistant'
  body: string
  proposals?: AstraProposal[]
  suggestions?: AstraSuggestion[]
}

export type AstraConversationDetail = AstraConversationSummary & {
  messages: AstraConversationMessage[]
}

function toStringSafe(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function normalizeSuggestions(source: unknown): AstraSuggestion[] {
  if (!Array.isArray(source)) return []
  return source
    .map((s): AstraSuggestion | null => {
      if (typeof s === 'string') {
        const text = s.trim()
        return text || null
      }
      if (s && typeof s === 'object') {
        const row = s as Record<string, unknown>
        const prompt = toStringSafe(row.prompt || row.label || row.title).trim()
        const label = toStringSafe(row.label || row.title || row.prompt).trim()
        if (!prompt) return null
        return label && label !== prompt ? { label, prompt } : prompt
      }
      return null
    })
    .filter((s): s is AstraSuggestion => s != null)
}

function normalizeProposals(source: unknown): AstraProposal[] {
  if (!Array.isArray(source)) return []
  return source
    .map((raw, index): AstraProposal | null => {
      if (!raw || typeof raw !== 'object') return null
      const item = raw as Record<string, unknown>
      const label = toStringSafe(item.label || item.summary).trim()
      if (!label) return null
      const fields =
        item.fields && typeof item.fields === 'object'
          ? (item.fields as Record<string, unknown>)
          : item.payload && typeof item.payload === 'object'
            ? (item.payload as Record<string, unknown>)
            : undefined
      return {
        id: toStringSafe(item.id) || `proposal-${index}`,
        kind: toStringSafe(item.kind || item.toolName) || 'generic',
        label,
        rationale: toStringSafe(item.rationale || item.guidance) || undefined,
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined,
        fields,
        status:
          toStringSafe(item.status) === 'completed'
            ? 'completed'
            : toStringSafe(item.status) === 'dismissed'
              ? 'dismissed'
              : 'pending',
        href: toStringSafe(item.href) || undefined,
        navigateLabel: toStringSafe(item.navigateLabel) || undefined
      }
    })
    .filter((p): p is AstraProposal => p !== null)
}

function proposalsFromPayload(data: Record<string, unknown>): AstraProposal[] {
  const direct = normalizeProposals(data?.proposals ?? data?.actions)
  if (direct.length) return direct
  const toolResult = data?.toolResult as Record<string, unknown> | undefined
  if (toolResult?.type === 'confirm_action') return normalizeProposals([toolResult])
  return []
}

function normalizeNba(source: unknown): AstraNbaItem[] {
  if (!Array.isArray(source)) return []
  return source
    .map((raw, index): AstraNbaItem | null => {
      if (!raw || typeof raw !== 'object') return null
      const item = raw as Record<string, unknown>
      const label = toStringSafe(item.label || item.title).trim()
      if (!label) return null
      const input =
        item.input && typeof item.input === 'object'
          ? (item.input as Record<string, unknown>)
          : undefined
      const prompt = toStringSafe(item.prompt || input?.query || label).trim() || label
      return {
        id: toStringSafe(item.id) || `nba-${index}`,
        kind: toStringSafe(item.kind || item.tool) || 'generic',
        label,
        rationale: toStringSafe(item.rationale) || undefined,
        prompt,
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined
      }
    })
    .filter((n): n is AstraNbaItem => n !== null)
}

export function suggestionPrompt(suggestion: AstraSuggestion): string {
  return typeof suggestion === 'string' ? suggestion : suggestion.prompt
}

export function suggestionLabel(suggestion: AstraSuggestion): string {
  return typeof suggestion === 'string' ? suggestion : suggestion.label || suggestion.prompt
}

function buildAskBody(query: string, context: AstraAskContext) {
  const text = String(query || '').trim()
  return {
    query: text,
    surface: 'mobile',
    moduleKey: context.moduleKey,
    recordId: context.recordId,
    recordName: context.recordName,
    conversationId: context.conversationId,
    history: Array.isArray(context.history) ? context.history : undefined,
    focus:
      context.recordId || context.moduleKey
        ? {
            kind: context.moduleKey,
            moduleKey: context.moduleKey,
            id: context.recordId,
            recordId: context.recordId,
            name: context.recordName || undefined
          }
        : undefined
  }
}

function normalizeAskResult(
  data: Record<string, unknown>,
  context: AstraAskContext
): AstraAskResult {
  return {
    answer: toStringSafe(data?.answer ?? data?.reply ?? data?.body),
    proposals: proposalsFromPayload(data),
    suggestions: normalizeSuggestions(data?.suggestions),
    conversationId: toStringSafe(data?.conversationId) || context.conversationId,
    conversationTitle: toStringSafe(data?.conversationTitle) || undefined
  }
}

export async function askAstra(
  query: string,
  context: AstraAskContext = {}
): Promise<AstraAskResult> {
  const data = (await apiClient.post(
    '/ai/v2/ask',
    buildAskBody(query, context),
    ASTRA_OPTS
  )) as Record<string, unknown>
  return normalizeAskResult(data, context)
}

export async function fetchAstraNba(context: {
  moduleKey?: string
  recordId?: string
  recordName?: string
  surface?: string
}): Promise<AstraNbaItem[]> {
  const params = new URLSearchParams()
  if (context.moduleKey) params.set('moduleKey', context.moduleKey)
  if (context.recordId) params.set('recordId', context.recordId)
  if (context.recordName) params.set('recordName', context.recordName)
  params.set('surface', context.surface || 'home')
  try {
    const data = (await apiClient.get(`/ai/v2/next-best-actions?${params.toString()}`, ASTRA_OPTS)) as Record<
      string,
      unknown
    >
    return normalizeNba(data?.items ?? data?.cards ?? data?.nba ?? data)
  } catch {
    return []
  }
}

export async function confirmAstraProposal(
  proposal: AstraProposal,
  conversationId?: string
): Promise<{
  ok: boolean
  message?: string
  href?: string
  navigateLabel?: string
}> {
  try {
    const data = (await apiClient.post(
      '/ai/v2/actions/confirm',
      {
        toolName: proposal.kind,
        proposalId: proposal.id,
        kind: proposal.kind,
        moduleKey: proposal.moduleKey,
        recordId: proposal.recordId,
        payload: proposal.fields,
        fields: proposal.fields,
        conversationId,
        confirmed: true
      },
      ASTRA_OPTS
    )) as Record<string, unknown>
    return {
      ok: true,
      message: toStringSafe(data?.message) || 'Done',
      href: toStringSafe(data?.href) || undefined,
      navigateLabel: toStringSafe(data?.navigateLabel) || undefined
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed'
    return { ok: false, message }
  }
}

const PAGE_SIZE = 40

export async function fetchAstraConversations(cursor: string | null = null): Promise<{
  conversations: AstraConversationSummary[]
  nextCursor: string | null
  hasMore: boolean
}> {
  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  if (cursor) params.set('cursor', cursor)
  try {
    const data = (await apiClient.get(`/ai/v2/conversations?${params.toString()}`, ASTRA_OPTS)) as {
      conversations?: AstraConversationSummary[]
      nextCursor?: string | null
      hasMore?: boolean
    }
    return {
      conversations: Array.isArray(data?.conversations) ? data.conversations : [],
      nextCursor: data?.nextCursor || null,
      hasMore: Boolean(data?.hasMore && data?.nextCursor)
    }
  } catch {
    return { conversations: [], nextCursor: null, hasMore: false }
  }
}

export async function fetchAstraConversation(id: string): Promise<AstraConversationDetail | null> {
  if (!id) return null
  try {
    const data = (await apiClient.get(`/ai/v2/conversations/${encodeURIComponent(id)}`, ASTRA_OPTS)) as {
      conversation?: AstraConversationDetail
    }
    return data?.conversation || null
  } catch {
    return null
  }
}

export async function deleteAstraConversation(id: string): Promise<boolean> {
  if (!id) return false
  try {
    await apiClient.delete(`/ai/v2/conversations/${encodeURIComponent(id)}`, ASTRA_OPTS)
    return true
  } catch {
    return false
  }
}

export async function clearOlderAstraConversations(): Promise<void> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  try {
    await apiClient.delete(
      `/ai/v2/conversations?scope=older&before=${encodeURIComponent(start.toISOString())}`,
      ASTRA_OPTS
    )
  } catch {
    // optional
  }
}

export function mapConversationMessages(messages: AstraConversationMessage[]): Array<{
  role: 'user' | 'assistant'
  content: string
  proposals: AstraProposal[]
  suggestions: AstraSuggestion[]
}> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.body || '',
    proposals: normalizeProposals(msg.proposals),
    suggestions: normalizeSuggestions(msg.suggestions)
  }))
}
