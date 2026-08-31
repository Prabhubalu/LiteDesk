<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EyeIcon,
  EyeSlashIcon,
  FingerPrintIcon
} from '@heroicons/vue/24/outline'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useAuthStore } from '@/stores/auth'
import MobileForgotPasswordSheet from '@/components/MobileForgotPasswordSheet.vue'
import MobileEnableBiometricSheet from '@/components/MobileEnableBiometricSheet.vue'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import {
  authenticateBiometric,
  clearLastEmail,
  getBiometricSupport,
  getLastEmail,
  getLastAvatar,
  isBiometricEnabled,
  isUnlocked,
  markUnlocked,
  saveLastEmail,
  setBiometricEnabled,
  type BiometricLabel
} from '@/services/biometricUnlock'
import { isNativeSimulator } from '@/utils/nativePlatform'
import { useKeyboardInset } from '@/composables/useKeyboardInset'
import { errorHaptic, successHaptic, tapHaptic } from '@/utils/haptics'
import { resolveAvatarUrl } from '@/utils/avatarUrl'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const localError = ref<string | null>(null)
const shakeForm = ref(false)
const forgotOpen = ref(false)
const demoOpen = ref(false)
const enableBioOpen = ref(false)
const biometricAvailable = ref(false)
const biometricLabel = ref<BiometricLabel>('Biometrics')
const biometricUnlocking = ref(false)
const lastEmail = ref<string | null>(null)
const lastAvatarRaw = ref<string | null>(null)
const avatarBroken = ref(false)
const keyboardAware = ref(true)
const { keyboardInset } = useKeyboardInset(keyboardAware)

const loginPageStyle = computed(() => ({
  '--keyboard-inset': `${keyboardInset.value}px`
}))

const sessions = computed(() => auth.sessionLimit?.sessions || [])
const isDarkUi = computed(() => {
  if (typeof document === 'undefined') return false
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})
const brandLogoSrc = computed(() =>
  isDarkUi.value ? '/assets/logo/Logo_word_light.svg' : '/assets/logo/Logo_word_dark.svg'
)

const unlockMode = computed(() => {
  return auth.isAuthenticated && route.query.unlock === '1'
})

const returningUser = computed(() => {
  return !unlockMode.value && !auth.isAuthenticated && Boolean(lastEmail.value)
})

const welcomeName = computed(() => {
  const value = lastEmail.value || email.value.trim()
  if (!value) return ''
  const local = value.split('@')[0] || value
  return local.charAt(0).toUpperCase() + local.slice(1)
})

const avatarInitial = computed(() => {
  const value = lastEmail.value || email.value.trim()
  return (value.charAt(0) || 'A').toUpperCase()
})

const profileAvatarUrl = computed(() => {
  if (unlockMode.value && auth.avatarUrl) return auth.avatarUrl
  return resolveAvatarUrl(lastAvatarRaw.value)
})

const showProfileAvatar = computed(() => {
  return (returningUser.value || unlockMode.value) && Boolean(profileAvatarUrl.value) && !avatarBroken.value
})

const headline = computed(() => {
  if (unlockMode.value) return `Unlock with ${biometricLabel.value}`
  if (returningUser.value) return `Welcome back, ${welcomeName.value}`
  return 'Sign in to your account'
})

function scrollFieldIntoView(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const scroll = () => {
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }
  window.requestAnimationFrame(scroll)
  window.setTimeout(scroll, 120)
  window.setTimeout(scroll, 320)
}

watch(keyboardInset, (inset) => {
  if (inset <= 0) return
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest('.login-form')) {
    window.requestAnimationFrame(() => {
      active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    })
  }
})

