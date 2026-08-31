export const APP_STORAGE_PREFIX = 'arivu'
/** Pre-rebrand local storage namespace — migrated automatically on read. */
export const LEGACY_STORAGE_PREFIX = 'litedesk'

export const DEEP_LINK_SCHEME = 'arivu'
/** Older push payloads may still use this scheme until server caches expire. */
export const LEGACY_DEEP_LINK_SCHEME = 'litedesk'

export const DEEP_LINK_SCHEMES = [DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME] as const

export function appStorageKey(name: string): string {
  return `${APP_STORAGE_PREFIX}.${name}`
}

export function legacyStorageKey(name: string): string {
  return `${LEGACY_STORAGE_PREFIX}.${name}`
}

export function pathFromDeepLink(url: string): string | null {
  try {
    for (const scheme of DEEP_LINK_SCHEMES) {
      const prefix = `${scheme}://`
      if (url.startsWith(prefix)) {
        const rest = url.slice(prefix.length)
        return `/${rest}`.replace(/\/+/g, '/')
      }
    }
    const parsed = new URL(url)
    const protocol = parsed.protocol.replace(':', '')
    if (DEEP_LINK_SCHEMES.includes(protocol as (typeof DEEP_LINK_SCHEMES)[number])) {
      return `/${parsed.host}${parsed.pathname}`.replace(/\/+/g, '/')
    }
    return parsed.pathname || null
  } catch {
    return null
  }
}
