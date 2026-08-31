import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { appStorageKey, legacyStorageKey } from '@/config/appBrand'

const valueCache = new Map<string, string | null>()

async function readRaw(key: string): Promise<string | null> {
  if (valueCache.has(key)) {
    return valueCache.get(key) ?? null
  }

  let value: string | null = null
  if (Capacitor.isNativePlatform()) {
    const result = await Preferences.get({ key })
    value = result.value
  } else {
    value = localStorage.getItem(key)
  }
  valueCache.set(key, value)
  return value
}

async function writeRaw(key: string, value: string): Promise<void> {
  valueCache.set(key, value)
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value })
    return
  }
  localStorage.setItem(key, value)
}

async function removeRaw(key: string): Promise<void> {
  valueCache.set(key, null)
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key })
    return
  }
  localStorage.removeItem(key)
}

/** Read a persisted value, migrating legacy storage keys when needed. */
export async function readStoredValue(name: string): Promise<string | null> {
  const key = appStorageKey(name)
  const current = await readRaw(key)
  if (current !== null) return current

  const legacy = await readRaw(legacyStorageKey(name))
  if (legacy === null) return null

  await writeRaw(key, legacy)
  await removeRaw(legacyStorageKey(name))
  return legacy
}

export async function writeStoredValue(name: string, value: string): Promise<void> {
  await writeRaw(appStorageKey(name), value)
}

export async function removeStoredValue(name: string): Promise<void> {
  await removeRaw(appStorageKey(name))
  await removeRaw(legacyStorageKey(name))
}

export async function readStoredFlag(name: string): Promise<boolean> {
  return (await readStoredValue(name)) === '1'
}

export async function writeStoredFlag(name: string, enabled: boolean): Promise<void> {
  if (enabled) await writeStoredValue(name, '1')
  else await removeStoredValue(name)
}
