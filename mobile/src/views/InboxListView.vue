<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchInboxThreads,
  fetchMailboxes,
  setThreadDone,
  type InboxThread,
  type Mailbox
} from '@/api/inbox'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import { EnvelopeIcon, FolderIcon } from '@heroicons/vue/24/outline'
import MobileComposeSheet from '@/components/MobileComposeSheet.vue'
import MobileSearchField from '@/components/MobileSearchField.vue'
import { useShellChrome } from '@/composables/useShellChrome'
import {
  avatarColorFor,
  formatThreadStamp,
  groupThreadsByDay,
  initialsFor,
  threadActivityAt,
  threadContextLine,
  threadSenderLine
} from '@/utils/inboxDisplay'
import { tapHaptic } from '@/utils/haptics'

type FilterId = 'all' | 'unread' | 'assigned_to_me' | 'sent' | 'scheduled' | 'snoozed'

type FolderId = FilterId | 'archived'

/** Mirrors the desktop Inbox sidebar folders (views + archived). */
const FOLDERS: Array<{ id: FolderId; label: string; filter: FilterId; done: boolean; countKey?: string }> = [
  { id: 'all', label: 'All mail', filter: 'all', done: false, countKey: 'all' },
  { id: 'unread', label: 'Unread', filter: 'unread', done: false, countKey: 'unread' },
  { id: 'assigned_to_me', label: 'Assigned to me', filter: 'assigned_to_me', done: false, countKey: 'assignedToMe' },
  { id: 'sent', label: 'Sent', filter: 'sent', done: false, countKey: 'sent' },
  { id: 'scheduled', label: 'Scheduled', filter: 'scheduled', done: false, countKey: 'scheduled' },
  { id: 'snoozed', label: 'Snoozed', filter: 'snoozed', done: false, countKey: 'snoozed' },
  { id: 'archived', label: 'Archived', filter: 'all', done: true }
]

/** Always-visible quick filters — full folder/mailbox sheet via Folders. */
const QUICK_FILTERS: FolderId[] = ['all', 'unread', 'sent', 'archived']

const SWIPE_THRESHOLD = 72

const router = useRouter()
const chrome = useShellChrome()

const threads = ref<InboxThread[]>([])
const counts = ref<Record<string, number>>({})
const mailboxes = ref<Mailbox[]>([])
const mailboxId = ref<string | null>(null)
const nextCursor = ref<string | null>(null)
const folderId = ref<FolderId>('all')
const foldersOpen = ref(false)
const composeOpen = ref(false)
const searchInput = ref('')
const searchTerm = ref('')
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const offline = ref(!navigator.onLine)

const swipeThreadId = ref('')
const swipeOffset = ref(0)
const swipeActive = ref(false)
const swipeStart = { x: 0, y: 0, locked: false }

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const groups = computed(() => groupThreadsByDay(threads.value))
const hasThreads = computed(() => threads.value.length > 0)

const activeFolder = computed(() => FOLDERS.find((f) => f.id === folderId.value) || FOLDERS[0])
const activeMailbox = computed(() => mailboxes.value.find((m) => m.id === mailboxId.value) || null)
const scopeLabel = computed(() => {
  if (activeMailbox.value) return `${activeFolder.value.label} · ${activeMailbox.value.label}`
  return activeFolder.value.label
})
const quickFolders = computed(() => FOLDERS.filter((f) => QUICK_FILTERS.includes(f.id)))
const defaultComposeMailboxId = computed(
  () =>
    mailboxId.value ||
    mailboxes.value.find((m) => m.outboundChannel && m.outboundChannel !== 'none')?.id ||
    mailboxes.value[0]?.id ||
    null
)

function threadKey(thread: InboxThread): string {
  return String(thread.threadId || '')
}

