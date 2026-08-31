import { Capacitor } from '@capacitor/core'
import { isNativeSimulator } from '@/utils/nativePlatform'

const rawOrigin = (import.meta.env.VITE_API_ORIGIN || import.meta.env.VITE_API_URL || '').trim()

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function stripApiSuffix(value: string): string {
  return value.replace(/\/api\/?$/, '')
}

function rewriteLocalhostForNative(origin: string): string {
  if (!Capacitor.isNativePlatform()) return origin
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') {
      // Android emulator reaches host machine via 10.0.2.2
      if (Capacitor.getPlatform() === 'android') {
        url.hostname = '10.0.2.2'
      }
    }
    return stripTrailingSlash(url.toString())
  } catch {
    return origin
  }
}

/** API origin without trailing slash or /api suffix. */
export function getApiOrigin(): string {
  if (!rawOrigin && Capacitor.isNativePlatform() && isNativeSimulator()) {
    return Capacitor.getPlatform() === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000'
  }

  let origin = rawOrigin
    ? stripTrailingSlash(stripApiSuffix(rawOrigin))
    : typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://api.arivusystems.com'

  origin = rewriteLocalhostForNative(origin)
  return origin
}

/** Normalize path to absolute /api/... URL. */
export function getApiUrl(path: string): string {
  const normalized = path.startsWith('/api/')
    ? path
    : path.startsWith('/')
      ? `/api${path}`
      : `/api/${path}`
  return `${getApiOrigin()}${normalized}`
}
