<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { getMobileModule } from '@/config/mobileModules'
import { provideShellChrome } from '@/composables/useShellChrome'
import { useAuthStore } from '@/stores/auth'
import { userFirstName } from '@/utils/userDisplayName'
import { fetchNotifications } from '@/api/notifications'
import { formatPlatformGreeting } from '@/utils/platformHomeMobile'
import MobileHeader from '@/components/MobileHeader.vue'
import MobileFloatingNav from '@/components/MobileFloatingNav.vue'
import MobileAppLauncher from '@/components/MobileAppLauncher.vue'
import MobileQuickCreate from '@/components/MobileQuickCreate.vue'
import MobileCreateSheet from '@/components/MobileCreateSheet.vue'
import MobileProfileMenu from '@/components/MobileProfileMenu.vue'
import MobileNotificationsSheet from '@/components/MobileNotificationsSheet.vue'
import MobileGlobalSearchSheet from '@/components/MobileGlobalSearchSheet.vue'
import MobileAstraSheet from '@/components/MobileAstraSheet.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const chrome = provideShellChrome()

const notificationsOpen = ref(false)
const notificationsUnread = ref(0)

const isDetail = computed(() => Boolean(route.meta.hideTabBar))
const isHub = computed(() => route.name === 'home')
const showFloatingChrome = computed(() => !isDetail.value)
const shellSheetOpen = computed(
  () =>
    chrome.profileMenuOpen.value ||
    chrome.launcherOpen.value ||
    chrome.quickCreateOpen.value ||
    chrome.searchOpen.value ||
    Boolean(chrome.createModuleKey.value) ||
    notificationsOpen.value
)
const showFloatingNav = computed(
  () => showFloatingChrome.value && !chrome.astraOpen.value && !shellSheetOpen.value
)
const showGlobalSearch = computed(() => !isDetail.value && route.name !== 'search')
const showHeaderSearch = computed(() => isHub.value && showGlobalSearch.value)
/** Elevated sheet under the header (rounded top corners + chrome backdrop). */
const useSheetChrome = computed(() => showFloatingChrome.value)
/** Home-only: extra top space for the collapsing header search field. */
const useSearchChrome = computed(() => showHeaderSearch.value)

const mainEl = ref<HTMLElement | null>(null)
const scrollProgress = ref(0)
let searchHeightPx = 0
let scrollTicking = false

/** Header collapse tracks the finger 1:1, so it is driven by scroll position rather than animated. */
const searchProgress = computed(() =>
  showHeaderSearch.value ? scrollProgress.value : 1
)
const searchCollapsed = computed(() => searchProgress.value > 0.6)
const showSearchIcon = computed(
  () => showGlobalSearch.value && (!showHeaderSearch.value || searchCollapsed.value)
)

function measureSearchHeight() {
  const styles = getComputedStyle(document.documentElement)
  const raw = styles.getPropertyValue('--header-search-height').trim()
  const value = parseFloat(raw) || 0
  searchHeightPx = raw.endsWith('rem') ? value * (parseFloat(styles.fontSize) || 16) : value
}

function syncScrollProgress() {
  const top = mainEl.value?.scrollTop ?? 0
  scrollProgress.value = searchHeightPx > 0 ? Math.min(1, Math.max(0, top / searchHeightPx)) : 0
}

function onMainScroll() {
  if (scrollTicking) return
  scrollTicking = true
  requestAnimationFrame(() => {
    scrollTicking = false
    syncScrollProgress()
  })
}

const headerTitle = computed(() => {
  if (isHub.value) {
    const firstName = userFirstName(auth.user)
    return formatPlatformGreeting(null, firstName)
  }
  if (route.name === 'module-list' || route.name === 'people-list') {
    const moduleKey =
      route.name === 'people-list' ? 'people' : String(route.params.moduleKey || '')
    return getMobileModule(moduleKey)?.label || 'Module'
  }
  if (route.name === 'module-detail' || route.name === 'people-detail') {
    const moduleKey =
      route.name === 'people-detail' ? 'people' : String(route.params.moduleKey || '')
    const mod = getMobileModule(moduleKey)
    return mod ? `${mod.label}` : 'Detail'
  }
  if (typeof route.meta.title === 'string') return route.meta.title
  return 'Arivu'
})