onMounted(async () => {
  const { resetBodyScrollLock } = await import('@/utils/sheetBodyLock')
  resetBodyScrollLock()

  const [storedEmail, storedAvatar] = await Promise.all([getLastEmail(), getLastAvatar()])
  lastEmail.value = storedEmail
  lastAvatarRaw.value = storedAvatar
  avatarBroken.value = false
  if (storedEmail && !email.value) email.value = storedEmail

  if (auth.isAuthenticated && !unlockMode.value) {
    const bioEnabled = await isBiometricEnabled()
    if (!bioEnabled || isUnlocked()) {
      void router.replace('/')
      return
    }
  }

  if (unlockMode.value) {
    window.requestAnimationFrame(() => {
      void prepareUnlockMode()
    })
  }
})

async function prepareUnlockMode() {
  const [bio, bioEnabled] = await Promise.all([getBiometricSupport(), isBiometricEnabled()])
  biometricAvailable.value = bio.available
  biometricLabel.value = bio.label

  if (!bioEnabled || !bio.available || isNativeSimulator()) {
    markUnlocked()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  }
}

function sessionIdOf(session: { id?: string; _id?: string }): string {
  return String(session.id || session._id || '')
}

function sessionLabel(session: {
  deviceClass?: string
  userAgent?: string
  ip?: string
  id?: string
  _id?: string
}): string {
  return session.deviceClass || 'session'
}

function sessionMeta(session: {
  userAgent?: string
  ip?: string
  lastSeenAt?: string
}): string {
  return [session.userAgent, session.ip].filter(Boolean).join(' · ') || 'Active session'
}

async function afterAuthSuccess() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect)
  const { syncPushTokenAfterLogin } = await import('@/services/push')
  void syncPushTokenAfterLogin().catch(() => undefined)
}

async function finishLoginFlow(loginEmail: string) {
  markUnlocked()
  void saveLastEmail(loginEmail)
  lastEmail.value = loginEmail.trim()

  await afterAuthSuccess()
  successHaptic()
  void auth.refreshProfile().then(() => {
    if (auth.user?.avatar) {
      lastAvatarRaw.value = String(auth.user.avatar)
    }
  })
}

async function dismissKeyboard(): Promise<void> {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  if (!Capacitor.isNativePlatform()) return
  try {
    await Keyboard.hide()
  } catch {
    // optional
  }
}

async function onSubmit() {
  localError.value = null
  shakeForm.value = false
  await dismissKeyboard()
  tapHaptic()
  try {
    const result = await auth.login({ email: email.value.trim(), password: password.value })
    if (result.sessionLimit) return
    await finishLoginFlow(email.value.trim())
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Login failed'
    shakeForm.value = true
    errorHaptic()
  }
}

async function onRevoke(sessionId: string) {
  localError.value = null
  const ok = await auth.revokeSession(sessionId)
  if (!ok && auth.error) localError.value = auth.error
}

async function onContinue() {
  localError.value = null
  const ok = await auth.continueAfterSessionLimit()
  if (ok) {
    await finishLoginFlow(email.value.trim())
    return
  }
  if (auth.error) localError.value = auth.error
}

function onBackToCredentials() {
  auth.sessionLimit = null
  auth.error = null
  localError.value = null
}

async function usePasswordInstead() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace({
    name: 'login',
    query: redirect !== '/' ? { redirect } : {}
  })
}

