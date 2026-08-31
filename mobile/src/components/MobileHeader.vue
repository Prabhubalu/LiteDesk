<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BellIcon, ChevronLeftIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useShellChrome } from '@/composables/useShellChrome'
import { useUserStatus } from '@/composables/useUserStatus'

const props = defineProps<{
  title: string
  showBack?: boolean
  emphasize?: boolean
  unreadCount?: number
  showSearch?: boolean
  showSearchIcon?: boolean
  searchCollapsed?: boolean
  chrome?: boolean
}>()

defineEmits<{
  back: []
  notifications: []
}>()

const auth = useAuthStore()
const shellChrome = useShellChrome()

const { currentPreset, displayLabel } = useUserStatus()

const avatarBroken = ref(false)
watch(() => auth.avatarUrl, () => { avatarBroken.value = false })

const searchAvailable = computed(() => Boolean(props.showSearch))
const searchIconVisible = computed(() => Boolean(props.showSearchIcon))

function onSearchIconClick() {
  shellChrome.openSearch()
}

const badgeLabel = computed(() => {
  const count = props.unreadCount ?? 0
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
})
</script>

<template>
  <header class="mobile-header" :class="{ 'mobile-header--chrome': chrome }">
    <div class="mobile-header__inner">
      <div class="mobile-header__leading">
        <button
          v-if="showBack"
          type="button"
          class="icon-btn"
          aria-label="Back"
          @click="$emit('back')"
        >
          <ChevronLeftIcon class="icon-btn__icon" aria-hidden="true" />
        </button>
        <h1
          class="mobile-header__title"
          :class="{ 'mobile-header__title--emphasize': emphasize }"
        >
          {{ title }}
        </h1>
      </div>

      <div class="mobile-header__actions">
        <Transition name="search-icon">
          <button
            v-if="searchIconVisible"
            type="button"
            class="icon-btn"
            aria-label="Search"
            @click="onSearchIconClick"
          >
            <MagnifyingGlassIcon class="icon-btn__icon" aria-hidden="true" />
          </button>
        </Transition>
        <button
          type="button"
          class="icon-btn"
          aria-label="Notifications"
          @click="$emit('notifications')"
        >
          <BellIcon class="icon-btn__icon" aria-hidden="true" />
          <span v-if="badgeLabel" class="icon-btn__badge">{{ badgeLabel }}</span>
        </button>
        <button
          type="button"
          class="profile-btn"
          :aria-label="`Account — ${displayLabel}`"
          @click="shellChrome.openProfileMenu()"
        >
          <img
            v-if="auth.avatarUrl && !avatarBroken"
            class="profile-avatar profile-avatar--image"
            :src="auth.avatarUrl"
            :alt="auth.displayName"
            @error="avatarBroken = true"
          />
          <span v-else class="profile-avatar">{{ auth.displayName.charAt(0).toUpperCase() }}</span>
          <span
            class="profile-status"
            :style="{ background: currentPreset.color }"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div
      v-if="searchAvailable"
      class="mobile-header__search"
      :class="{ 'mobile-header__search--collapsed': searchCollapsed }"
      :aria-hidden="searchCollapsed ? 'true' : undefined"
    >
      <button type="button" class="search-link" @click="shellChrome.openSearch()">
        <MagnifyingGlassIcon class="search-link__icon" aria-hidden="true" />
        <span>Search</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  padding-top: var(--safe-top);
  background: var(--bg-elevated);
}

.mobile-header--chrome {
  background: var(--chrome-bg);
}

.mobile-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--header-height);
  padding: 0 0.75rem 0 1rem;
}

.mobile-header__search {
  height: calc(var(--header-search-height) * (1 - var(--search-progress, 0)));
  padding: 0 0.85rem calc(0.6rem * (1 - var(--search-progress, 0)));
  opacity: clamp(0, calc(1.6 - var(--search-progress, 0) * 2.6), 1);
  overflow: hidden;
}

/* The field slides out through the top as the row shrinks, matching the sheet's travel. */
.mobile-header__search > * {
  transform: translateY(calc(-1 * var(--search-progress, 0) * var(--header-search-height)));
}

.mobile-header__search--collapsed {
  pointer-events: none;
}

.search-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  height: 100%;
  padding: 0 0.95rem;
  border: none;
  border-radius: var(--radius);
  background: var(--chrome-search);
  color: var(--text-muted);
  font: inherit;
  text-align: left;
}

.search-link__icon {
  width: 1.05rem;
  height: 1.05rem;
  flex-shrink: 0;
}

.search-icon-enter-active,
.search-icon-leave-active {
  transition:
    opacity 160ms ease,
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    width 200ms cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
}

.search-icon-enter-from,
.search-icon-leave-to {
  opacity: 0;
  width: 0;
  transform: scale(0.7);
}

@media (prefers-reduced-motion: reduce) {
  .search-icon-enter-active,
  .search-icon-leave-active {
    transition-duration: 1ms;
  }
}

.mobile-header__leading {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.mobile-header__title {
  margin: 0;
  min-width: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-header__title--emphasize {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.mobile-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.15rem;
  flex-shrink: 0;
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  padding: 0;
  flex-shrink: 0;
}

.icon-btn:active {
  background: var(--bg-soft);
}

.icon-btn__icon {
  width: 1.4rem;
  height: 1.4rem;
}

.icon-btn__badge {
  position: absolute;
  top: 0.15rem;
  right: 0.1rem;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1rem;
  text-align: center;
}

.profile-btn {
  position: relative;
  border: none;
  background: transparent;
  padding: 0;
  margin-left: 0.25rem;
  flex-shrink: 0;
}

.profile-status {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: var(--radius-pill);
  border: 2px solid var(--bg-elevated);
}

.mobile-header--chrome .profile-status {
  border-color: var(--chrome-bg);
}

.profile-avatar {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--accent-strong);
  background: rgba(96, 73, 231, 0.14);
}

.profile-avatar--image {
  object-fit: cover;
  display: block;
}
</style>
