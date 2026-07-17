const PRODUCTION_API_ORIGIN = 'https://api.arivusystems.com'

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * In local dev, VITE_API_ORIGIN often points at the API port (e.g. :5000) while the SPA
 * is served from Vite (:5173). EventSource/fetch must use same-origin + the Vite proxy
 * instead of connecting directly to the API port (which fails when only Vite is up or
 * ports drift).
 */
function resolveDevSameOriginProxy(explicitOrigin: string): string {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !explicitOrigin) {
    return explicitOrigin
  }
  try {
    const api = new URL(explicitOrigin)
    // In local dev always use the Vite origin + proxy for API hosts on this machine.
    if (LOCAL_DEV_HOSTS.has(api.hostname)) {
      return ''
    }
    const page = window.location
    if (!LOCAL_DEV_HOSTS.has(page.hostname)) {
      return explicitOrigin
    }
    if (api.port !== page.port) {
      return ''
    }
  } catch {
    // ignore malformed origin
  }
  return explicitOrigin
}

/**
 * When the SPA is on app.arivusystems.com (or a tenant *.app.arivusystems.com host) but
 * VITE_API_ORIGIN is unset, use the public API host directly. Vercel rewrites work for
 * fetch() but break long-lived EventSource (notification SSE).
 */
function inferProductionApiOrigin(): string {
  if (!import.meta.env.PROD || typeof window === 'undefined') return ''
  const host = window.location.hostname.toLowerCase()
  if (
    host === 'app.arivusystems.com' ||
    host.endsWith('.app.arivusystems.com') ||
    host.endsWith('.arivusystems.com')
  ) {
    return PRODUCTION_API_ORIGIN
  }
  return ''
}

/**
 * Public API / backend origin for production (optional).
 * - Empty: same-origin requests (Vercel rewrites to Railway, or local Vite proxy).
 * - Set VITE_API_ORIGIN to your API base (e.g. https://api.arivusystems.com) when the SPA and API are on different origins.
 */
export function getApiOrigin(): string {
  const explicitOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '')
  if (explicitOrigin) return resolveDevSameOriginProxy(explicitOrigin)

  const inferred = inferProductionApiOrigin()
  if (inferred) return inferred

  // Backward compatibility: older envs use VITE_API_URL and may include trailing /api.
  const legacyUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (!legacyUrl) return ''
  return resolveDevSameOriginProxy(legacyUrl.replace(/\/api$/, ''))
}

export function withApiOrigin(path: string): string {
  if (!path) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const origin = getApiOrigin()
  const p = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${p}` : p
}

/**
 * Coerce to a single /api/... path (avoids /api/api/ when callers pass /api/... from legacy call sites).
 */
export function normalizeToApiPath(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/api/') || url === '/api') return url
  return '/api' + (url.startsWith('/') ? url : `/${url}`)
}

/**
 * Dev-only: route fetch/EventSource to the API port directly so long-lived SSE does
 * not exhaust the Vite proxy connection pool (which also stalls static assets and POSTs).
 */
function getDevDirectFetchOrigin(): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return ''
  const pageHost = window.location.hostname.toLowerCase()
  if (!LOCAL_DEV_HOSTS.has(pageHost)) return ''

  const explicitOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '')
  if (explicitOrigin) {
    try {
      const api = new URL(explicitOrigin)
      if (LOCAL_DEV_HOSTS.has(api.hostname)) return api.origin
    } catch {
      // ignore
    }
  }

  const legacyUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (legacyUrl) {
    try {
      const api = new URL(legacyUrl.replace(/\/api$/, ''))
      if (LOCAL_DEV_HOSTS.has(api.hostname)) return api.origin
    } catch {
      // ignore
    }
  }

  return 'http://localhost:5000'
}

export function getApiUrlForFetch(url: string): string {
  const path = normalizeToApiPath(url)
  const directOrigin = getDevDirectFetchOrigin()
  if (directOrigin) {
    return `${directOrigin}${path}`
  }
  return withApiOrigin(path)
}

/**
 * Browser media (img, iframe src) should stay same-origin in local dev so Vite can proxy /api.
 * Unlike fetch/SSE, do not route these to the direct API port.
 */
export function getApiUrlForMedia(url: string): string {
  if (!url) return url
  if (url.startsWith('data:') || url.startsWith('blob:')) return url

  let path = url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      path = `${parsed.pathname}${parsed.search}`
    } catch {
      return url
    }
  }

  return withApiOrigin(normalizeToApiPath(path))
}

/** Long-lived SSE streams; same dev direct-origin routing as fetch. */
export function getApiUrlForEventSource(url: string): string {
  return getApiUrlForFetch(url)
}

/**
 * Portal REST lives at /portal/* on the API host (not under /api).
 * Use this for portalApiClient so paths are not double-prefixed with /api.
 */
export function getPortalApiUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  let path = url.startsWith('/') ? url : `/${url}`
  path = path.replace(/^\/api\/portal\//, '/portal/')
  if (!path.startsWith('/portal/')) {
    path = `/portal${path.startsWith('/') ? path : `/${path}`}`
  }
  const directOrigin = getDevDirectFetchOrigin()
  if (directOrigin) {
    return `${directOrigin}${path}`
  }
  return withApiOrigin(path)
}
