import { App as CapApp, type URLOpenListenerEvent } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { Router } from 'vue-router'
import { pathFromDeepLink } from '@/config/appBrand'

export { pathFromDeepLink } from '@/config/appBrand'

export function installDeepLinks(router: Router): void {
  if (!Capacitor.isNativePlatform()) return

  void CapApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const path = pathFromDeepLink(event.url)
    if (path) {
      void router.push(path)
    }
  })
}

export function routeFromPushData(data: Record<string, string> | undefined): string | null {
  if (!data) return null
  const candidate = data.mobileUrl || data.url || ''
  if (!candidate) return null
  const fromScheme = pathFromDeepLink(candidate)
  if (fromScheme) return fromScheme
  if (candidate.startsWith('/')) return candidate
  try {
    return new URL(candidate).pathname
  } catch {
    return null
  }
}
