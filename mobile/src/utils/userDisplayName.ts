type NameFields = {
  firstName?: string
  lastName?: string
  first_name?: string
  last_name?: string
  username?: string
  email?: string
}

export function formatUserDisplayName(user: NameFields | null | undefined): string {
  const first = String(user?.firstName || user?.first_name || '').trim()
  const last = String(user?.lastName || user?.last_name || '').trim()
  const full = [first, last].filter(Boolean).join(' ').trim()
  if (full) return full
  const username = String(user?.username || '').trim()
  if (username) return username
  const email = String(user?.email || '').trim()
  return email || 'User'
}

export function userFirstName(user: NameFields | null | undefined): string {
  const first = String(user?.firstName || user?.first_name || '').trim()
  if (first) return first
  const display = formatUserDisplayName(user)
  return display.split(/\s+/)[0] || display
}
