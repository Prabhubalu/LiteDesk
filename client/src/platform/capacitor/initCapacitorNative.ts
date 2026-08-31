import type { Router } from 'vue-router'
import { App as CapApp, type URLOpenListenerEvent } from '@capacitor/app'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { PushNotifications } from '@capacitor/push-notifications'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getNativePlatform, isNativeApp } from './nativePlatform'
import apiClient from '@/utils/apiClient'
import { useAuthStore } from '@/stores/authRegistry'

let pushListenersInstalled = false
let lastPushToken: string | null = null

function pathFromDeepLink(url: string): string | null {
  try {
    for (const scheme of ['arivu', 'arivu'] as const) {
      const prefix = `${scheme}://`
      if (url.startsWith(prefix)) {
        const rest = url.slice(prefix.length)
        const path = `/${rest}`.replace(/\/+/g, '/')
        return path === '/' ? '/inbox' : path
      }
    }
    const parsed = new URL(url)
    if (parsed.protocol === 'arivu:' || parsed.protocol === 'arivu:') {
      return `/${parsed.host}${parsed.pathname}`.replace(/\/+/g, '/')
    }
    return parsed.pathname || null
  } catch {
    return null
  }
}

function routeFromPushData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null
  const candidate = String(data.mobileUrl || data.url || '')
  if (!candidate) return null
  if (candidate.startsWith('/')) return candidate
  return pathFromDeepLink(candidate)
}

async function registerNativePushToken(token: string): Promise<void> {
  lastPushToken = token
  const auth = useAuthStore()
  if (!auth?.user?.token) return

  const allowedApps = Array.isArray(auth.user.allowedApps) ? auth.user.allowedApps.map(String) : []
  const appKey = allowedApps.includes('SALES')
    ? 'SALES'
    : allowedApps.includes('AUDIT')
      ? 'AUDIT'
      : allowedApps.includes('PORTAL')
        ? 'PORTAL'
        : 'SALES'

  const platform =
    getNativePlatform() === 'ios' ? 'ios' : getNativePlatform() === 'android' ? 'android' : 'web'

  await apiClient.post(
    '/push/device',
    {
      token,
      platform,
      appKey,
      appVersion: '0.1.0'
    },
    { headers: { 'X-App-Key': appKey } }
  )
}

async function setupPush(router: Router): Promise<void> {
  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  await PushNotifications.register()

  if (pushListenersInstalled) return
  pushListenersInstalled = true

  await PushNotifications.addListener('registration', (event) => {
    void registerNativePushToken(event.value).catch((err) => {
      console.error('[capacitor] push register failed', err)
    })
  })

  await PushNotifications.addListener('registrationError', (event) => {
    console.error('[capacitor] push registration error', event.error)
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const path = routeFromPushData(event.notification.data as Record<string, unknown>)
    if (path) void router.push(path)
  })
}

function setupDeepLinks(router: Router): void {
  void CapApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const path = pathFromDeepLink(event.url)
    if (path) void router.push(path)
  })
}

async function setupChrome(): Promise<void> {
  try {
    // Draw under status bar; CSS --safe-area-top offsets fixed chrome so taps work.
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {
    // optional
  }
  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
  } catch {
    // optional
  }
}

/**
 * Native-only bootstrap for Capacitor shell hosting the desktop SPA.
 */
export async function initCapacitorNative(router: Router): Promise<void> {
  if (!isNativeApp()) return

  document.documentElement.classList.add('capacitor-native')
  await setupChrome()
  setupDeepLinks(router)
  try {
    await setupPush(router)
  } catch (err) {
    console.warn('[capacitor] push setup skipped', err)
  }
}

/** Call after login so a token obtained pre-auth is uploaded. */
export async function syncCapacitorPushTokenAfterLogin(): Promise<void> {
  if (!isNativeApp() || !lastPushToken) return
  await registerNativePushToken(lastPushToken)
}
