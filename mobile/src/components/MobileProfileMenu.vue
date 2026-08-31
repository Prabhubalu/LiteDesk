<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useAuthStore } from '@/stores/auth'
import { useShellChrome } from '@/composables/useShellChrome'
import { useUserStatus, type UserStatusType } from '@/composables/useUserStatus'
import {
  authenticateBiometric,
  getBiometricSupport,
  isBiometricEnabled,
  markUnlocked,
  setBiometricEnabled,
  type BiometricLabel
} from '@/services/biometricUnlock'
import { isNativeSimulator } from '@/utils/nativePlatform'
import { errorHaptic, successHaptic, tapHaptic } from '@/utils/haptics'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import { hasPermission } from '@/utils/permissions'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

const THEME_STORAGE_KEY = 'colorMode'

const router = useRouter()
const auth = useAuthStore()
const chrome = useShellChrome()

const colorMode = ref<'light' | 'dark' | 'system'>('system')

const open = computed({
  get: () => chrome.profileMenuOpen.value,
  set: (value: boolean) => {
    if (!value) chrome.closeProfileMenu()
  }
})

const helpDocsUrl = String(import.meta.env.VITE_HELP_DOCS_URL || '').trim()
const helpSupportUrl = String(import.meta.env.VITE_HELP_SUPPORT_URL || '').trim()

const displayName = computed(() => auth.displayName)
const email = computed(() => auth.user?.email || '')
const role = computed(() => auth.user?.role || '')
const workspaceName = computed(() => auth.organization?.name || '')

const avatarInitial = computed(() => {
  const name = auth.displayName || 'U'
  return name.charAt(0).toUpperCase()
})

const avatarBroken = ref(false)
watch(() => auth.avatarUrl, () => { avatarBroken.value = false })

const { presets, currentPreset, displayLabel, setType } = useUserStatus()

const statusPickerOpen = ref(false)
const biometricAvailable = ref(false)
const biometricEnabled = ref(false)
const biometricBusy = ref(false)
const biometricLabel = ref<BiometricLabel>('Biometrics')
const biometricLoaded = ref(false)

watch(open, (value) => {
  if (!value) {
    statusPickerOpen.value = false
    return
  }
  void auth.refreshProfile()
})

function chooseStatus(typeId: UserStatusType) {
  setType(typeId)
  statusPickerOpen.value = false
}

const canViewControlPanel = computed(() => auth.user?.isPlatformAdmin === true)

const canViewSettings = computed(() => {
  const user = auth.user
  if (!user) return false
  if (user.isOwner === true) return true
  const r = String(user.role || '').toLowerCase()
  if (r === 'admin' || r === 'owner') return true
  return hasPermission(user, 'settings.view')
})

const canViewTrash = computed(() => hasPermission(auth.user, 'settings.view'))

const isDark = computed(() => {
  if (colorMode.value === 'dark') return true
  if (colorMode.value === 'light') return false
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
})

function applyTheme(mode: 'light' | 'dark' | 'system') {
  colorMode.value = mode
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

function loadTheme() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(THEME_STORAGE_KEY) : null
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    applyTheme(stored)
  }
}

function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark'
  applyTheme(next)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }
}

async function loadBiometricState() {
  if (!Capacitor.isNativePlatform() || isNativeSimulator()) {
    biometricAvailable.value = false
    biometricEnabled.value = false
    return
  }
  const [support, enabled] = await Promise.all([getBiometricSupport(), isBiometricEnabled()])
  biometricAvailable.value = support.available
  biometricLabel.value = support.label
  biometricEnabled.value = enabled
}

async function ensureBiometricState() {
  if (biometricLoaded.value) return
  biometricLoaded.value = true
  await loadBiometricState()
}

async function toggleBiometric() {
  await ensureBiometricState()
  if (biometricBusy.value || !biometricAvailable.value) return
  biometricBusy.value = true
  try {
    if (biometricEnabled.value) {
      await setBiometricEnabled(false)
      biometricEnabled.value = false
      void tapHaptic()
      return
    }
    const ok = await authenticateBiometric(`Enable ${biometricLabel.value} for Arivu`)
    if (!ok) return
    await setBiometricEnabled(true)
    markUnlocked()
    biometricEnabled.value = true
    void successHaptic()
  } catch {
    void errorHaptic()
  } finally {
    biometricBusy.value = false
  }
}

