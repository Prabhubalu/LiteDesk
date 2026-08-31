import { Capacitor } from '@capacitor/core'

let lockCount = 0
let previousBodyOverflow = ''

/** WKWebView on iOS can drop touches on fixed overlays when body scroll is locked. */
function shouldLockBodyScroll(): boolean {
  return typeof document !== 'undefined' && !Capacitor.isNativePlatform()
}

export function lockBodyScroll(): void {
  if (!shouldLockBodyScroll()) return
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('sheet-open')
  }
  lockCount += 1
}

export function unlockBodyScroll(): void {
  if (!shouldLockBodyScroll()) return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.classList.remove('sheet-open')
}

export function resetBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount = 0
  if (shouldLockBodyScroll()) {
    document.body.style.overflow = ''
  }
  document.documentElement.classList.remove('sheet-open')
}