async function tryBiometricUnlock() {
  if (biometricUnlocking.value) return
  localError.value = null
  biometricUnlocking.value = true
  void tapHaptic()
  try {
    const ok = await authenticateBiometric(`Unlock Arivu with ${biometricLabel.value}`)
    if (!ok) return
    void successHaptic()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch {
    localError.value = `${biometricLabel.value} failed. Try again or use your password.`
    void errorHaptic()
  } finally {
    biometricUnlocking.value = false
  }
}

async function useDifferentAccount() {
  await auth.logout({ silent: true })
  await clearLastEmail()
  lastEmail.value = null
  lastAvatarRaw.value = null
  avatarBroken.value = false
  email.value = ''
  password.value = ''
  localError.value = null
  void router.replace({ name: 'login' })
}

async function onEnableBiometric() {
  enableBioOpen.value = false
  try {
    const ok = await authenticateBiometric(`Enable ${biometricLabel.value} for Arivu`)
    if (ok) {
      await setBiometricEnabled(true)
      void successHaptic()
    }
    await afterAuthSuccess()
  } catch {
    await afterAuthSuccess()
  }
}

async function onSkipBiometric() {
  enableBioOpen.value = false
  await afterAuthSuccess()
}

function openWebPath(path: string) {
  demoOpen.value = false
  const origin =
    (import.meta.env.VITE_WEB_ORIGIN as string | undefined)?.replace(/\/+$/, '') ||
    'https://app.arivusystems.com'
  window.open(`${origin}${path}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div
    class="login-page screen"
    :class="{ 'login-page--keyboard': keyboardInset > 0 }"
    :style="loginPageStyle"
  >
    <div class="login-shell">
      <header class="login-brand">
        <img :src="brandLogoSrc" alt="Arivu" class="login-logo" />
        <div
          v-if="returningUser || unlockMode"
          class="login-avatar"
          :class="{ 'login-avatar--image': showProfileAvatar }"
        >
          <img
            v-if="showProfileAvatar"
            class="login-avatar__image"
            :src="profileAvatarUrl"
            :alt="welcomeName ? `${welcomeName}'s profile` : 'Your profile'"
            @error="avatarBroken = true"
          />
          <span v-else aria-hidden="true">{{ avatarInitial }}</span>
        </div>
        <div class="login-headlines">
          <h1 class="login-title">{{ headline }}</h1>
          <p v-if="unlockMode" class="login-tagline muted">
            Your workspace is ready — confirm it is you.
          </p>
        </div>
      </header>

      <div v-if="unlockMode" class="login-panel login-unlock">
        <button
          type="button"
          class="login-biometric"
          :disabled="biometricUnlocking"
          @click="tryBiometricUnlock"
        >
          <FingerPrintIcon class="login-biometric__icon" aria-hidden="true" />
          <span>{{ biometricUnlocking ? 'Checking…' : `Use ${biometricLabel}` }}</span>
        </button>

        <p v-if="localError || auth.error" class="login-error">{{ localError || auth.error }}</p>

        <button type="button" class="login-link login-link--block" @click="usePasswordInstead">
          Use password instead
        </button>

        <button type="button" class="login-link login-link--block" @click="useDifferentAccount">
          Sign in with a different account
        </button>
      </div>

      <div v-else-if="auth.sessionLimit" class="login-panel">
        <div class="session-head">
          <h2>Too many sessions</h2>
          <p class="muted">
            {{ auth.sessionLimit.message || 'Sign out of an existing session below, then continue.' }}
          </p>
        </div>

        <ul v-if="sessions.length" class="session-list">
          <li v-for="session in sessions" :key="sessionIdOf(session)">
            <div class="session-item">
              <div class="session-copy">
                <strong>{{ sessionLabel(session) }}</strong>
                <p class="muted">{{ sessionMeta(session) }}</p>
              </div>
              <button
                type="button"
                class="session-free"
                :disabled="auth.loading"
                @click="onRevoke(sessionIdOf(session))"
              >
                Sign out
              </button>
            </div>
          </li>
        </ul>

        <p v-if="localError || auth.error" class="login-error">{{ localError || auth.error }}</p>

        <button class="login-submit btn" type="button" :disabled="auth.loading" @click="onContinue">
          <span v-if="auth.loading" class="btn-spinner" aria-hidden="true" />
          {{ auth.loading ? 'Signing in…' : 'Continue' }}
        </button>
        <button class="login-back" type="button" :disabled="auth.loading" @click="onBackToCredentials">
          Back
        </button>
      </div>

      <form
        v-else
        class="login-panel login-form"
        :class="{ 'login-form--shake': shakeForm }"
        @submit.prevent="onSubmit"
        @animationend="shakeForm = false"
      >
        <label class="login-field" for="login-email">
          <span>Email address</span>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            autocapitalize="none"
            spellcheck="false"
            required
            placeholder="you@company.com"
            @focus="scrollFieldIntoView"
          />
        </label>

        <div class="login-field">
          <div class="login-field__row">
            <label for="login-password">Password</label>
            <button type="button" class="login-link" @click="forgotOpen = true">
              Forgot password?
            </button>
          </div>
          <span class="login-password">
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder="Password"
              @focus="scrollFieldIntoView"
            />
            <button
              type="button"
              class="login-eye"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeSlashIcon v-if="showPassword" class="login-eye__icon" aria-hidden="true" />
              <EyeIcon v-else class="login-eye__icon" aria-hidden="true" />
            </button>
          </span>
        </div>

        <p v-if="localError || auth.error" class="login-error">{{ localError || auth.error }}</p>

        <button class="login-submit btn" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="btn-spinner" aria-hidden="true" />
          {{ auth.loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p v-if="!unlockMode" class="login-footer muted">
        Don't have an account?
        <button type="button" class="login-link" @click="demoOpen = true">Request a demo</button>
      </p>
    </div>

    <MobileForgotPasswordSheet
      :open="forgotOpen"
      :initial-email="email"
      @close="forgotOpen = false"
    />

    <MobileEnableBiometricSheet
      :open="enableBioOpen"
      :label="biometricLabel"
      @enable="onEnableBiometric"
      @skip="onSkipBiometric"
    />

    <MobileBottomSheet
      :open="demoOpen"
      title="Request a demo"
      aria-label="Request a demo"
      compact
      @close="demoOpen = false"
    >
      <div class="demo-sheet">
        <p class="muted">
          Tell us about your team on the web — we will set up a workspace and walk you through Arivu
          on desktop and mobile.
        </p>
        <button type="button" class="btn demo-sheet__cta" @click="openWebPath('/demo')">
          Continue on web
        </button>
        <button type="button" class="demo-sheet__cancel" @click="demoOpen = false">Cancel</button>
      </div>
    </MobileBottomSheet>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  height: 100dvh;
  padding: calc(1.5rem + var(--safe-top)) 1.25rem
    calc(1.5rem + var(--safe-bottom) + var(--keyboard-inset, 0px));
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-padding-bottom: calc(var(--keyboard-inset, 0px) + 1.5rem);
  isolation: isolate;
  color: var(--text);
  background:
    radial-gradient(ellipse 130% 85% at 50% -28%, rgba(96, 73, 231, 0.2), transparent 58%),
    radial-gradient(ellipse 75% 50% at 100% 8%, rgba(255, 128, 181, 0.11), transparent 52%),
    radial-gradient(ellipse 60% 42% at 0% 92%, rgba(96, 73, 231, 0.08), transparent 48%),
    var(--bg-elevated);
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  pointer-events: none;
  z-index: 0;
  border-radius: 50%;
  filter: blur(60px);
}

.login-page::before {
  top: -6rem;
  left: 50%;
  width: min(92vw, 22rem);
  height: min(92vw, 22rem);
  transform: translateX(-50%);
  background: rgba(96, 73, 231, 0.16);
}

.login-page::after {
  right: -4rem;
  bottom: 12%;
  width: min(70vw, 14rem);
  height: min(70vw, 14rem);
  background: rgba(255, 128, 181, 0.1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .login-page {
    background:
      radial-gradient(ellipse 130% 85% at 50% -28%, rgba(96, 73, 231, 0.38), transparent 58%),
      radial-gradient(ellipse 75% 50% at 100% 8%, rgba(255, 128, 181, 0.14), transparent 52%),
      radial-gradient(ellipse 60% 42% at 0% 92%, rgba(96, 73, 231, 0.16), transparent 48%),
      var(--bg-elevated);
  }

  :root:not([data-theme='light']) .login-page::before {
    background: rgba(96, 73, 231, 0.28);
  }

  :root:not([data-theme='light']) .login-page::after {
    background: rgba(255, 128, 181, 0.12);
  }
}

:root[data-theme='dark'] .login-page {
  background:
    radial-gradient(ellipse 130% 85% at 50% -28%, rgba(96, 73, 231, 0.38), transparent 58%),
    radial-gradient(ellipse 75% 50% at 100% 8%, rgba(255, 128, 181, 0.14), transparent 52%),
    radial-gradient(ellipse 60% 42% at 0% 92%, rgba(96, 73, 231, 0.16), transparent 48%),
    var(--bg-elevated);
}

:root[data-theme='dark'] .login-page::before {
  background: rgba(96, 73, 231, 0.28);
}

:root[data-theme='dark'] .login-page::after {
  background: rgba(255, 128, 181, 0.12);
}

.login-page--keyboard {
  align-items: flex-start;
  justify-content: flex-start;
}

.login-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 24rem);
  display: grid;
  gap: 1.5rem;
  pointer-events: auto;
  margin: auto;
}

.login-page--keyboard .login-shell {
  margin: 0;
  padding-top: 0.25rem;
}

.login-brand {
  display: grid;
  gap: 0.85rem;
  justify-items: center;
  text-align: center;
}

.login-logo {
  height: 2.35rem;
  width: auto;
}

.login-avatar {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 10px 24px -8px rgba(96, 73, 231, 0.55);
  overflow: hidden;
}

.login-avatar--image {
  background: var(--bg-soft);
}

.login-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.login-headlines {
  display: grid;
  gap: 0.25rem;
}

.login-title {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text);
}

.login-tagline {
  margin: 0.15rem 0 0;
  font-size: 0.875rem;
  line-height: 1.45;
}

.login-panel {
  display: grid;
  gap: 1.25rem;
  padding: 1.35rem 1.15rem;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 18px 44px -28px rgba(96, 73, 231, 0.28);
}

.login-form {
  gap: 1.35rem;
}

.login-form--shake {
  animation: login-shake 0.42s ease;
}

.login-field {
  display: grid;
  gap: 0.5rem;
}

.login-field > span:not(.login-password),
.login-field__row label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.login-field__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--text);
}

