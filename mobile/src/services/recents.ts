import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { appStorageKey, legacyStorageKey } from '@/config/appBrand'

const RECENTS_KEY = appStorageKey('recents')
const LEGACY_RECENTS_KEY = legacyStorageKey('recents')
const MAX_RECENTS = 20

export type RecentItem = {
  id: string
  moduleKey: string
  title: string
  path: string
  viewedAt: string
}

async function readRawKey(key: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const result = await Preferences.get({ key })
    return result.value
  }
  return localStorage.getItem(key)
}

async function writeRawKey(key: string, value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value })
    return
  }
  localStorage.setItem(key, value)
}

async function removeRawKey(key: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key })
    return
  }
  localStorage.removeItem(key)
}

function parseRecents(raw: string | null): RecentItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as RecentItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function readRaw(): Promise<RecentItem[]> {
  const current = parseRecents(await readRawKey(RECENTS_KEY))
  if (current.length) return current

  const legacy = parseRecents(await readRawKey(LEGACY_RECENTS_KEY))
  if (!legacy.length) return []

  await writeRawKey(RECENTS_KEY, JSON.stringify(legacy))
  await removeRawKey(LEGACY_RECENTS_KEY)
  return legacy
}

async function writeRaw(items: RecentItem[]): Promise<void> {
  const serialized = JSON.stringify(items.slice(0, MAX_RECENTS))
  await writeRawKey(RECENTS_KEY, serialized)
}

export async function getRecents(limit = 8): Promise<RecentItem[]> {
  const items = await readRaw()
  return items.slice(0, limit)
}

export async function addRecent(item: Omit<RecentItem, 'viewedAt'>): Promise<void> {
  const existing = await readRaw()
  const next: RecentItem = { ...item, viewedAt: new Date().toISOString() }
  const filtered = existing.filter((row) => row.path !== item.path)
  await writeRaw([next, ...filtered])
}

export async function clearRecents(): Promise<void> {
  await writeRaw([])
}
