import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { appStorageKey, legacyStorageKey } from '@/config/appBrand'

const USER_KEY = appStorageKey('user')
const LEGACY_USER_KEY = legacyStorageKey('user')
const ORG_KEY = appStorageKey('organization')
const LEGACY_ORG_KEY = legacyStorageKey('organization')

export type StoredUser = {
  _id: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  permissions?: unknown
  token: string
  organizationId?: string
  allowedApps?: string[]
  appAccess?: unknown
  [key: string]: unknown
}

export type StoredOrganization = {
  _id?: string
  name?: string
  slug?: string
  [key: string]: unknown
}

async function setJson(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value)
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value: serialized })
    return
  }
  localStorage.setItem(key, serialized)
}

async function getJson<T>(key: string): Promise<T | null> {
  let raw: string | null = null
  if (Capacitor.isNativePlatform()) {
    const result = await Preferences.get({ key })
    raw = result.value
  } else {
    raw = localStorage.getItem(key)
  }
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function removeKey(key: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key })
    return
  }
  localStorage.removeItem(key)
}

async function getJsonWithMigration<T>(key: string, legacyKey: string): Promise<T | null> {
  const current = await getJson<T>(key)
  if (current) return current
  const legacy = await getJson<T>(legacyKey)
  if (!legacy) return null
  await setJson(key, legacy)
  await removeKey(legacyKey)
  return legacy
}

export async function saveSession(user: StoredUser, organization: StoredOrganization | null): Promise<void> {
  await setJson(USER_KEY, user)
  if (organization) {
    await setJson(ORG_KEY, organization)
  } else {
    await removeKey(ORG_KEY)
    await removeKey(LEGACY_ORG_KEY)
  }
}

export async function loadSession(): Promise<{
  user: StoredUser | null
  organization: StoredOrganization | null
}> {
  const user = await getJsonWithMigration<StoredUser>(USER_KEY, LEGACY_USER_KEY)
  const organization = await getJsonWithMigration<StoredOrganization>(ORG_KEY, LEGACY_ORG_KEY)
  return { user, organization }
}

export async function clearSession(): Promise<void> {
  await removeKey(USER_KEY)
  await removeKey(LEGACY_USER_KEY)
  await removeKey(ORG_KEY)
  await removeKey(LEGACY_ORG_KEY)
}