.login-field input {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--text);
  padding: 0.9rem 0.95rem;
  font-size: 16px;
  font-weight: 400;
  touch-action: manipulation;
  -webkit-user-select: text;
  user-select: text;
  -webkit-appearance: none;
  appearance: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.login-field input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.login-field input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 0 0 3px rgba(96, 73, 231, 0.18);
}

.login-password {
  position: relative;
  display: block;
}

.login-password input {
  padding-right: 3rem;
}

.login-eye {
  position: absolute;
  inset-block: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
}

.login-eye__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.login-submit {
  width: 100%;
  min-height: 3rem;
  border-radius: var(--radius-sm);
}

.login-biometric {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  min-height: 3.25rem;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated));
  color: var(--accent-strong);
  font-size: 1rem;
  font-weight: 700;
}

.login-biometric:disabled {
  opacity: 0.65;
}

.login-biometric__icon {
  width: 1.35rem;
  height: 1.35rem;
}

.btn-spinner {
  width: 1rem;
  height: 1rem;
  margin-right: 0.35rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}

.login-back {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 0.35rem;
}

.login-link {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0;
}

.login-link--block {
  justify-self: center;
}

.login-footer {
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
}

.login-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.875rem;
}

.session-head {
  display: grid;
  gap: 0.35rem;
}

.session-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-soft) 65%, var(--bg-elevated));
}

.session-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
}

.session-list li:last-child .session-item {
  border-bottom: none;
}

.session-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.15rem;
}

.session-copy strong {
  font-size: 0.9rem;
}

.session-copy p {
  margin: 0;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-free {
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--danger);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.4rem 0.65rem;
}

.demo-sheet {
  display: grid;
  gap: 1rem;
  text-align: center;
}

.demo-sheet__cta {
  width: 100%;
}

.demo-sheet__cancel {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes login-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-6px);
  }
  40%,
  80% {
    transform: translateX(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-form--shake,
  .btn-spinner {
    animation: none;
  }
}
</style>