function onBack() {
  router.back()
}

async function refreshUnread() {
  try {
    const items = await fetchNotifications(40)
    notificationsUnread.value = items.filter((item) => !item.read).length
  } catch {
    notificationsUnread.value = 0
  }
}

function openNotifications() {
  chrome.closeSearch()
  notificationsOpen.value = true
}

function closeNotifications() {
  notificationsOpen.value = false
  void refreshUnread()
}

function onNotificationsChanged() {
  void refreshUnread()
}

watch(
  () => route.fullPath,
  () => {
    chrome.closeAllSheets()
    notificationsOpen.value = false
  }
)

watch(chrome.searchOpen, (isOpen) => {
  if (isOpen) notificationsOpen.value = false
})

watch(chrome.profileMenuOpen, (isOpen) => {
  if (isOpen) notificationsOpen.value = false
})

onMounted(() => {
  measureSearchHeight()
  syncScrollProgress()
  window.addEventListener('resize', measureSearchHeight)
  window.setTimeout(() => {
    void refreshUnread()
  }, 1200)
  window.setTimeout(() => {
    void auth.refreshProfile()
  }, 1500)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureSearchHeight)
})
</script>

<template>
  <div
    class="shell screen"
    :class="{
      'shell--chrome': useSheetChrome,
      'shell--search-chrome': useSearchChrome
    }"
    :style="{ '--search-progress': String(searchProgress) }"
  >
    <MobileHeader
      :title="headerTitle"
      :show-back="false"
      :emphasize="isHub"
      :unread-count="notificationsUnread"
      :show-search="showHeaderSearch"
      :show-search-icon="showSearchIcon"
      :search-collapsed="searchCollapsed"
      :chrome="useSheetChrome"
      @back="onBack"
      @notifications="openNotifications"
    />

    <main
      ref="mainEl"
      class="shell-main shell-main--list"
      :class="{ 'shell-main--chrome': useSheetChrome }"
      @scroll.passive="onMainScroll"
    >
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>

    <RouterView name="drawer" v-slot="{ Component }">
      <Transition name="record-drawer">
        <component :is="Component" v-if="Component" />
      </Transition>
    </RouterView>

    <MobileFloatingNav v-if="showFloatingNav" />
    <MobileAppLauncher />
    <MobileQuickCreate />
    <MobileCreateSheet />
    <MobileProfileMenu />
    <MobileNotificationsSheet
      :open="notificationsOpen"
      @close="closeNotifications"
      @changed="onNotificationsChanged"
    />
    <MobileGlobalSearchSheet />
    <MobileAstraSheet />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-elevated);
  --shell-search-space: 0px;
}

.shell--chrome {
  background: var(--chrome-bg);
}

.shell--search-chrome {
  --shell-search-space: var(--header-search-height);
}

.shell-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  /* Above the fixed header (40) so the sheet's shadow is not painted over, below the floating nav (44). */
  position: relative;
  z-index: 41;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  background: var(--bg-elevated);
  border-radius: 0;
  box-shadow: none;
  margin-top: calc(var(--mobile-top-offset) + var(--shell-search-space));
  margin-bottom: calc(-1 * var(--shell-search-space));
  transform: translateY(calc(-1 * var(--search-progress, 0) * var(--shell-search-space)));
}

.shell-main--chrome {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: 0 -3px 10px rgba(15, 23, 42, 0);
}

.shell-main--list {
  padding-bottom: calc(var(--mobile-bottom-offset) + var(--shell-search-space));
}

:deep(.record-drawer-enter-active),
:deep(.record-drawer-leave-active) {
  transition: transform 340ms cubic-bezier(0.32, 0.72, 0, 1);
}

:deep(.record-drawer-enter-from),
:deep(.record-drawer-leave-to) {
  transform: translate3d(100%, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.record-drawer-enter-active),
  :deep(.record-drawer-leave-active) {
    transition: none;
  }
}

</style>