async function load({ append = false } = {}) {
  if (append) {
    if (!nextCursor.value || loadingMore.value) return
    loadingMore.value = true
  } else {
    loading.value = true
    nextCursor.value = null
  }
  error.value = null
  offline.value = !navigator.onLine

  try {
    const res = await fetchInboxThreads({
      filter: activeFolder.value.filter,
      limit: 25,
      search: searchTerm.value || undefined,
      cursor: append ? nextCursor.value || undefined : undefined,
      mailboxId: mailboxId.value || undefined,
      includeDone: activeFolder.value.done
    })

    if (!res?.success || !Array.isArray(res?.data?.threads)) {
      if (!append) threads.value = []
      error.value = 'Unable to load email threads'
      return
    }

    const rows = res.data.threads.filter((thread) => Boolean(threadKey(thread)))
    threads.value = append ? [...threads.value, ...rows] : rows
    nextCursor.value = res.data.nextCursor || null
    if (res.data.counts) counts.value = res.data.counts
  } catch (err) {
    if (!append) threads.value = []
    error.value = err instanceof Error ? err.message : 'Failed to load inbox'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMailboxes() {
  try {
    const res = await fetchMailboxes(activeFolder.value.done)
    if (res?.success && Array.isArray(res.data?.mailboxes)) {
      mailboxes.value = res.data.mailboxes
      if (mailboxId.value && !mailboxes.value.some((m) => m.id === mailboxId.value)) {
        mailboxId.value = null
      }
    }
  } catch {
    mailboxes.value = []
  }
}

function selectFolder(id: FolderId) {
  foldersOpen.value = false
  if (folderId.value === id) return
  void tapHaptic()
  folderId.value = id
  void load()
  void loadMailboxes()
}

function selectMailbox(id: string | null) {
  foldersOpen.value = false
  if (mailboxId.value === id) return
  void tapHaptic()
  mailboxId.value = id
  void load()
}

function resetScope() {
  foldersOpen.value = false
  void tapHaptic()
  folderId.value = 'all'
  mailboxId.value = null
  void load()
  void loadMailboxes()
}

function openCompose() {
  composeOpen.value = true
}

function onComposeSent() {
  void load()
  void loadMailboxes()
}

function onSearchInput(value: string) {
  searchInput.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTerm.value = value.trim()
    void load()
  }, 300)
}

function clearSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchInput.value = ''
  searchTerm.value = ''
  void load()
}

function openThread(thread: InboxThread) {
  const id = threadKey(thread)
  if (!id) return
  if (swipeOffset.value !== 0) {
    resetSwipe()
    return
  }
  thread.unread = false
  void router.push(`/inbox/${encodeURIComponent(id)}`)
}

function resetSwipe() {
  swipeThreadId.value = ''
  swipeOffset.value = 0
  swipeActive.value = false
  swipeStart.locked = false
}

function onTouchStart(thread: InboxThread, event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  swipeThreadId.value = threadKey(thread)
  swipeStart.x = touch.clientX
  swipeStart.y = touch.clientY
  swipeStart.locked = false
  swipeOffset.value = 0
  swipeActive.value = true
}

function onTouchMove(thread: InboxThread, event: TouchEvent) {
  if (swipeThreadId.value !== threadKey(thread)) return
  const touch = event.touches[0]
  if (!touch) return

  const dx = touch.clientX - swipeStart.x
  const dy = touch.clientY - swipeStart.y

  if (!swipeStart.locked) {
    if (Math.abs(dx) < 12) return
    if (Math.abs(dy) > Math.abs(dx)) {
      resetSwipe()
      return
    }
    swipeStart.locked = true
  }

  // Only archive (left) is actionable; damp the opposite direction.
  swipeOffset.value = dx < 0 ? Math.max(dx, -120) : Math.min(dx * 0.25, 24)
}

async function onTouchEnd(thread: InboxThread) {
  if (swipeThreadId.value !== threadKey(thread)) return
  const offset = swipeOffset.value
  swipeActive.value = false

  if (offset <= -SWIPE_THRESHOLD) {
    swipeOffset.value = 0
    swipeThreadId.value = ''
    await toggleDone(thread)
    return
  }
  resetSwipe()
}

