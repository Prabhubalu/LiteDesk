import { Capacitor } from '@capacitor/core'

let simulatorCached: boolean | null = null

function detectIosSimulator(): boolean {
  const ua = navigator.userAgent
  if (/Simulator/i.test(ua)) return true

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return false
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return false
    const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    return /simulator/i.test(renderer)
  } catch {
    return false
  }
}

export function isNativeSimulator(): boolean {
  if (!Capacitor.isNativePlatform()) return false
  if (simulatorCached !== null) return simulatorCached

  if (Capacitor.getPlatform() === 'ios') {
    simulatorCached = detectIosSimulator()
  } else if (Capacitor.getPlatform() === 'android') {
    simulatorCached = /sdk_gphone|Android SDK built for x86|emulator/i.test(navigator.userAgent)
  } else {
    simulatorCached = false
  }

  return simulatorCached
}
