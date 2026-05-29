const PRODUCTION_API_ORIGIN = 'https://api.arivusystems.com'

/**
 * When the SPA is on app.arivusystems.com (or a tenant *.app.arivusystems.com host) but
 * VITE_API_ORIGIN is unset, use the public API host directly. Vercel rewrites work for
 * fetch() but break long-lived EventSource (notification SSE).
 */
function inferProductionApiOrigin(): string {
  if (!import.meta.env.PROD || typeof window === 'undefined') return ''
  const host = window.location.hostname.toLowerCase()
  if (host === 'app.arivusystems.com' || host.endsWith('.app.arivusystems.com')) {
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
  if (explicitOrigin) return explicitOrigin

  const inferred = inferProductionApiOrigin()
  if (inferred) return inferred

  // Backward compatibility: older envs use VITE_API_URL and may include trailing /api.
  const legacyUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (!legacyUrl) return ''
  return legacyUrl.replace(/\/api$/, '')
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

export function getApiUrlForFetch(url: string): string {
  return withApiOrigin(normalizeToApiPath(url))
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
  return withApiOrigin(path)
}