async function toggleDone(thread: InboxThread) {
  const id = threadKey(thread)
  if (!id) return
  const nextDone = !thread.done
  const previous = threads.value
  actionError.value = null
  void tapHaptic()

  // Optimistic: archived threads leave the active view immediately.
  if (nextDone && !activeFolder.value.done) {
    threads.value = threads.value.filter((row) => threadKey(row) !== id)
  } else {
    thread.done = nextDone
  }

  try {
    const res = await setThreadDone(id, nextDone)
    if (!res?.success) throw new Error(res?.message || 'Action failed')
  } catch (err) {
    threads.value = previous
    actionError.value = err instanceof Error ? err.message : 'Could not update thread'
  }
}

function onOnline() {
  offline.value = false
  void load()
}

function onOffline() {
  offline.value = true
}

watch(sentinel, (element) => {
  observer?.disconnect()
  if (!element) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) void load({ append: true })
  })
  observer.observe(element)
})

function syncInboxPrimaryAction() {
  chrome.setPrimaryAction(() => {
    openCompose()
  }, 'Compose')
}

function clearInboxPrimaryAction() {
  chrome.setPrimaryAction(null)
}

onActivated(() => {
  syncInboxPrimaryAction()
})

onDeactivated(() => {
  clearInboxPrimaryAction()
})

onMounted(() => {
  void load()
  void loadMailboxes()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})

