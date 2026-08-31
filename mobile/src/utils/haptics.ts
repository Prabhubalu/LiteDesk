import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativeSimulator } from '@/utils/nativePlatform'

function shouldUseHaptics(): boolean {
  return Capacitor.isNativePlatform() && !isNativeSimulator()
}

export function tapHaptic(): void {
  if (!shouldUseHaptics()) return
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
}

export function successHaptic(): void {
  if (!shouldUseHaptics()) return
  void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined)
}

export function errorHaptic(): void {
  if (!shouldUseHaptics()) return
  void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined)
}
