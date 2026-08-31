import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getApiOrigin, getApiUrl } from '@/config/apiBase'
import { lock, saveLastAvatar } from '@/services/biometricUnlock'
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredOrganization,
  type StoredUser
} from '@/services/sessionStorage'
import { formatUserDisplayName } from '@/utils/userDisplayName'

type LoginCredentials = {
  email: string
  password: string
}

export type SessionLimitState = {
  challengeId: string
  message?: string
  deviceClass?: string
  sessions: Array<{
    id?: string
    _id?: string
    deviceClass?: string
    userAgent?: string
    ip?: string
    createdAt?: string
    lastSeenAt?: string
  }>
}

function normalizeUser(data: Record<string, unknown>): StoredUser {
  const token = String(data.token || '')
  return {
    ...data,
    _id: String(data._id || data.id || ''),
    token,
    email: data.email ? String(data.email) : undefined,
    username: data.username ? String(data.username) : undefined,
    firstName: data.firstName ? String(data.firstName) : data.first_name ? String(data.first_name) : undefined,
    lastName: data.lastName ? String(data.lastName) : data.last_name ? String(data.last_name) : undefined,
    role: data.role ? String(data.role) : undefined,
    avatar: data.avatar ? String(data.avatar) : undefined,
    isOwner: data.isOwner === true,
    permissions: data.permissions,
    organizationId: data.organizationId ? String(data.organizationId) : undefined,
    allowedApps: Array.isArray(data.allowedApps)
      ? data.allowedApps.map(String)
      : undefined
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<StoredUser | null>(null)
  const organization = ref<StoredOrganization | null>(null)
  const bootstrapped = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sessionLimit = ref<SessionLimitState | null>(null)

  const token = computed(() => user.value?.token || '')
  const isAuthenticated = computed(() => {
    const t = token.value
    return Boolean(t && t !== 'undefined' && t !== 'null')
  })

  const preferredAppKey = computed(() => {
    const apps = user.value?.allowedApps || []
    if (apps.includes('SALES')) return 'SALES'
    if (apps.includes('AUDIT')) return 'AUDIT'
    if (apps.includes('PORTAL')) return 'PORTAL'
    return 'SALES'
  })

  const displayName = computed(() => formatUserDisplayName(user.value))

  /** Desktop stores relative upload paths; resolve them against the API origin. */
  const avatarUrl = computed(() => {
    const raw = String(user.value?.avatar || '').trim()
    if (!raw) return ''
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw
    return `${getApiOrigin()}${raw.startsWith('/') ? raw : `/${raw}`}`
  })

  async function bootstrap(): Promise<void> {
    const session = await loadSession()
    user.value = session.user
    organization.value = session.organization
    bootstrapped.value = true
  }

  async function applySession(payload: Record<string, unknown>): Promise<void> {
    const nextUser = normalizeUser(payload)
    const org =
      payload.organization && typeof payload.organization === 'object'
        ? (payload.organization as StoredOrganization)
        : null
    user.value = nextUser
    organization.value = org
    sessionLimit.value = null
    await saveSession(nextUser, org)
    if (nextUser.avatar) {
      void saveLastAvatar(String(nextUser.avatar))
    }
  }

  function captureSessionLimit(data: Record<string, unknown>): void {
    sessionLimit.value = {
      challengeId: String(data.challengeId || ''),
      message: data.message ? String(data.message) : undefined,
      deviceClass: data.deviceClass ? String(data.deviceClass) : undefined,
      sessions: Array.isArray(data.sessions)
        ? (data.sessions as SessionLimitState['sessions'])
        : []
    }
  }

  async function login(credentials: LoginCredentials): Promise<{ sessionLimit?: boolean }> {
    loading.value = true
    error.value = null
    sessionLimit.value = null
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 30_000)
      let response: Response
      try {
        response = await fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(credentials),
          signal: controller.signal
        })
      } finally {
        window.clearTimeout(timeout)
      }
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (response.status === 409 && body.code === 'SESSION_LIMIT' && body.challengeId) {
        captureSessionLimit(body)
        return { sessionLimit: true }
      }
      if (!response.ok) {
        throw new Error(String(body?.message || 'Login failed'))
      }
      await applySession(body)
      return {}
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        error.value = 'Sign-in timed out. Check your connection and try again.'
        throw new Error(error.value)
      }
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function revokeSession(sessionId: string): Promise<boolean> {
    if (!sessionLimit.value?.challengeId || !sessionId) return false
    loading.value = true
    error.value = null
    try {
      const response = await fetch(getApiUrl(`/api/auth/sessions/${encodeURIComponent(sessionId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Login-Challenge': sessionLimit.value.challengeId
        },
        body: JSON.stringify({
          challengeId: sessionLimit.value.challengeId,
          deviceClass: sessionLimit.value.deviceClass
        })
      })
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (response.status === 409 && body.code === 'SESSION_LIMIT' && body.challengeId) {
        captureSessionLimit(body)
        return true
      }
      if (!response.ok) {
        throw new Error(String(body.message || 'Unable to free session'))
      }
      if (body.challengeId) {
        captureSessionLimit(body)
      }
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to free session'
      return false
    } finally {
      loading.value = false
    }
  }

  async function continueAfterSessionLimit(): Promise<boolean> {
    if (!sessionLimit.value?.challengeId) {
      error.value = 'Session challenge expired. Please sign in again.'
      return false
    }
    loading.value = true
    error.value = null
    try {
      const response = await fetch(getApiUrl('/api/auth/login/continue'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Login-Challenge': sessionLimit.value.challengeId
        },
        body: JSON.stringify({ challengeId: sessionLimit.value.challengeId })
      })
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (response.status === 409 && body.code === 'SESSION_LIMIT' && body.challengeId) {
        captureSessionLimit(body)
        return false
      }
      if (!response.ok) {
        throw new Error(String(body.message || 'Unable to continue sign-in'))
      }
      await applySession(body)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to continue sign-in'
      return false
    } finally {
      loading.value = false
    }
  }

  /** Login payload omits profile fields (avatar), so hydrate them from /users/profile. */
  async function refreshProfile(): Promise<void> {
    if (!isAuthenticated.value || !user.value) return
    try {
      const { apiClient } = await import('@/api/client')
      const res = await apiClient.get<{ data?: Record<string, unknown> }>('/users/profile')
      const profile = res?.data
      if (!profile) return
      const nextUser: StoredUser = {
        ...user.value,
        avatar: profile.avatar ? String(profile.avatar) : user.value.avatar || '',
        username: profile.username ? String(profile.username) : user.value.username,
        email: profile.email ? String(profile.email) : user.value.email,
        firstName: profile.firstName
          ? String(profile.firstName)
          : profile.first_name
            ? String(profile.first_name)
            : user.value.firstName,
        lastName: profile.lastName
          ? String(profile.lastName)
          : profile.last_name
            ? String(profile.last_name)
            : user.value.lastName,
        role: profile.role ? String(profile.role) : user.value.role
      }
      user.value = nextUser
      await saveSession(nextUser, organization.value)
      if (nextUser.avatar) {
        void saveLastAvatar(String(nextUser.avatar))
      }
    } catch {
      /* non-blocking: keep cached session values */
    }
  }

  async function registerPushToken(tokenValue: string): Promise<void> {
    if (!isAuthenticated.value) return
    const { apiClient } = await import('@/api/client')
    const { Capacitor } = await import('@capacitor/core')
    const platform =
      Capacitor.getPlatform() === 'ios'
        ? 'ios'
        : Capacitor.getPlatform() === 'android'
          ? 'android'
          : 'web'
    await apiClient.post(
      '/push/device',
      {
        token: tokenValue,
        platform,
        appKey: preferredAppKey.value,
        appVersion: '0.1.0'
      },
      { appKey: preferredAppKey.value }
    )
  }

  async function logout(options: { silent?: boolean } = {}): Promise<void> {
    user.value = null
    organization.value = null
    sessionLimit.value = null
    lock()
    await clearSession()
    if (!options.silent) {
      error.value = null
    }
  }

  return {
    user,
    organization,
    bootstrapped,
    loading,
    error,
    sessionLimit,
    token,
    isAuthenticated,
    preferredAppKey,
    displayName,
    avatarUrl,
    bootstrap,
    login,
    logout,
    refreshProfile,
    registerPushToken,
    revokeSession,
    continueAfterSessionLimit
  }
})
