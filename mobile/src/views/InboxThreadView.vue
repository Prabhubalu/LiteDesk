<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MobileRecordBar from '@/components/MobileRecordBar.vue'
import {
  fetchThreadMessages,
  markThreadViewed,
  sendEmail,
  setThreadDone,
  type InboxMessage
} from '@/api/inbox'
import { addRecent } from '@/services/recents'
import {
  avatarColorFor,
  displayNameFromAddress,
  formatMessageStamp,
  initialsFor,
  splitQuotedReply,
  stripEmailHtml
} from '@/utils/inboxDisplay'
import { tapHaptic } from '@/utils/haptics'
import { useShellChrome } from '@/composables/useShellChrome'

const props = defineProps<{ threadId: string }>()
const chrome = useShellChrome()

type RenderedMessage = {
  id: string
  outbound: boolean
  sender: string
  stamp: string
  status: string
  visible: string
  quoted: string
}

const router = useRouter()

const subject = ref('')
const messages = ref<InboxMessage[]>([])
const loading = ref(true)
const sending = ref(false)
const archiving = ref(false)
const error = ref<string | null>(null)
const replyBody = ref('')
const replyOpen = ref(false)
const expandedQuotes = ref<Set<string>>(new Set())
const composerRef = ref<HTMLTextAreaElement | null>(null)

const threadId = computed(() => decodeURIComponent(String(props.threadId || '')))

const latestInbound = computed(
  () => [...messages.value].reverse().find((m) => m.direction === 'inbound') || messages.value.at(-1)
)

const replyTo = computed(() => {
  const parent = latestInbound.value
  if (parent?.direction === 'inbound' && parent.fromAddress) return [parent.fromAddress]
  const addresses = parent?.toAddresses || []
  return addresses.filter(Boolean)
})

const participantLine = computed(() => {
  const names = new Set<string>()
  for (const message of messages.value) {
    const name = displayNameFromAddress(message.fromAddress)
    if (name) names.add(name)
  }
  return [...names].slice(0, 3).join(', ')
})

const rendered = computed<RenderedMessage[]>(() =>
  messages.value.map((message) => {
    const outbound = message.direction === 'outbound'
    const text = stripEmailHtml(String(message.body || ''))
    const { visible, quoted } = splitQuotedReply(text)
    return {
      id: String(message._id),
      outbound,
      sender: outbound ? 'You' : displayNameFromAddress(message.fromAddress) || 'Unknown sender',
      stamp: formatMessageStamp(message.sentAt || message.receivedAt),
      status: String(message.status || ''),
      visible: visible || '(no content)',
      quoted
    }
  })
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchThreadMessages(threadId.value)
    if (!res?.success || !res?.data) throw new Error('Thread not found')

    subject.value = res.data.subject || '(No subject)'
    messages.value = res.data.messages || []
    await addRecent({
      id: threadId.value,
      moduleKey: 'inbox',
      title: subject.value,
      path: `/inbox/${encodeURIComponent(threadId.value)}`
    })
    void markThreadViewed(threadId.value).catch(() => undefined)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load thread'
  } finally {
    loading.value = false
  }
}

