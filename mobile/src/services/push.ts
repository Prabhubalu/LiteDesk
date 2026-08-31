import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { routeFromPushData } from '@/services/deepLinks'
import { isNativeSimulator } from '@/utils/nativePlatform'

let listenersInstalled = false
let lastToken: string | null = null

async function registerToken(token: string): Promise<void> {
  lastToken = token
  const auth = useAuthStore()
  if (!auth.isAuthenticated) return
  await auth.registerPushToken(token)
}

export async function syncPushTokenAfterLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (lastToken) {
    await registerToken(lastToken)
  }
}

export async function setupPushNotifications(router: Router): Promise<void> {
  if (!Capacitor.isNativePlatform() || isNativeSimulator()) return

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') {
    console.warn('[push] permission not granted')
    return
  }

  await PushNotifications.register()

  if (listenersInstalled) return
  listenersInstalled = true

  await PushNotifications.addListener('registration', (event) => {
    void registerToken(event.value).catch((err) => {
      console.error('[push] device register failed', err)
    })
  })

  await PushNotifications.addListener('registrationError', (event) => {
    console.error('[push] registration error', event.error)
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const data = (event.notification.data || {}) as Record<string, string>
    const path = routeFromPushData(data)
    if (path) {
      void router.push(path)
    }
  })
}