onBeforeUnmount(() => {
  clearInboxPrimaryAction()
  if (searchTimer) clearTimeout(searchTimer)
  observer?.disconnect()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<template>
  <section class="inbox">
    <div class="inbox__toolbar">
      <MobileSearchField
        :model-value="searchInput"
        placeholder="Search mail"
        aria-label="Search mail"
        clearable
        @update:model-value="onSearchInput"
        @clear="clearSearch"
      />

      <div class="inbox__scope">
        <div class="inbox__chips" role="tablist" aria-label="Quick filters">
          <button
            v-for="folder in quickFolders"
            :key="folder.id"
            type="button"
            role="tab"
            class="chip"
            :class="{ 'chip--active': folderId === folder.id }"
            :aria-selected="folderId === folder.id"
            @click="selectFolder(folder.id)"
          >
            {{ folder.id === 'all' ? 'All' : folder.label }}
            <span
              v-if="folder.countKey && counts[folder.countKey]"
              class="chip__count"
            >{{ counts[folder.countKey] }}</span>
          </button>
        </div>

        <button type="button" class="folders-btn" aria-label="Folders and mailboxes" @click="foldersOpen = true">
          <FolderIcon class="folders-btn__icon" aria-hidden="true" />
          <span v-if="activeMailbox || !QUICK_FILTERS.includes(folderId)" class="folders-btn__badge" />
        </button>
      </div>

      <p v-if="activeMailbox || !QUICK_FILTERS.includes(folderId)" class="inbox__scope-hint muted">
        {{ scopeLabel }}
        <button type="button" class="scope-clear" @click="resetScope">Reset</button>
      </p>
    </div>

    <div v-if="offline" class="banner banner-info inbox__banner">
      You’re offline. Showing the last loaded threads.
    </div>
    <div v-if="error" class="banner banner-error inbox__banner">{{ error }}</div>
    <div v-if="actionError" class="banner banner-error inbox__banner">{{ actionError }}</div>

    <div v-if="loading" class="inbox__skeletons" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="skeleton-row card">
        <span class="skeleton-avatar" />
        <span class="skeleton-lines">
          <span class="skeleton-line skeleton-line--sm" />
          <span class="skeleton-line" />
        </span>
      </div>
    </div>

    <div v-else-if="!hasThreads" class="inbox__empty card">
      <div class="inbox__empty-mark" aria-hidden="true">
        <EnvelopeIcon class="inbox__empty-icon" />
      </div>
      <h2 class="inbox__empty-title">
        {{ searchTerm ? 'No matching mail' : activeFolder.done ? 'Nothing archived' : 'Inbox zero' }}
      </h2>
      <p class="inbox__empty-copy">
        {{
          searchTerm
            ? 'Try a different name, subject, or keyword.'
            : 'New replies to your workspace mailboxes land here.'
        }}
      </p>
      <button v-if="searchTerm" class="btn btn-ghost" type="button" @click="clearSearch">
        Clear search
      </button>
    </div>

    <template v-else>
      <div v-for="group in groups" :key="group.key" class="inbox__group">
        <p class="inbox__group-label">{{ group.label }}</p>
        <div class="card inbox__rows">
          <div
            v-for="thread in group.threads"
            :key="threadKey(thread)"
            class="swipe"
          >
            <div class="swipe__action" :class="{ 'swipe__action--armed': swipeThreadId === threadKey(thread) && swipeOffset <= -72 }">
              <span>{{ thread.done ? 'Reopen' : 'Archive' }}</span>
            </div>

            <div
              class="row"
              :class="{
                'row--unread': thread.unread,
                'row--sliding': swipeActive && swipeThreadId === threadKey(thread)
              }"
              :style="swipeThreadId === threadKey(thread) ? { transform: `translateX(${swipeOffset}px)` } : undefined"
              role="button"
              tabindex="0"
              @click="openThread(thread)"
              @keydown.enter="openThread(thread)"
              @touchstart.passive="onTouchStart(thread, $event)"
              @touchmove.passive="onTouchMove(thread, $event)"
              @touchend="onTouchEnd(thread)"
              @touchcancel="resetSwipe"
            >
              <span
                class="row__avatar"
                :style="{ background: avatarColorFor(threadSenderLine(thread)) }"
                aria-hidden="true"
              >
                {{ initialsFor(threadSenderLine(thread)) }}
              </span>

              <span class="row__body">
                <span class="row__top">
                  <span class="row__sender">{{ threadSenderLine(thread) }}</span>
                  <time class="row__time" :datetime="threadActivityAt(thread)">
                    {{ formatThreadStamp(threadActivityAt(thread)) }}
                  </time>
                </span>

                <span class="row__subject">{{ thread.subject || '(no subject)' }}</span>

                <span class="row__meta">
                  <span v-if="threadContextLine(thread)" class="row__context">
                    {{ threadContextLine(thread) }}
                  </span>
                  <span v-if="thread.done" class="pill">Archived</span>
                  <span v-if="thread.lastMessageDirection === 'outbound'" class="pill">Sent</span>
                </span>
              </span>

              <span v-if="thread.unread" class="row__dot" aria-label="Unread" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="nextCursor" ref="sentinel" class="inbox__more">
        <span v-if="loadingMore" class="muted">Loading more…</span>
        <button v-else class="btn btn-ghost" type="button" @click="load({ append: true })">
          Load more
        </button>
      </div>
      <p v-else class="inbox__end muted">
        {{ threads.length }} {{ threads.length === 1 ? 'conversation' : 'conversations' }}
      </p>
    </template>

    <MobileBottomSheet :open="foldersOpen" title="Folders" @close="foldersOpen = false">
      <p class="sheet-label">Views</p>
      <button
        v-for="folder in FOLDERS"
        :key="folder.id"
        type="button"
        class="sheet-row"
        :class="{ 'sheet-row--active': folderId === folder.id }"
        @click="selectFolder(folder.id)"
      >
        <span class="sheet-row__label">{{ folder.label }}</span>
        <span v-if="folder.countKey && counts[folder.countKey]" class="pill">
          {{ counts[folder.countKey] }}
        </span>
      </button>

      <p class="sheet-label">Mailboxes</p>
      <button
        type="button"
        class="sheet-row"
        :class="{ 'sheet-row--active': !mailboxId }"
        @click="selectMailbox(null)"
      >
        <span class="sheet-row__label">All mailboxes</span>
      </button>
      <button
        v-for="mailbox in mailboxes"
        :key="mailbox.id"
        type="button"
        class="sheet-row"
        :class="{ 'sheet-row--active': mailboxId === mailbox.id }"
        @click="selectMailbox(mailbox.id)"
      >
        <span class="sheet-row__text">
          <span class="sheet-row__label">{{ mailbox.label }}</span>
          <span v-if="mailbox.emailAddress" class="sheet-row__sub muted">{{ mailbox.emailAddress }}</span>
        </span>
        <span v-if="mailbox.threadUnreadCount" class="pill pill-warn">{{ mailbox.threadUnreadCount }}</span>
      </button>
      <p v-if="!mailboxes.length" class="sheet-empty muted">
        No mailboxes connected yet. Connect one on the web app.
      </p>
    </MobileBottomSheet>

    <MobileComposeSheet
      :open="composeOpen"
      :mailboxes="mailboxes"
      :default-mailbox-id="defaultComposeMailboxId"
      @close="composeOpen = false"
      @sent="onComposeSent"
    />
  </section>
</template>

<style scoped>
.inbox {
  padding: 0.65rem 0 1rem;
}

.inbox__toolbar {
  display: grid;
  gap: 0.55rem;
  margin: 0 0.85rem 0.65rem;
}

.inbox__scope {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.inbox__chips {
  display: flex;
  gap: 0.35rem;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.05rem;
}

.inbox__chips::-webkit-scrollbar {
  display: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-muted);
  padding: 0.42rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.chip--active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent-strong);
}

