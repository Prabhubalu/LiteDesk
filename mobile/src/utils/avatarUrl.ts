import { getApiOrigin } from '@/config/apiBase'

export function resolveAvatarUrl(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  return `${getApiOrigin()}${value.startsWith('/') ? value : `/${value}`}`
}
