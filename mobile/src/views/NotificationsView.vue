<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchNotifications, markNotificationRead, type NotificationItem } from '@/api/notifications'

const items = ref<NotificationItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const unreadCount = computed(() => items.value.filter((n) => !n.read).length)

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
      await markNotificationRead(item._id, item.appKey || 'SALES')
      item.read = true
    } catch {
      /* non-blocking */
    }
  }
}

function titleFor(item: NotificationItem): string {
  return item.title || item.eventType || 'Notification'
}

function metaFor(item: NotificationItem): string {
  const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''
  return [when, item.body].filter(Boolean).join(' · ')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page notifications">
    <div class="stat-grid">
      <div class="card stat-card">
        <span class="stat-value">{{ loading ? '…' : items.length }}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">{{ loading ? '…' : unreadCount }}</span>
        <span class="stat-label">Unread</span>
      </div>
    </div>

    <div class="page-toolbar">
      <button class="btn btn-ghost btn-sm" type="button" :disabled="loading" @click="load">Refresh</button>
    </div>

    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="loading" class="empty card">Loading…</div>
    <div v-else-if="!items.length" class="empty card">You’re all caught up.</div>

    <div v-else class="card list">
      <button
        v-for="item in items"
        :key="item._id"
        type="button"
        class="list-item list-item-btn"
        :class="{ unread: !item.read }"
        @click="onOpen(item)"
      >
        <div class="row">
          <h3 class="list-title">{{ titleFor(item) }}</h3>
          <span v-if="!item.read" class="pill pill-warn">New</span>
        </div>
        <p class="list-meta">{{ metaFor(item) }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.notifications {
  display: grid;
  gap: 0.75rem;
}

.page-toolbar {
  display: flex;
  justify-content: flex-end;
}

.btn-sm {
  padding: 0.55rem 0.85rem;
  font-size: 0.85rem;
}

.list {
  overflow: hidden;
}

.list-item-btn {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: inherit;
}

.list-item-btn.unread {
  background: rgba(96, 73, 231, 0.06);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
</style>
