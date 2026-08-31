<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useShellChrome } from '@/composables/useShellChrome'
import { useMobileModules } from '@/composables/useMobileModules'
import { getMobileModule } from '@/config/mobileModules'
import { resolveMobileAiContext } from '@/utils/resolveMobileAiContext'
import { tapHaptic } from '@/utils/haptics'
import { SHELL_TAB_ICONS } from '@/utils/navigationIcons'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import MobileFab from '@/components/MobileFab.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'

const HomeIcon = SHELL_TAB_ICONS.home
const InboxIcon = SHELL_TAB_ICONS.inbox
const TasksIcon = SHELL_TAB_ICONS.tasks
const AppsIcon = SHELL_TAB_ICONS.apps

const route = useRoute()
const router = useRouter()
const chrome = useShellChrome()
const { canAccessModule } = useMobileModules()

const launcherActive = computed(() => chrome.launcherOpen.value)
const astraActive = computed(() => chrome.astraOpen.value)

const footerModuleKey = computed(() => {
  const key = chrome.footerModuleKey.value
  if (!key || !canAccessModule(key)) return null
  return key
})

const footerModuleLabel = computed(() => getMobileModule(footerModuleKey.value || '')?.label || 'Apps')

const footerModuleActive = computed(() => {
  if (!footerModuleKey.value) return false
  const prefix = `/modules/${footerModuleKey.value}`
  return activePath.value === prefix || activePath.value.startsWith(`${prefix}/`)
})

const tabs = [
  { to: '/', name: 'home', label: 'Home', match: (p: string) => p === '/' || p === '' },
  { to: '/inbox', name: 'inbox', label: 'Inbox', match: (p: string) => p.startsWith('/inbox') },
  { to: '/tasks', name: 'tasks', label: 'My work', match: (p: string) => p.startsWith('/tasks') }
] as const

const activePath = computed(() => route.path)

const appsHubActive = computed(() => route.name === 'apps')

const activeTabIndex = computed(() => {
  if (launcherActive.value || footerModuleActive.value || appsHubActive.value) return 3
  if (isActive(tabs[0])) return 0
  if (isActive(tabs[1])) return 1
  if (isActive(tabs[2])) return 2
  return -1
})

const navRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref<CSSProperties>({ opacity: 0 })

function updateIndicator() {
  const nav = navRef.value
  if (!nav) return

  const index = activeTabIndex.value
  if (index < 0) {
    indicatorStyle.value = { opacity: 0 }
    return
  }

  const el = nav.querySelector<HTMLElement>(`[data-tab-index="${index}"]`)
  if (!el) {
    indicatorStyle.value = { opacity: 0 }
    return
  }

  const navRect = nav.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()

  const transform = `translate(${elRect.left - navRect.left}px, -50%)`
  const width = `${elRect.width}px`
  const current = indicatorStyle.value
  if (current.transform === transform && current.width === width && current.opacity === 1) {
    return
  }

  indicatorStyle.value = {
    transform,
    width,
    opacity: 1
  }
}

let indicatorFrame: number | null = null

onMounted(() => {
  nextTick(updateIndicator)
})

onBeforeUnmount(() => {
  if (indicatorFrame !== null) cancelAnimationFrame(indicatorFrame)
})

watch([activeTabIndex, activePath, launcherActive, footerModuleKey, appsHubActive], () =>
  nextTick(updateIndicator)
)

function isActive(tab: (typeof tabs)[number]): boolean {
  return !launcherActive.value && !astraActive.value && tab.match(activePath.value)
}

async function onGridClick() {
  void tapHaptic()

  if (!footerModuleKey.value) {
    chrome.toggleLauncher()
    return
  }

  // Chevron tab = app picker on Apps hub or when already on the pinned module.
  const shouldOpenLauncher =
    launcherActive.value || footerModuleActive.value || route.name === 'apps'

  if (shouldOpenLauncher) {
    chrome.toggleLauncher()
    return
  }

  chrome.closeAllSheets()
  await router.push(`/modules/${footerModuleKey.value}`)
}

function onTabClick() {
  void tapHaptic()
  chrome.closeAllSheets()
}

function onAstraClick() {
  void tapHaptic()
  if (chrome.astraOpen.value) {
    chrome.closeAstra()
    return
  }
  const ctx = resolveMobileAiContext(route)
  chrome.openAstra({
    moduleKey: ctx.moduleKey,
    recordId: ctx.kind === 'record' ? ctx.recordId : undefined,
    recordName: chrome.astraRecordName.value || ctx.recordName
  })
}
</script>

