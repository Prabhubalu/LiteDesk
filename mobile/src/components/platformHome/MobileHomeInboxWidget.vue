<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowRightIcon, BellIcon, InboxIcon } from '@heroicons/vue/24/outline'
import type { PlatformHomeQueueItem } from '@/types/platformHome'
import { formatRelativeTime, mobilePathFromWebRoute } from '@/utils/platformHomeMobile'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

const props = defineProps<{
  notificationsPreview: PlatformHomeQueueItem[]
  mailPreview: PlatformHomeQueueItem[]
  notificationsUnread: number
  unreadMail: number
}>()

const router = useRouter()

function notificationsLabel(count: number) {
  return count === 1 ? '1 alert' : `${count} alerts`
}

function mailLabel(count: number) {
  return count === 1 ? '1 unread' : `${count} unread`
}

function openItem(item: PlatformHomeQueueItem) {
  if (item.kind === 'notification') {
    void router.push('/notifications')
    return
  }
  const path = mobilePathFromWebRoute(item.route)
  if (path) void router.push(path)
}

function metaLine(item: PlatformHomeQueueItem) {
  const time = formatRelativeTime(item.updatedAt)
  return [item.subtitle, time].filter(Boolean).join(' · ')
}

const hasItems = () => props.notificationsPreview.length > 0 || props.mailPreview.length > 0
</script>

<template>
  <MobileHomeWidgetShell title="Inbox" flush>
    <template #actions>
      <button
        v-if="notificationsUnread > 0"
        type="button"
        class="header-link"
        @click="router.push('/notifications')"
      >
        {{ notificationsLabel(notificationsUnread) }}
        <ArrowRightIcon class="header-link__icon" />
      </button>
      <button
        v-if="unreadMail > 0"
        type="button"
        class="header-link"
        @click="router.push('/inbox')"
      >
        {{ mailLabel(unreadMail) }}
        <ArrowRightIcon class="header-link__icon" />
      </button>
    </template>

    <p v-if="!hasItems()" class="empty">No unread mail or notifications.</p>

    <div v-else class="groups">
      <div v-if="notificationsPreview.length" class="group">
        <p class="group__label">Alerts</p>
        <button
          v-for="item in notificationsPreview"
          :key="`n-${item.id}`"
          type="button"
          class="row"
          @click="openItem(item)"
        >
          <span class="icon icon--alert">
            <BellIcon />
          </span>
          <span class="copy">
            <span class="copy__title">{{ item.title }}</span>
            <span v-if="metaLine(item)" class="copy__meta">{{ metaLine(item) }}</span>
          </span>
          <span class="dot" aria-hidden="true" />
        </button>
      </div>

      <div v-if="mailPreview.length" class="group">
        <p class="group__label">Email</p>
        <button
          v-for="item in mailPreview"
          :key="`m-${item.id}`"
          type="button"
          class="row"
          @click="openItem(item)"
        >
          <span class="icon icon--mail">
            <InboxIcon />
          </span>
          <span class="copy">
            <span class="copy__title">{{ item.title }}</span>
            <span v-if="metaLine(item)" class="copy__meta">{{ metaLine(item) }}</span>
          </span>
        </button>
      </div>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.header-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 500;
}

.header-link__icon {
  width: 0.75rem;
  height: 0.75rem;
}

.empty {
  margin: 0;
  padding: 1.75rem 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.groups {
  display: grid;
}

.group + .group {
  border-top: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
}

.group__label {
  margin: 0;
  padding: 0.4rem 0.75rem 0.15rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: inherit;
  text-align: left;
}

.icon {
  display: flex;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
}

.icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.icon--alert {
  background: #f5f3ff;
  color: var(--accent-strong);
}

.icon--mail {
  background: #eff6ff;
  color: #1d4ed8;
}

.copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.copy__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.copy__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dot {
  width: 0.375rem;
  height: 0.375rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--accent);
}
</style>
