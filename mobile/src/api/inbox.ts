import { apiClient } from '@/api/client'

/** Matches GET /communications/workspace-threads row shape (desktop Inbox). */
export type InboxThread = {
  threadId: string
  subject?: string
  participantDisplay?: string
  lastMessageDirection?: string
  lastMessageStatus?: string
  firstActivityAt?: string
  lastActivityAt?: string
  unread?: boolean
  done?: boolean
  messageCount?: number
  mailboxId?: string | null
  recordLabel?: string
  replyToAddress?: string
  anchorCommunicationId?: string
  assignedToDisplay?: string | null
  relatedTo?: { moduleKey?: string; recordId?: string | null } | null
}

export type Mailbox = {
  id: string
  kind: 'personal' | 'group' | 'smtp_sender'
  label: string
  emailAddress: string
  status?: string
  outboundChannel?: string
  threadUnreadCount?: number
}

export type InboxMessage = {
  _id: string
  direction?: string
  fromAddress?: string
  toAddresses?: string[]
  subject?: string
  body?: string
  sentAt?: string
  receivedAt?: string
  status?: string
}

export async function fetchInboxThreads(params: {
  filter?: string
  limit?: number
  search?: string
  cursor?: string
  mailboxId?: string
  includeDone?: boolean
} = {}) {
  const query = new URLSearchParams()
  query.set('filter', params.filter || 'all')
  query.set('limit', String(params.limit || 50))
  if (params.search) query.set('search', params.search)
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.mailboxId) query.set('mailboxId', params.mailboxId)
  if (params.includeDone) query.set('includeDone', 'true')
  return apiClient.get<{
    success: boolean
    data: { threads: InboxThread[]; counts?: Record<string, number>; nextCursor?: string | null }
  }>(`/communications/workspace-threads?${query.toString()}`)
}

export async function fetchMailboxes(includeDone = false) {
  const query = new URLSearchParams({
    includeThreadCounts: 'true',
    includeDone: includeDone ? 'true' : 'false'
  })
  return apiClient.get<{
    success: boolean
    data: { mailboxes: Mailbox[] }
  }>(`/mailboxes?${query.toString()}`)
}

export async function fetchThreadMessages(threadId: string) {
  return apiClient.get<{
    success: boolean
    data: {
      threadId: string
      subject?: string
      messageCount?: number
      messages: InboxMessage[]
    }
  }>(`/communications/threads/${encodeURIComponent(threadId)}/messages`)
}

export async function markThreadViewed(threadId: string) {
  return apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/view`, {})
}

export async function setThreadDone(threadId: string, done: boolean) {
  return apiClient.patch<{ success: boolean; message?: string }>(
    `/communications/threads/${encodeURIComponent(threadId)}/done`,
    { done }
  )
}

/** Workspace-scoped send — used for both compose and thread replies. */
export async function sendEmail(payload: {
  to: string[]
  subject: string
  body: string
  parentCommunicationId?: string
  mailboxId?: string
}) {
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mobile-${Date.now()}`

  return apiClient.post(
    '/communications/email',
    {
      standalone: true,
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      parentCommunicationId: payload.parentCommunicationId,
      mailboxId: payload.mailboxId
    },
    {
      headers: {
        'X-Idempotency-Key': idempotencyKey
      }
    }
  )
}
