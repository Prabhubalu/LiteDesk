import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function getNativePlatform(): string {
  try {
    return Capacitor.getPlatform()
  } catch {
    return 'web'
  }
}

/**
 * Android emulator cannot reach the host via localhost — use 10.0.2.2.
 * iOS simulator can use localhost.
 */
export function rewriteOriginForNativeDevice(origin: string): string {
  if (!origin || !isNativeApp()) return origin
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    if (
      getNativePlatform() === 'android' &&
      (host === 'localhost' || host === '127.0.0.1')
    ) {
      url.hostname = '10.0.2.2'
      return url.origin
    }
  } catch {
    return origin
  }
  return origin
}
