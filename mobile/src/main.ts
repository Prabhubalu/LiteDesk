import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import App from './App.vue'
import router from './router'
import { installBiometricAppLock } from './services/biometricUnlock'
import { installDeepLinks } from './services/deepLinks'
import { setupPushNotifications } from './services/push'
import { isNativeSimulator } from './utils/nativePlatform'
import './style.css'

function syncSafeAreaInsets(): void {
  if (!document.body) return
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;inset:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const top = parseFloat(style.paddingTop) || 0
  const bottom = parseFloat(style.paddingBottom) || 0
  probe.remove()
  if (top > 0) document.documentElement.style.setProperty('--safe-top', `${top}px`)
  if (bottom > 0) document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`)
}

async function hideSplashScreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await SplashScreen.hide()
  } catch {
    // optional on web/simulator
  }
}

async function syncStatusBarAppearance(): Promise<void> {
  const theme = document.documentElement.getAttribute('data-theme')
  const prefersDark =
    theme === 'dark' ||
    (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  await StatusBar.setStyle({ style: prefersDark ? Style.Light : Style.Dark })
  if (Capacitor.getPlatform() === 'android') {
    await StatusBar.setBackgroundColor({ color: prefersDark ? '#0a0f1a' : '#eceef2' })
  }
}

async function configureStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
    await syncStatusBarAppearance()
  } catch {
    // optional on web/simulator
  }
}

async function setupNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  syncSafeAreaInsets()
  window.addEventListener('resize', syncSafeAreaInsets)
  await configureStatusBar()

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
  } catch {
    // optional
  }

  if (isNativeSimulator()) {
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: true })
    } catch {
      // unimplemented on Android
    }
    return
  }

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: true })
  } catch {
    // unimplemented on Android
  }
}

function deferNativeServices(): void {
  if (!Capacitor.isNativePlatform() || isNativeSimulator()) return
  window.setTimeout(() => {
    void setupPushNotifications(router).catch((err) => {
      console.warn('[mobile] push setup skipped', err)
    })
  }, 2000)
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor-native')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

installDeepLinks(router)
installBiometricAppLock()

void router.isReady().then(async () => {
  app.mount('#app')
  await nextTick()
  await hideSplashScreen()
  void setupNativeChrome()
  deferNativeServices()
})
