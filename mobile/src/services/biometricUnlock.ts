import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { isNativeSimulator } from '@/utils/nativePlatform'
import {
  readStoredFlag,
  readStoredValue,
  removeStoredValue,
  writeStoredFlag,
  writeStoredValue
} from '@/utils/appStorage'

export type BiometricLabel = 'Face ID' | 'Touch ID' | 'Biometrics'

type BiometryTypeEnum = {
  faceId: number
  touchId: number
  faceAuthentication: number
  fingerprintAuthentication: number
}

type BiometricModule = typeof import('@aparajita/capacitor-biometric-auth')

let unlocked = false
let appListenerInstalled = false
let biometricModule: BiometricModule | null = null

async function withBiometricTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('biometric_timeout')), ms)
      })
    ])
  } finally {
    if (timer !== undefined) window.clearTimeout(timer)
  }
}

async function loadBiometricModule(): Promise<BiometricModule | null> {
  if (!Capacitor.isNativePlatform() || isNativeSimulator()) return null
  if (!biometricModule) {
    try {
      biometricModule = await import('@aparajita/capacitor-biometric-auth')
    } catch {
      return null
    }
  }
  return biometricModule
}

function biometricLabel(type: number, BiometryType: BiometryTypeEnum): BiometricLabel {
  if (type === BiometryType.faceId || type === BiometryType.faceAuthentication) return 'Face ID'
  if (type === BiometryType.touchId || type === BiometryType.fingerprintAuthentication) return 'Touch ID'
  return 'Biometrics'
}

function isUserCancelledBiometry(err: unknown, BiometryErrorType: BiometricModule['BiometryErrorType']): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : ''
  return (
    code === BiometryErrorType.userCancel ||
    code === BiometryErrorType.systemCancel ||
    code === BiometryErrorType.appCancel
  )
}

export async function getBiometricSupport(): Promise<{
  available: boolean
  label: BiometricLabel
}> {
  if (isNativeSimulator()) return { available: false, label: 'Biometrics' }
  const mod = await loadBiometricModule()
  if (!mod) return { available: false, label: 'Biometrics' }
  try {
    const result = await withBiometricTimeout(mod.BiometricAuth.checkBiometry())
    return {
      available: result.isAvailable,
      label: biometricLabel(result.biometryType, mod.BiometryType)
    }
  } catch {
    return { available: false, label: 'Biometrics' }
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || isNativeSimulator()) return false
  return readStoredFlag('biometric.enabled')
}

export async function setBiometricEnabled(value: boolean): Promise<void> {
  await writeStoredFlag('biometric.enabled', value)
  if (!value) unlocked = false
}

export async function saveLastEmail(email: string): Promise<void> {
  const trimmed = email.trim()
  if (!trimmed) return
  await writeStoredValue('auth.lastEmail', trimmed)
}

export async function getLastEmail(): Promise<string | null> {
  return readStoredValue('auth.lastEmail')
}

export async function clearLastEmail(): Promise<void> {
  await removeStoredValue('auth.lastEmail')
  await removeStoredValue('auth.lastAvatar')
}

export async function saveLastAvatar(avatar: string | null | undefined): Promise<void> {
  const trimmed = String(avatar || '').trim()
  if (!trimmed) {
    await removeStoredValue('auth.lastAvatar')
    return
  }
  await writeStoredValue('auth.lastAvatar', trimmed)
}

export async function getLastAvatar(): Promise<string | null> {
  return readStoredValue('auth.lastAvatar')
}

export function isUnlocked(): boolean {
  return unlocked
}

export function markUnlocked(): void {
  unlocked = true
}

export function lock(): void {
  unlocked = false
}

export async function requiresBiometricUnlock(isAuthenticated: boolean): Promise<boolean> {
  if (!isAuthenticated || !Capacitor.isNativePlatform() || isNativeSimulator()) return false
  return isBiometricEnabled()
}

export async function authenticateBiometric(reason: string): Promise<boolean> {
  if (isNativeSimulator()) return false
  const mod = await loadBiometricModule()
  if (!mod) return false
  try {
    await withBiometricTimeout(
      mod.BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Use passcode'
      })
    )
    markUnlocked()
    return true
  } catch (err) {
    if (isUserCancelledBiometry(err, mod.BiometryErrorType)) return false
    throw err
  }
}

export function installBiometricAppLock(): void {
  if (!Capacitor.isNativePlatform() || appListenerInstalled) return
  appListenerInstalled = true
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) lock()
  })
}
