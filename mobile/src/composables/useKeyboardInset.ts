import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

export function useKeyboardInset(enabled: Ref<boolean>) {
  const keyboardInset = ref(0)

  function syncVisualViewport() {
    const viewport = window.visualViewport
    if (!viewport) return
    keyboardInset.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
  }

  let removeListeners: (() => void) | undefined

  async function attach() {
    if (removeListeners) return

    if (Capacitor.isNativePlatform()) {
      const handles = await Promise.all([
        Keyboard.addListener('keyboardWillShow', (info) => {
          if (enabled.value) keyboardInset.value = info.keyboardHeight
        }),
        Keyboard.addListener('keyboardWillHide', () => {
          if (enabled.value) keyboardInset.value = 0
        })
      ])
      removeListeners = () => {
        handles.forEach((handle) => void handle.remove())
      }
      return
    }

    const viewport = window.visualViewport
    if (!viewport) return

    const onChange = () => {
      if (enabled.value) syncVisualViewport()
    }
    viewport.addEventListener('resize', onChange)
    viewport.addEventListener('scroll', onChange)
    removeListeners = () => {
      viewport.removeEventListener('resize', onChange)
      viewport.removeEventListener('scroll', onChange)
    }
  }

  function detach() {
    removeListeners?.()
    removeListeners = undefined
    keyboardInset.value = 0
  }

  watch(
    enabled,
    (active) => {
      if (active) {
        void attach()
        return
      }
      detach()
    },
    { immediate: true }
  )

  onBeforeUnmount(detach)

  return { keyboardInset }
}