function toggleQuote(id: string) {
  const next = new Set(expandedQuotes.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedQuotes.value = next
}

async function openReply() {
  replyOpen.value = true
  await nextTick()
  composerRef.value?.focus()
  autosize()
}

function autosize() {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

async function onReply() {
  const body = replyBody.value.trim()
  if (!body) return
  const to = replyTo.value
  if (!to.length) {
    error.value = 'No recipient available for reply'
    return
  }

  sending.value = true
  error.value = null
  try {
    const parent = latestInbound.value
    await sendEmail({
      to,
      subject: /^re:/i.test(subject.value) ? subject.value : `Re: ${subject.value}`,
      body,
      parentCommunicationId: parent?._id ? String(parent._id) : undefined
    })
    replyBody.value = ''
    replyOpen.value = false
    void tapHaptic()
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to send reply'
  } finally {
    sending.value = false
  }
}

async function onArchive() {
  archiving.value = true
  error.value = null
  try {
    const res = await setThreadDone(threadId.value, true)
    if (!res?.success) throw new Error(res?.message || 'Could not archive thread')
    void tapHaptic()
    router.back()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not archive thread'
  } finally {
    archiving.value = false
  }
}

watch(
  subject,
  (value) => {
    const name = value.trim()
    chrome.setAstraRecordName(name && name !== '(No subject)' ? name : null)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  chrome.setAstraRecordName(null)
})

watch(threadId, () => void load(), { immediate: true })
</script>

<template>
  <section class="record-drawer">
    <MobileRecordBar title="Thread" @back="router.back()" />
    <div class="record-drawer__body">
    <div class="thread page--detail" :class="{ 'thread--composing': replyOpen }">
    <header class="thread__header">
      <h1 class="thread__subject">{{ subject || 'Thread' }}</h1>
      <p v-if="participantLine" class="thread__participants muted">{{ participantLine }}</p>
      <div class="thread__actions">
        <button class="btn btn-ghost btn-sm" type="button" :disabled="loading" @click="load">
          Refresh
        </button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="archiving || loading" @click="onArchive">
          {{ archiving ? 'Archiving…' : 'Archive' }}
        </button>
      </div>
    </header>

    <div v-if="error" class="banner banner-error">{{ error }}</div>

    <div v-if="loading" class="thread__skeletons" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="thread__skeleton card" :class="{ 'thread__skeleton--mine': n === 2 }" />
    </div>

    <div v-else class="thread__messages">
      <article
        v-for="message in rendered"
        :key="message.id"
        class="message"
        :class="{ 'message--mine': message.outbound }"
      >
        <span
          class="message__avatar"
          :style="{ background: avatarColorFor(message.sender) }"
          aria-hidden="true"
        >
          {{ initialsFor(message.sender) }}
        </span>

        <div class="message__bubble">
          <div class="message__meta">
            <strong>{{ message.sender }}</strong>
            <span class="muted">{{ message.stamp }}</span>
          </div>

          <p class="message__body">{{ message.visible }}</p>

          <template v-if="message.quoted">
            <button type="button" class="message__quote-toggle" @click="toggleQuote(message.id)">
              {{ expandedQuotes.has(message.id) ? 'Hide quoted text' : 'Show quoted text' }}
            </button>
            <p v-if="expandedQuotes.has(message.id)" class="message__quoted muted">{{ message.quoted }}</p>
          </template>

          <span
            v-if="message.outbound && ['failed', 'undelivered', 'bounced'].includes(message.status)"
            class="pill pill-warn message__status"
          >
            {{ message.status }}
          </span>
        </div>
      </article>
    </div>

    <div class="composer">
      <button v-if="!replyOpen" class="btn composer__open" type="button" @click="openReply">
        Reply
      </button>

      <form v-else class="composer__form card" @submit.prevent="onReply">
        <p v-if="replyTo.length" class="composer__to muted">To {{ replyTo.join(', ') }}</p>
        <textarea
          ref="composerRef"
          v-model="replyBody"
          rows="1"
          placeholder="Write a reply…"
          :disabled="sending"
          @input="autosize"
        />
        <div class="composer__actions">
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :disabled="sending"
            @click="replyOpen = false"
          >
            Cancel
          </button>
          <button class="btn btn-sm" type="submit" :disabled="sending || !replyBody.trim()">
            {{ sending ? 'Sending…' : 'Send' }}
          </button>
        </div>
      </form>
    </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.thread {
  display: grid;
  gap: 0.85rem;
  padding: 0.85rem 0.85rem calc(5.5rem + var(--safe-bottom));
}

.thread--composing {
  padding-bottom: calc(12rem + var(--safe-bottom));
}

.thread__header {
  display: grid;
  gap: 0.35rem;
}

.thread__subject {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.thread__participants {
  margin: 0;
  font-size: 0.82rem;
}

.thread__actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.btn-sm {
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  border-radius: var(--radius-pill);
}

.thread__messages {
  display: grid;
  gap: 0.75rem;
}

.message {
  display: grid;
  grid-template-columns: 1.9rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.message--mine {
  grid-template-columns: minmax(0, 1fr) 1.9rem;
}

.message--mine .message__avatar {
  order: 2;
}

.message__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
}

.message__bubble {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-top-left-radius: 0.35rem;
  background: var(--bg-elevated);
  padding: 0.7rem 0.85rem;
}

.message--mine .message__bubble {
  border-top-left-radius: var(--radius);
  border-top-right-radius: 0.35rem;
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
}

.message__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
}

.message__meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message__meta .muted {
  flex: 0 0 auto;
  font-size: 0.72rem;
}

.message__body,
.message__quoted {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message__quote-toggle {
  margin-top: 0.5rem;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
}

.message__quoted {
  margin-top: 0.45rem;
  padding-left: 0.6rem;
  border-left: 2px solid var(--border);
  font-size: 0.82rem;
}

.message__status {
  margin-top: 0.5rem;
  text-transform: capitalize;
}

.thread__skeletons {
  display: grid;
  gap: 0.75rem;
}

.thread__skeleton {
  height: 4.5rem;
  background: linear-gradient(90deg, var(--bg-soft) 25%, var(--border) 50%, var(--bg-soft) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.thread__skeleton--mine {
  margin-left: 2.5rem;
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
  .thread__skeleton {
    animation: none;
  }
}

.composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 0.6rem 0.85rem calc(0.6rem + var(--safe-bottom));
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}

.composer__open {
  width: 100%;
  border-radius: var(--radius-pill);
}

.composer__form {
  display: grid;
  gap: 0.5rem;
  padding: 0.7rem;
}

.composer__to {
  margin: 0;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer__form textarea {
  width: 100%;
  min-height: 2.6rem;
  max-height: 11rem;
  resize: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--text);
  padding: 0.65rem 0.75rem;
}

.composer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}
</style>
