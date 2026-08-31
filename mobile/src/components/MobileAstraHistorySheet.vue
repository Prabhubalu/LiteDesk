<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { TrashIcon } from '@heroicons/vue/24/outline'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import {
  clearOlderAstraConversations,
  deleteAstraConversation,
  fetchAstraConversations,
  type AstraConversationSummary
} from '@/api/astra'

const props = defineProps<{
  open: boolean
  activeId?: string
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

const conversations = ref<AstraConversationSummary[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const nextCursor = ref<string | null>(null)

type HistoryGroup = { id: string; label: string; items: AstraConversationSummary[] }

function groupLabel(dateRaw?: string | null): string {
  if (!dateRaw) return 'Older'
  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) return 'Older'
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startToday.getTime() - startDate.getTime()) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'Previous 7 days'
  if (diffDays < 30) return 'Previous 30 days'
  return 'Older'
}

const grouped = computed<HistoryGroup[]>(() => {
  const map = new Map<string, AstraConversationSummary[]>()
  for (const item of conversations.value) {
    const label = groupLabel(item.updatedAt || item.createdAt)
    const bucket = map.get(label) || []
    bucket.push(item)
    map.set(label, bucket)
  }
  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']
  return order
    .filter((label) => map.has(label))
    .map((label) => ({ id: label, label, items: map.get(label) || [] }))
})

async function refresh() {
  loading.value = true
  try {
    const page = await fetchAstraConversations(null)
    conversations.value = page.conversations
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const page = await fetchAstraConversations(nextCursor.value)
    const seen = new Set(conversations.value.map((c) => c.id))
    conversations.value = [
      ...conversations.value,
      ...page.conversations.filter((c) => c.id && !seen.has(c.id))
    ]
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
  } finally {
    loadingMore.value = false
  }
}

async function onDelete(id: string) {
  const ok = await deleteAstraConversation(id)
  if (ok) conversations.value = conversations.value.filter((c) => c.id !== id)
}

async function onClearOlder() {
  await clearOlderAstraConversations()
  await refresh()
}

onMounted(() => {
  void refresh()
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void refresh()
  }
)

defineExpose({ refresh })
</script>

<template>
  <MobileBottomSheet
    :open="open"
    title="Conversations"
    aria-label="Astra conversations"
    tall
    elevated
    @close="emit('close')"
  >
    <div class="history">
      <button type="button" class="history__new btn" @click="emit('select', '')">
        + New chat
      </button>

      <p v-if="loading" class="history__muted">Loading conversations…</p>
      <p v-else-if="!conversations.length" class="history__muted">No conversations yet.</p>

      <section v-for="group in grouped" :key="group.id" class="history__group">
        <h3 class="history__heading">{{ group.label }}</h3>
        <ul class="history__list">
          <li v-for="item in group.items" :key="item.id">
            <button
              type="button"
              class="history__item"
              :class="{ 'history__item--active': item.id === activeId }"
              @click="emit('select', item.id)"
            >
              <span class="history__title">{{ item.title || 'Untitled chat' }}</span>
              <span v-if="item.preview" class="history__preview">{{ item.preview }}</span>
            </button>
            <button
              type="button"
              class="history__delete"
              aria-label="Delete conversation"
              @click.stop="void onDelete(item.id)"
            >
              <TrashIcon class="history__delete-icon" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <button
        v-if="hasMore"
        type="button"
        class="history__more"
        :disabled="loadingMore"
        @click="void loadMore()"
      >
        {{ loadingMore ? 'Loading…' : 'Load more' }}
      </button>

      <button v-if="conversations.length" type="button" class="history__clear" @click="void onClearOlder()">
        Clear older chats
      </button>
    </div>
  </MobileBottomSheet>
</template>

<style scoped>
.history {
  display: grid;
  gap: 0.85rem;
}

.history__new {
  width: 100%;
}

.history__muted {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.history__group {
  display: grid;
  gap: 0.35rem;
}

.history__heading {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.history__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.history__list li {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
}

.history__item {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.15rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  text-align: left;
}

.history__item--active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-soft));
}

.history__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history__preview {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history__delete {
  display: grid;
  place-items: center;
  width: 2.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--text-muted);
}

.history__delete-icon {
  width: 1rem;
  height: 1rem;
}

.history__more,
.history__clear {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.35rem;
}

.history__clear {
  justify-self: center;
  color: var(--accent-strong);
}
</style>