function openWebPath(path: string) {
  const origin =
    (import.meta.env.VITE_WEB_ORIGIN as string | undefined)?.replace(/\/+$/, '') ||
    'https://app.arivusystems.com'
  window.open(`${origin}${path}`, '_blank', 'noopener,noreferrer')
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function onLogout() {
  chrome.closeProfileMenu()
  await auth.logout()
  await router.replace('/login')
}

function goWeb(path: string) {
  chrome.closeProfileMenu()
  openWebPath(path)
}

onMounted(() => {
  loadTheme()
})
</script>

<template>
  <MobileBottomSheet :open="open" ariaLabel="Account" @close="chrome.closeProfileMenu()">
    <div class="profile-head">
      <div class="avatar-wrap">
        <img
          v-if="auth.avatarUrl && !avatarBroken"
          class="avatar avatar--image"
          :src="auth.avatarUrl"
          :alt="displayName"
          @error="avatarBroken = true"
        />
        <div v-else class="avatar">{{ avatarInitial }}</div>
        <span class="avatar-status" :style="{ background: currentPreset.color }" aria-hidden="true" />
      </div>
      <div class="profile-meta">
        <div class="name-row">
          <strong>{{ displayName }}</strong>
          <span v-if="role" class="role-pill">{{ role }}</span>
        </div>
        <p v-if="email" class="muted">{{ email }}</p>
        <p v-if="workspaceName" class="muted workspace">{{ workspaceName }}</p>
      </div>
    </div>

    <section class="group" aria-label="Status">
      <button
        type="button"
        class="row row--status"
        :aria-expanded="statusPickerOpen"
        @click="statusPickerOpen = !statusPickerOpen"
      >
        <span class="status-dot" :style="{ background: currentPreset.color }" aria-hidden="true" />
        <span class="row-label">{{ displayLabel }}</span>
        <ChevronDownIcon class="chevron" :class="{ open: statusPickerOpen }" aria-hidden="true" />
      </button>
      <template v-if="statusPickerOpen">
        <button
          v-for="preset in presets"
          :key="preset.id"
          type="button"
          role="option"
          class="row row--status row--nested"
          :aria-selected="currentPreset.id === preset.id"
          @click="chooseStatus(preset.id)"
        >
          <span class="status-dot" :style="{ background: preset.color }" aria-hidden="true" />
          <span class="row-label">{{ preset.label }}</span>
          <span v-if="currentPreset.id === preset.id" class="check" aria-hidden="true">✓</span>
        </button>
      </template>
    </section>

    <section class="group" aria-label="Account">
      <button type="button" class="row" @click="goWeb('/profile')">My profile</button>
      <button
        v-if="canViewControlPanel"
        type="button"
        class="row"
        @click="goWeb('/control')"
      >
        Control panel
      </button>
      <button type="button" class="row" @click="goWeb('/appointments/pages')">
        Booking Pages
      </button>
      <button
        v-if="canViewSettings"
        type="button"
        class="row"
        @click="goWeb('/settings')"
      >
        Settings
      </button>
      <button v-if="canViewTrash" type="button" class="row" @click="goWeb('/trash')">
        Trash
      </button>
    </section>

    <template v-if="helpDocsUrl || helpSupportUrl">
      <p class="group-label">Help</p>
      <section class="group" aria-label="Help">
        <button
          v-if="helpDocsUrl"
          type="button"
          class="row"
          @click="chrome.closeProfileMenu(); openExternal(helpDocsUrl)"
        >
          Documentation
        </button>
        <button
          v-if="helpSupportUrl"
          type="button"
          class="row"
          @click="chrome.closeProfileMenu(); openExternal(helpSupportUrl)"
        >
          Contact support
        </button>
      </section>
    </template>

    <section class="group" aria-label="Appearance">
      <button
        v-if="biometricAvailable"
        type="button"
        class="row row--theme"
        :disabled="biometricBusy"
        :aria-label="`${biometricLabel} ${biometricEnabled ? 'enabled' : 'disabled'}`"
        @click="toggleBiometric"
      >
        <span class="row-label">{{ biometricLabel }}</span>
        <span class="theme-switch" :class="{ on: biometricEnabled }" aria-hidden="true">
          <span class="theme-knob" />
        </span>
      </button>
      <button type="button" class="row row--theme" @click="toggleTheme">
        <span class="row-label">{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
        <span class="theme-switch" :class="{ on: isDark }" aria-hidden="true">
          <span class="theme-knob" />
        </span>
      </button>
    </section>

    <section class="group group--action">
      <button type="button" class="row row--danger" @click="onLogout">Sign out</button>
    </section>
  </MobileBottomSheet>
</template>

<style scoped>
.profile-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin: 0.15rem 0 1.15rem;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar-status {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--radius-pill);
  border: 2.5px solid var(--bg-elevated);
}

.avatar {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 1.15rem;
  color: white;
  background: linear-gradient(145deg, var(--accent), var(--accent-strong));
  flex-shrink: 0;
}

.avatar--image {
  object-fit: cover;
  display: block;
}

.profile-meta {
  min-width: 0;
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.name-row strong {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-pill {
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent-strong);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.12rem 0.4rem;
}

.profile-head p {
  margin: 0.12rem 0 0;
  font-size: 0.82rem;
  line-height: 1.3;
}

.workspace {
  font-size: 0.72rem !important;
  opacity: 0.85;
}

.group-label {
  margin: 0 0 0.4rem 0.85rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.85rem;
  border-radius: 0.85rem;
  background: var(--bg-soft);
  overflow: hidden;
}

.group--action {
  margin-bottom: 0.25rem;
}

.row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  text-align: left;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0.8rem 1rem;
  min-height: 2.85rem;
  transition: background 0.12s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.row + .row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 1rem;
  right: 0;
  height: 1px;
  background: color-mix(in srgb, var(--border) 70%, transparent);
}

.row:active {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row--status {
  gap: 0.65rem;
}

.row--nested {
  padding-left: 1.65rem;
}

.row--theme {
  justify-content: space-between;
  gap: 0.75rem;
}

.row--theme:disabled {
  opacity: 0.55;
}

.row--danger {
  justify-content: center;
  color: #e11d48;
  font-weight: 600;
}

.status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
  opacity: 0.7;
  transition: transform 0.18s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.check {
  color: var(--accent-strong);
  font-weight: 700;
  font-size: 0.9rem;
}

.theme-switch {
  position: relative;
  width: 2.4rem;
  height: 1.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--border) 85%, var(--text-muted));
  flex-shrink: 0;
  transition: background 0.18s ease;
}

.theme-switch.on {
  background: var(--accent);
}

.theme-knob {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: var(--radius-pill);
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  transition: transform 0.18s ease;
}

.theme-switch.on .theme-knob {
  transform: translateX(1.05rem);
}
</style>
