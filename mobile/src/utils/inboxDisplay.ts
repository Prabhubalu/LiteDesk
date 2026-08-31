import type { InboxThread } from '@/api/inbox'

const AVATAR_COLORS = [
  '#6049E7',
  '#2383E2',
  '#0EA5A4',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#10B981',
  '#EC4899'
]

function humanizeEmailLocal(value: string): string {
  const email = value.trim()
  const local = email.includes('@') ? email.split('@')[0] : email
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** Mirrors client/src/utils/emailParticipantDisplay.js displayNameFromAddress. */
export function displayNameFromAddress(raw: string | undefined | null): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (/^you$/i.test(s)) return 'You'

  const angle = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/)
  if (angle) {
    const name = angle[1].trim()
    if (name && !name.includes('@')) return name
    return humanizeEmailLocal(angle[2] || angle[1])
  }

  if (s.includes('@')) return humanizeEmailLocal(s)
  return s
}

/** Mirrors desktop threadListSenderLine so mobile and web show the same name. */
export function threadSenderLine(thread: InboxThread): string {
  const recordLabel = String(thread.recordLabel || '').trim()
  const moduleKey = String(thread.relatedTo?.moduleKey || '').toLowerCase()
  if (recordLabel && recordLabel !== '—' && (moduleKey === 'people' || moduleKey === 'organizations')) {
    return recordLabel
  }

  const participants = String(thread.participantDisplay || '').trim()
  if (!participants) {
    return recordLabel && recordLabel !== '—' ? recordLabel : 'Unknown'
  }

  const names: string[] = []
  for (const side of participants.split(/\s*↔\s*/)) {
    const segment = side.trim()
    if (!segment) continue
    if (/^you$/i.test(segment)) {
      names.push('You')
      continue
    }
    for (const piece of segment.split(',')) {
      const name = displayNameFromAddress(piece.trim())
      if (name) names.push(name)
    }
  }

  const others = names.filter((n) => n !== 'You')
  if (others.length === 0) return names.includes('You') ? 'You' : 'Unknown'
  if (others.length === 1) return others[0]
  if (others.length === 2) return others.join(', ')
  return `${others.slice(0, 2).join(', ')} +${others.length - 2}`
}

export function initialsFor(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

/** Gmail-style compact stamp: time today, "16 Aug" this year, else short date. */
export function formatThreadStamp(value: string | undefined | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  if (startOfDay(date) === startOfDay(now)) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date)
}

export function formatMessageStamp(value: string | undefined | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export type ThreadGroup = {
  key: 'today' | 'yesterday' | 'earlier'
  label: string
  threads: InboxThread[]
}

export function threadActivityAt(thread: InboxThread): string {
  return String(thread.lastActivityAt || thread.firstActivityAt || '')
}

/** Same Today / Yesterday / Earlier buckets as the desktop Inbox list. */
export function groupThreadsByDay(threads: InboxThread[]): ThreadGroup[] {
  const now = new Date()
  const todayStart = startOfDay(now)
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  const groups: ThreadGroup[] = [
    { key: 'today', label: 'Today', threads: [] },
    { key: 'yesterday', label: 'Yesterday', threads: [] },
    { key: 'earlier', label: 'Earlier', threads: [] }
  ]

  for (const thread of threads) {
    const raw = threadActivityAt(thread)
    const ts = raw ? new Date(raw).getTime() : Number.NaN
    if (Number.isFinite(ts) && ts >= todayStart) groups[0].threads.push(thread)
    else if (Number.isFinite(ts) && ts >= yesterdayStart) groups[1].threads.push(thread)
    else groups[2].threads.push(thread)
  }

  return groups.filter((group) => group.threads.length > 0)
}

/** Secondary line under the subject: record, assignee, message count. */
export function threadContextLine(thread: InboxThread): string {
  const bits: string[] = []
  const recordLabel = String(thread.recordLabel || '').trim()
  if (recordLabel && recordLabel !== '—') bits.push(recordLabel)
  if (thread.assignedToDisplay) bits.push(`→ ${thread.assignedToDisplay}`)
  if ((thread.messageCount || 0) > 1) bits.push(`${thread.messageCount} messages`)
  return bits.join(' · ')
}

export function stripEmailHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Split a reply body from its quoted history so mobile can collapse the quote. */
export function splitQuotedReply(body: string): { visible: string; quoted: string } {
  const lines = body.split('\n')
  const quoteStart = lines.findIndex((line) =>
    /^>/.test(line.trim()) ||
    /^On .+wrote:$/i.test(line.trim()) ||
    /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
    /^From:\s/i.test(line.trim())
  )
  if (quoteStart <= 0) return { visible: body, quoted: '' }
  return {
    visible: lines.slice(0, quoteStart).join('\n').trim(),
    quoted: lines.slice(quoteStart).join('\n').trim()
  }
}