<template>
  <div class="float-scrim" aria-hidden="true" />

  <div class="float-bar">
    <button
      type="button"
      class="astra-ask"
      :class="{ 'astra-ask--active': astraActive }"
      aria-label="Ask Astra"
      @click="onAstraClick"
    >
      <img src="/assets/logo/Ai%20Logo.svg" alt="" class="astra-ask__logo" decoding="async" />
      <span class="astra-ask__label">Ask</span>
    </button>

    <div class="float-nav-wrap">
      <nav ref="navRef" class="float-nav" aria-label="Primary">
        <span class="float-nav__indicator" :style="indicatorStyle" aria-hidden="true" />

        <RouterLink
          v-for="(tab, index) in tabs"
          :key="tab.to"
          :to="tab.to"
          :data-tab-index="index"
          class="float-tab"
          :class="{ active: isActive(tab) }"
          :aria-label="tab.label"
          @click="onTabClick"
        >
          <span class="float-tab__icon" aria-hidden="true">
            <HomeIcon v-if="tab.name === 'home'" />
            <InboxIcon v-else-if="tab.name === 'inbox'" />
            <TasksIcon v-else />
          </span>
        </RouterLink>

        <button
          type="button"
          data-tab-index="3"
          class="float-tab"
          :class="{
            active: launcherActive || footerModuleActive || appsHubActive,
            'float-tab--module': footerModuleKey
          }"
          :aria-label="footerModuleKey ? footerModuleLabel : 'Apps'"
          @click="onGridClick"
        >
          <span
            v-if="footerModuleKey"
            class="float-tab__icon float-tab__icon--picker"
            aria-hidden="true"
          >
            <ModuleIcon :module-key="footerModuleKey" />
            <ChevronDownIcon
              class="float-tab__chevron"
              :class="{ 'float-tab__chevron--open': launcherActive }"
              aria-hidden="true"
            />
          </span>
          <span v-else class="float-tab__icon" aria-hidden="true">
            <AppsIcon />
          </span>
        </button>
      </nav>
    </div>

    <MobileFab />
  </div>
</template>

<style scoped>
/* Blurs content scrolling under and below the floating bar */
.float-scrim {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--mobile-bottom-offset);
  z-index: 44;
  pointer-events: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  background: linear-gradient(to top, color-mix(in srgb, var(--bg) 40%, transparent), transparent);
  mask-image: linear-gradient(to top, #000 55%, transparent);
  -webkit-mask-image: linear-gradient(to top, #000 55%, transparent);
}

.float-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(0.35rem + var(--safe-bottom));
  z-index: 45;
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  padding: 0 0.85rem;
}

.float-nav-wrap {
  flex: 1;
  min-width: 0;
}

.astra-ask {
  position: absolute;
  left: 50%;
  bottom: calc(var(--float-chrome-height) + 0.45rem);
  z-index: 1;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--astra-ask-height);
  padding: 0.35rem 0.95rem 0.35rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--bg-elevated) 88%, white);
  box-shadow: 0 6px 22px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.72);
  color: color-mix(in srgb, var(--text) 82%, transparent);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  -webkit-tap-highlight-color: transparent;
}

.astra-ask:active {
  background: color-mix(in srgb, var(--bg-elevated) 88%, white);
}

.astra-ask--active {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent),
    0 8px 24px rgba(96, 73, 231, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.astra-ask__logo {
  width: 1.35rem;
  height: 1.35rem;
  object-fit: contain;
}

.astra-ask__label {
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1;
}

.float-nav {
  position: relative;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 0.2rem;
  height: var(--float-chrome-height);
  padding: 0 0.35rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--bg-elevated) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: var(--shadow-float), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
}

.float-nav__indicator {
  position: absolute;
  top: 50%;
  left: 0;
  height: 2.75rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  pointer-events: none;
  z-index: 0;
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  will-change: transform, width;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .float-nav,
  .astra-ask {
    background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  }
}

.float-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  height: 2.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: color-mix(in srgb, var(--text) 72%, transparent);
  transition: color 0.25s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.float-tab:active {
  background: transparent;
}

.float-tab.active {
  color: var(--accent-strong);
}

.float-tab__icon {
  display: flex;
  width: 1.5rem;
  height: 1.5rem;
}

.float-tab__icon :deep(svg:not(.float-tab__chevron)) {
  width: 100%;
  height: 100%;
}

.float-tab--module {
  width: 100%;
}

.float-tab__icon--picker {
  display: inline-flex;
  width: auto;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
}

.float-tab__icon--picker :deep(.module-icon) {
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
}

.float-tab__icon--picker :deep(.module-icon svg) {
  stroke-width: 1.9;
}

.float-tab__chevron {
  width: 0.6rem;
  height: 0.6rem;
  margin-left: 0.06rem;
  flex-shrink: 0;
  transition: transform 0.18s ease;
}

.float-tab__chevron--open {
  transform: rotate(180deg);
}
</style>
