<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { markWelcomeSeen } from '@/services/onboardingFlags'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const activeSlide = ref(0)

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

const slides = [
  {
    title: 'Your CRM in your pocket',
    body: 'Inbox, tasks, and every module — optimized for mobile, powered by your Arivu workspace.'
  },
  {
    title: 'Stay on top of work',
    body: 'See unread inbox, open tasks, overdue items, and notifications the moment you open the app.'
  },
  {
    title: 'Permission-aware by design',
    body: 'People, deals, cases, and more — only the modules and records your role allows.'
  }
] as const

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (auth.isAuthenticated) {
    void router.replace('/')
    return
  }
  timer = setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % slides.length
  }, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function goLogin() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  void markWelcomeSeen().finally(() => {
    void router.push({ name: 'login', query: redirect !== '/' ? { redirect } : {} })
  })
}
</script>

<template>
  <div class="welcome screen">
    <header class="welcome-brand">
      <img :src="brandLogoSrc" alt="Arivu" class="welcome-logo" />
    </header>

    <div class="welcome-hero" aria-hidden="true">
      <div class="hero-device card">
        <div class="hero-device__bar" />
        <div class="hero-device__row">
          <span class="hero-chip hero-chip--active" />
          <span class="hero-chip" />
          <span class="hero-chip" />
        </div>
        <div class="hero-device__block" />
        <div class="hero-device__block hero-device__block--short" />
      </div>
      <div class="hero-orbit" />
    </div>

    <div class="welcome-copy">
      <h1>{{ slides[activeSlide].title }}</h1>
      <p>{{ slides[activeSlide].body }}</p>
    </div>

    <div class="welcome-dots" role="tablist" aria-label="Onboarding slides">
      <button
        v-for="(_, index) in slides"
        :key="index"
        type="button"
        class="dot"
        :class="{ active: index === activeSlide }"
        :aria-selected="index === activeSlide"
        @click="activeSlide = index"
      />
    </div>

    <div class="welcome-actions">
      <button class="btn" type="button" @click="goLogin">Get started</button>
      <button class="btn btn-ghost" type="button" @click="goLogin">Log in</button>
    </div>

    <p class="welcome-legal muted">
      By continuing, you agree to your organization’s terms and Arivu usage policies.
    </p>
  </div>
</template>

<style scoped>
.welcome {
  display: grid;
  grid-template-rows: auto 1fr auto auto auto auto;
  min-height: 100dvh;
  padding: calc(1rem + var(--safe-top)) 1.25rem calc(1rem + var(--safe-bottom));
  background:
    radial-gradient(circle at 50% 0%, rgba(96, 73, 231, 0.28), transparent 52%),
    var(--bg);
}

.welcome-brand {
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-logo {
  height: 2.35rem;
  width: auto;
}

.welcome-hero {
  position: relative;
  display: grid;
  place-items: center;
  padding: 1.5rem 0;
}

.hero-device {
  width: min(100%, 220px);
  padding: 1rem;
  display: grid;
  gap: 0.55rem;
  z-index: 1;
}

.hero-device__bar {
  height: 0.45rem;
  width: 38%;
  border-radius: var(--radius-pill);
  background: rgba(96, 73, 231, 0.35);
}

.hero-device__row {
  display: flex;
  gap: 0.35rem;
}

.hero-chip {
  height: 1.6rem;
  flex: 1;
  border-radius: 10px;
  background: var(--bg-soft);
}

.hero-chip--active {
  background: rgba(96, 73, 231, 0.22);
}

.hero-device__block {
  height: 2.5rem;
  border-radius: 12px;
  background: var(--bg-soft);
}

.hero-device__block--short {
  width: 72%;
}

.hero-orbit {
  position: absolute;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(96, 73, 231, 0.16), transparent 70%);
}

.welcome-copy {
  text-align: center;
  padding: 0 0.5rem;
}

.welcome-copy h1 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.welcome-copy p {
  margin: 0.65rem 0 0;
  color: var(--text-muted);
  line-height: 1.5;
  font-size: 0.95rem;
}

.welcome-dots {
  display: flex;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 1rem;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--border);
  padding: 0;
}

.dot.active {
  width: 1.1rem;
  background: var(--accent-strong);
}

.welcome-actions {
  display: grid;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.welcome-actions .btn {
  width: 100%;
}

.welcome-legal {
  margin: 1rem 0 0;
  text-align: center;
  font-size: 0.72rem;
  line-height: 1.45;
}
</style>