.chip__count {
  font-variant-numeric: tabular-nums;
  font-size: 0.7rem;
  opacity: 0.9;
}

.folders-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.55rem;
  height: 2.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text);
}

.folders-btn__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.folders-btn__badge {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--accent);
}

.inbox__scope-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.15rem 0.1rem 0;
  font-size: 0.75rem;
}

.scope-clear {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0;
}

.sheet-label {
  margin: 0.6rem 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sheet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0.7rem 0.65rem;
}

.sheet-row--active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-strong);
}

.sheet-row__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.sheet-row__label {
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-row__sub {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-empty {
  margin: 0.35rem 0.65rem 0;
  font-size: 0.82rem;
}

.inbox__banner {
  margin: 0 0.85rem 0.6rem;
}

.inbox__group + .inbox__group {
  margin-top: 0.85rem;
}

.inbox__group-label {
  margin: 0 1rem 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.inbox__rows {
  overflow: hidden;
  border-radius: 0;
  border-left: none;
  border-right: none;
  box-shadow: none;
}

.swipe {
  position: relative;
  isolation: isolate;
}

.swipe__action {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1.1rem;
  background: color-mix(in srgb, var(--warning) 22%, var(--bg-elevated));
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
}

.swipe__action--armed {
  background: color-mix(in srgb, var(--warning) 45%, var(--bg-elevated));
}

.row {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 2.35rem minmax(0, 1fr) 0.6rem;
  align-items: start;
  gap: 0.7rem;
  padding: 0.85rem 0.9rem;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  touch-action: pan-y;
}

.row--sliding {
  transition: none;
}

.row:last-child {
  border-bottom: none;
}

.row:active {
  background: var(--bg-soft);
}

.row__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.row__body {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.row__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
}

.row__sender {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  font-weight: 600;
}

.row__time {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.row__subject {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.row__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.row__context {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__meta .pill {
  flex: 0 0 auto;
  font-size: 0.66rem;
  padding: 0.1rem 0.45rem;
}

.row__dot {
  align-self: center;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--accent);
}

.row--unread .row__sender,
.row--unread .row__subject {
  font-weight: 600;
  color: var(--text);
}

.inbox__skeletons {
  display: grid;
  gap: 0;
  margin: 0;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 2.35rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: 1px solid var(--border);
}

.skeleton-avatar,
.skeleton-line {
  display: block;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--bg-soft) 25%, var(--border) 50%, var(--bg-soft) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-avatar {
  width: 2.35rem;
  height: 2.35rem;
}

.skeleton-lines {
  display: grid;
  gap: 0.4rem;
}

.skeleton-line {
  height: 0.62rem;
}

.skeleton-line--sm {
  width: 45%;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-avatar,
  .skeleton-line {
    animation: none;
  }

  .row {
    transition: none;
  }
}

.inbox__empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  margin: 0 0.85rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
}

.inbox__empty-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-strong);
}

.inbox__empty-icon {
  width: 1.875rem;
  height: 1.875rem;
}

.inbox__empty-title {
  margin: 0.25rem 0 0;
  font-size: 1rem;
}

.inbox__empty-copy {
  margin: 0;
  max-width: 17rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.inbox__more {
  display: flex;
  justify-content: center;
  padding: 1rem 0 0.25rem;
}

.inbox__end {
  margin: 1rem 0 0;
  text-align: center;
  font-size: 0.78rem;
}
</style>
