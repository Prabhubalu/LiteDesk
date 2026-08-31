import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Mirrors client/src/composables/useUserStatus.js — localStorage only (no Capacitor bridge).
const STORAGE_PREFIX = 'arivu:user-status:'

export type UserStatusType = 'active' | 'busy' | 'away' | 'offline'

export interface UserStatusPreset {
  id: UserStatusType
  label: string
  description: string
  color: string
}

interface UserStatusState {
  type: UserStatusType
  custom: { emoji: string; text: string } | null
}

export const USER_STATUS_PRESETS: readonly UserStatusPreset[] = Object.freeze([
  { id: 'active', label: 'Active', description: 'You’re available', color: '#10b981' },
  { id: 'busy', label: 'Busy', description: 'Do not disturb', color: '#f43f5e' },
  { id: 'away', label: 'Away', description: 'Stepped away for a bit', color: '#f59e0b' },
  { id: 'offline', label: 'Appear offline', description: 'Others see you as offline', color: '#9ca3af' }
])

const DEFAULT_STATE: UserStatusState = { type: 'active', custom: null }

const state = ref<UserStatusState>({ ...DEFAULT_STATE })
let boundUserId: string | null = null
let hydrating = false
let userWatchStop: (() => void) | null = null
let lastPersisted = ''

function cloneDefault(): UserStatusState {
  return { type: DEFAULT_STATE.type, custom: null }
}

function normalize(input: unknown): UserStatusState {
  const out = cloneDefault()
  if (!input || typeof input !== 'object') return out
  const raw = input as Partial<UserStatusState>
  if (USER_STATUS_PRESETS.some((p) => p.id === raw.type)) {
    out.type = raw.type as UserStatusType
  }
  const text = typeof raw.custom?.text === 'string' ? raw.custom.text.trim() : ''
  if (text) {
    out.custom = { emoji: raw.custom?.emoji?.trim() || '💬', text }
  }
  return out
}

function storageKey(userId: string | null): string | null {
  if (!userId) return null
  return `${STORAGE_PREFIX}${userId}`
}

function readFromStorage(userId: string | null): UserStatusState {
  const key = storageKey(userId)
  if (!key || typeof window === 'undefined') return cloneDefault()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return cloneDefault()
    return normalize(JSON.parse(raw))
  } catch {
    return cloneDefault()
  }
}

function writeToStorage(userId: string | null, value: UserStatusState): void {
  const key = storageKey(userId)
  if (!key || typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(value)
    if (serialized === lastPersisted) return
    window.localStorage.setItem(key, serialized)
    lastPersisted = serialized
  } catch {
    // storage full / blocked
  }
}

function bindUser(userId: string | null): void {
  if (boundUserId === userId) return
  boundUserId = userId
  hydrating = true
  state.value = readFromStorage(userId)
  lastPersisted = JSON.stringify(state.value)
  hydrating = false
}

function ensureUserBinding(): void {
  if (userWatchStop) return
  const auth = useAuthStore()
  userWatchStop = watch(
    () => auth.user?._id || null,
    (id) => bindUser(id),
    { immediate: true }
  )
}

watch(
  state,
  (value) => {
    if (hydrating || !boundUserId) return
    writeToStorage(boundUserId, value)
  },
  { deep: true }
)

export function useUserStatus(): {
  state: Ref<UserStatusState>
  presets: readonly UserStatusPreset[]
  currentPreset: ComputedRef<UserStatusPreset>
  displayLabel: ComputedRef<string>
  setType: (typeId: UserStatusType) => void
} {
  ensureUserBinding()

  const currentPreset = computed(
    () => USER_STATUS_PRESETS.find((p) => p.id === state.value.type) || USER_STATUS_PRESETS[0]
  )

  const displayLabel = computed(() => state.value.custom?.text || currentPreset.value.label)

  function setType(typeId: UserStatusType): void {
    if (!USER_STATUS_PRESETS.some((p) => p.id === typeId)) return
    state.value = { ...state.value, type: typeId }
  }

  return { state, presets: USER_STATUS_PRESETS, currentPreset, displayLabel, setType }
}
