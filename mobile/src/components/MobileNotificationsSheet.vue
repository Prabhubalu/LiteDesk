<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BellIcon } from '@heroicons/vue/24/outline'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem
} from '@/api/notifications'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  changed: []
}>()

const items = ref<NotificationItem[]>([])
const loading = ref(false)
const markingAll = ref(false)
const error = ref<string | null>(null)
const openedAt = ref<number | null>(null)

const hasUnread = computed(() => items.value.some((n) => !n.read))

const sections = computed(() => {
  const newItems: NotificationItem[] = []
  const earlier: NotificationItem[] = []
  const opened = openedAt.value

  for (const item of items.value) {
    const created = item.createdAt ? new Date(item.createdAt).getTime() : 0
    if (opened && created >= opened - 60_000 && !item.read) {
      newItems.push(item)
    } else {
      earlier.push(item)
    }
  }

  const out: Array<{ id: string; label: string; entries: NotificationItem[] }> = []
  if (newItems.length) out.push({ id: 'new', label: 'New', entries: newItems })
  if (earlier.length) {
    out.push({
      id: 'earlier',
      label: newItems.length ? 'Earlier' : 'All',
      entries: earlier
    })
  }
  return out
})

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await fetchNotifications()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load notifications'
  } finally {
    loading.value = false
  }
}

async function onOpen(item: NotificationItem) {
  if (!item.read) {
    try {
      await markNotificationRead(item._id, item.appKey)
      item.read = true
      emit('changed')
    } catch {
      /* non-blocking */
    }
  }
}

async function markAllRead() {
  if (!hasUnread.value || markingAll.value) return
  markingAll.value = true
  try {
    await markAllNotificationsRead()
    items.value = items.value.map((n) => ({ ...n, read: true }))
    emit('changed')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to mark all read'
  } finally {
    markingAll.value = false
  }
}

function titleFor(item: NotificationItem): string {
  return item.title || item.eventType || 'Notification'
}

function relativeTime(value?: string): string {
  if (!value) return ''
  const ms = Date.now() - new Date(value).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}

function entityLabel(item: NotificationItem): string {
  const type = item.entity?.type || item.eventType
  if (!type) return 'Alert'
  return String(type)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      openedAt.value = Date.now()
      void load()
    }
  }
)
</script>

<template>
  <MobileBottomSheet :open="open" title="Notifications" tall @close="emit('close')">
    <template #header-actions>
      <button
        type="button"
        class="mark-all"
        :disabled="!hasUnread || markingAll || loading"
        @click="markAllRead"
      >
        Mark all read
      </button>
    </template>

    <div class="sheet-notifications" :aria-busy="loading">
      <div v-if="error" class="banner banner-error">{{ error }}</div>

      <template v-if="loading && !items.length">
        <div v-for="i in 4" :key="i" class="skel-row">
          <div class="skel skel-icon" />
          <div class="skel-copy">
            <div class="skel skel-line skel-line--lg" />
            <div class="skel skel-line" />
            <div class="skel skel-chip" />
          </div>
        </div>
      </template>

      <template v-else-if="items.length">
        <section v-for="section in sections" :key="section.id" class="section">
          <p class="section__label">{{ section.label }}</p>
          <button
            v-for="item in section.entries"
            :key="item._id"
            type="button"
            class="notif-card"
            :class="{ 'notif-card--unread': !item.read, 'notif-card--new': section.id === 'new' }"
            @click="onOpen(item)"
          >
            <span class="notif-card__icon" aria-hidden="true">
              <BellIcon class="notif-card__icon-svg" />
            </span>
            <span class="notif-card__body">
              <span class="notif-card__top">
                <span v-if="!item.read" class="dot" aria-hidden="true" />
                <span class="notif-card__title">{{ titleFor(item) }}</span>
                <span v-if="section.id === 'new'" class="pill-new">New</span>
              </span>
              <span v-if="item.body" class="notif-card__preview">{{ item.body }}</span>
              <span class="notif-card__meta">
                <span class="entity-chip">{{ entityLabel(item) }}</span>
                <span class="meta-sep">·</span>
                <span>{{ relativeTime(item.createdAt) }}</span>
              </span>
            </span>
          </button>
        </section>
      </template>

      <div v-else class="empty-state">
        <div class="empty-state__icon" aria-hidden="true">
          <BellIcon class="empty-state__icon-svg" />
        </div>
        <p class="empty-state__title">You’re all caught up</p>
        <p class="empty-state__sub">No new notifications right now.</p>
      </div>
    </div>
  </MobileBottomSheet>
</template>

<style scoped>
.mark-all {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.5rem;
  min-height: 2rem;
}

.mark-all:disabled {
  opacity: 0.45;
}

.sheet-notifications {
  display: grid;
  gap: 0.85rem;
}

.section {
  display: grid;
  gap: 0.4rem;
}

.section__label {
  margin: 0;
  padding: 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.notif-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-soft) 55%, transparent);
  color: inherit;
  padding: 0.75rem 0.85rem;
  min-height: 3.75rem;
}

.notif-card--unread {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated));
}

.notif-card:active {
  border-color: color-mix(in srgb, var(--border) 80%, transparent);
}

.notif-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--text-muted);
  flex-shrink: 0;
}

.notif-card__icon-svg {
  width: 1.125rem;
  height: 1.125rem;
}

.notif-card--unread .notif-card__icon {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-strong);
}

.notif-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.notif-card__top {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}

.dot {
  width: 0.4rem;
  height: 0.4rem;
  margin-top: 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
  flex-shrink: 0;
}

.notif-card__title {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  line-height: 1.35;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.notif-card--unread .notif-card__title {
  font-weight: 600;
}

.pill-new {
  flex-shrink: 0;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.notif-card__preview {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-card__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  min-width: 0;
}

.entity-chip {
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: var(--bg-soft);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
}

.meta-sep {
  opacity: 0.5;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 0.35rem;
  padding: 2.5rem 1rem;
  text-align: center;
}

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--bg-soft);
  color: var(--text-muted);
}

.empty-state__icon-svg {
  width: 1.5rem;
  height: 1.5rem;
}

.empty-state__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.empty-state__sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.skel-row {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0.35rem;
}

.skel {
  border-radius: 8px;
  background: var(--bg-soft);
  animation: pulse 1.2s ease-in-out infinite;
}

.skel-icon {
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
}

.skel-copy {
  flex: 1;
  display: grid;
  gap: 0.45rem;
}

.skel-line {
  height: 0.55rem;
  width: 65%;
}

.skel-line--lg {
  width: 80%;
  height: 0.7rem;
}

.skel-chip {
  width: 4rem;
  height: 1rem;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
