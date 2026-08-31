<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import {
  Bars3BottomLeftIcon,
  PaperAirplaneIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import {
  askAstra,
  confirmAstraProposal,
  fetchAstraConversation,
  fetchAstraNba,
  mapConversationMessages,
  suggestionLabel,
  suggestionPrompt,
  type AstraNbaItem,
  type AstraProposal,
  type AstraSuggestion
} from '@/api/astra'
import MobileAstraHistorySheet from '@/components/MobileAstraHistorySheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useKeyboardInset } from '@/composables/useKeyboardInset'
import { useShellChrome } from '@/composables/useShellChrome'
import {
  contextPillLabel,
  mergeAiContext,
  nbaSurfaceForContext,
  resolveMobileAiContext,
  type MobileAiContext
} from '@/utils/resolveMobileAiContext'
import { tapHaptic } from '@/utils/haptics'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  proposals: AstraProposal[]
  suggestions: AstraSuggestion[]
}

const route = useRoute()
const router = useRouter()
const chrome = useShellChrome()
const auth = useAuthStore()

const open = computed({
  get: () => chrome.astraOpen.value,
  set: (value) => {
    if (!value) chrome.closeAstra()
  }
})

const { keyboardInset } = useKeyboardInset(open)

const rootStyle = computed(() => ({
  '--keyboard-inset': `${keyboardInset.value}px`
}))

const draft = ref('')
const sending = ref(false)
const confirmingId = ref<string | null>(null)
const error = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const suggestions = ref<AstraSuggestion[]>([])
const nbaCards = ref<AstraNbaItem[]>([])
const nbaLoading = ref(false)
const conversationId = ref<string | undefined>()
const conversationTitle = ref('')
const historyOpen = ref(false)
const transcriptEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const historySheetRef = ref<InstanceType<typeof MobileAstraHistorySheet> | null>(null)

const routeContext = computed(() => resolveMobileAiContext(route))

const pageContext = computed<MobileAiContext>(() =>
  mergeAiContext(routeContext.value, chrome.astraOptions.value)
)

const contextLabel = computed(() => contextPillLabel(pageContext.value, chrome.astraOptions.value?.recordName))

const firstName = computed(() =>
  String(auth.user?.username || auth.user?.email || '')
    .split(/[\s@]/)[0]
    .trim()
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return firstName.value ? `${period}, ${firstName.value}` : period
})

const headerTitle = computed(() => conversationTitle.value || 'Astra')

const canSend = computed(() => Boolean(draft.value.trim()) && !sending.value)

const showEmpty = computed(() => !messages.value.length && !sending.value)

function scrollToBottom() {
  nextTick(() => {
    const el = transcriptEl.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function askContext() {
  return {
    moduleKey: pageContext.value.moduleKey,
    recordId: pageContext.value.kind === 'record' ? pageContext.value.recordId : undefined,
    recordName:
      pageContext.value.kind === 'record'
        ? chrome.astraOptions.value?.recordName || contextLabel.value
        : undefined,
    conversationId: conversationId.value
  }
}

async function loadNba() {
  nbaLoading.value = true
  try {
    const ctx = askContext()
    nbaCards.value = await fetchAstraNba({
      moduleKey: ctx.moduleKey,
      recordId: ctx.recordId,
      recordName: ctx.recordName,
      surface: nbaSurfaceForContext(pageContext.value)
    })
  } finally {
    nbaLoading.value = false
  }
}

function resetChat() {
  messages.value = []
  suggestions.value = []
  conversationId.value = undefined
  conversationTitle.value = ''
  error.value = null
  draft.value = ''
}

function onNewChat() {
  resetChat()
  void loadNba()
}

async function openConversation(id: string) {
  historyOpen.value = false
  if (!id) {
    onNewChat()
    return
  }
  const detail = await fetchAstraConversation(id)
  if (!detail) return
  conversationId.value = detail.id
  conversationTitle.value = detail.title || ''
  messages.value = mapConversationMessages(detail.messages || [])
  const lastAssistant = [...messages.value].reverse().find((m) => m.role === 'assistant')
  suggestions.value = lastAssistant?.suggestions?.slice(0, 3) || []
  scrollToBottom()
}

async function submitPrompt(text: string) {
  const prompt = text.trim()
  if (!prompt || sending.value) return

  tapHaptic()
  error.value = null
  messages.value.push({ role: 'user', content: prompt, proposals: [], suggestions: [] })
  draft.value = ''
  suggestions.value = []
  scrollToBottom()

  sending.value = true
  try {
    const history = messages.value.slice(0, -1).map((item) => ({
      role: item.role,
      content: item.content
    }))
    const result = await askAstra(prompt, { ...askContext(), history })
    conversationId.value = result.conversationId || conversationId.value
    if (result.conversationTitle) conversationTitle.value = result.conversationTitle
    messages.value.push({
      role: 'assistant',
      content: result.answer || 'No response.',
      proposals: result.proposals,
      suggestions: result.suggestions
    })
    suggestions.value = result.suggestions.slice(0, 3)
    void historySheetRef.value?.refresh()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Something went wrong. Try again.'
    error.value = message
    messages.value.push({
      role: 'assistant',
      content: message,
      proposals: [],
      suggestions: []
    })
  } finally {
    sending.value = false
    scrollToBottom()
    nextTick(() => inputEl.value?.focus())
  }
}

function openHistory() {
  tapHaptic()
  historyOpen.value = true
}

function navigateAstraHref(href?: string) {
  const path = String(href || '').trim()
  if (!path) return
  if (/^https?:\/\//i.test(path)) {
    window.open(path, '_blank', 'noopener')
    return
  }
  const mobilePath = path.replace(/^\/app\//, '/')
  void router.push(mobilePath)
  close()
}

async function onConfirmProposal(proposal: AstraProposal, messageIndex: number) {
  if (confirmingId.value) return
  confirmingId.value = proposal.id
  tapHaptic()
  const result = await confirmAstraProposal(proposal, conversationId.value)
  const msg = messages.value[messageIndex]
  if (msg) {
    msg.proposals = msg.proposals.map((p) =>
      p.id === proposal.id
        ? {
            ...p,
            status: result.ok ? 'completed' : p.status,
            href: result.href || p.href,
            navigateLabel: result.navigateLabel || p.navigateLabel
          }
        : p
    )
  }
  if (result.message) {
    messages.value.push({
      role: 'assistant',
      content: result.message,
      proposals: [],
      suggestions: []
    })
  }
  if (result.ok && result.href) navigateAstraHref(result.href)
  confirmingId.value = null
  scrollToBottom()
}

function onSubmit() {
  void submitPrompt(draft.value)
}

function onSuggestion(suggestion: AstraSuggestion) {
  void submitPrompt(suggestionPrompt(suggestion))
}

function onNbaCard(card: AstraNbaItem) {
  void submitPrompt(card.prompt || card.label)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    onSubmit()
  }
}

async function setKeyboardAccessoryVisible(visible: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: visible })
  } catch {
    // optional
  }
}

function close() {
  void setKeyboardAccessoryVisible(true)
  inputEl.value?.blur()
  historyOpen.value = false
  chrome.closeAstra()
}

watch(open, (isOpen) => {
  void setKeyboardAccessoryVisible(!isOpen)
  if (!isOpen) {
    inputEl.value?.blur()
    historyOpen.value = false
    return
  }
  error.value = null
  void loadNba()
  nextTick(() => {
    const options = chrome.astraOptions.value
    if (options?.prompt) {
      draft.value = options.prompt
      if (options.autoAsk) {
        void submitPrompt(options.prompt)
        return
      }
    }
    inputEl.value?.focus()
    scrollToBottom()
  })
})

watch(
  () => route.fullPath,
  () => {
    if (open.value && showEmpty.value) void loadNba()
  }
)

watch(keyboardInset, (inset) => {
  if (inset <= 0 || !open.value) return
  nextTick(() => {
    inputEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    scrollToBottom()
  })
})

onBeforeUnmount(() => {
  void setKeyboardAccessoryVisible(true)
  inputEl.value?.blur()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="astra-root" :style="rootStyle">
      <header class="astra-header">
        <button type="button" class="astra-icon-btn" aria-label="Conversation history" @click="openHistory">
          <Bars3BottomLeftIcon class="astra-icon-btn__icon" aria-hidden="true" />
        </button>
        <div class="astra-header__brand">
          <img src="/assets/logo/Ai%20Logo.svg" alt="" class="astra-header__logo" decoding="async" />
          <div class="astra-header__copy">
            <p class="astra-header__title">{{ headerTitle }}</p>
            <p class="astra-header__subtitle">Your AI copilot</p>
          </div>
        </div>
        <div class="astra-header__actions">
          <button type="button" class="astra-text-btn" @click="onNewChat">New</button>
          <button type="button" class="astra-icon-btn" aria-label="Close Astra" @click="close">
            <XMarkIcon class="astra-icon-btn__icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div v-if="pageContext.kind !== 'home' && contextLabel" class="astra-context">
        <span class="astra-context__label">Context</span>
        <span class="astra-context__pill">{{ contextLabel }}</span>
      </div>

      <div ref="transcriptEl" class="astra-transcript">
        <div v-if="showEmpty" class="astra-empty">
          <img src="/assets/logo/Ai%20Logo.svg" alt="" class="astra-empty__logo" decoding="async" />
          <p class="astra-empty__greeting">{{ greeting }}</p>
          <p class="astra-empty__hint">The intelligence behind your work.</p>

          <div v-if="nbaLoading" class="astra-nba-loading">Loading suggestions…</div>
          <div v-else-if="nbaCards.length" class="astra-nba-grid">
            <button
              v-for="card in nbaCards.slice(0, 4)"
              :key="card.id"
              type="button"
              class="astra-nba-card"
              @click="onNbaCard(card)"
            >
              <span class="astra-nba-card__title">{{ card.label }}</span>
              <span v-if="card.rationale" class="astra-nba-card__body">{{ card.rationale }}</span>
            </button>
          </div>
        </div>

        <template v-else>
          <article
            v-for="(message, index) in messages"
            :key="`${message.role}-${index}`"
            class="astra-message"
            :class="`astra-message--${message.role}`"
          >
            <p>{{ message.content }}</p>
            <div v-if="message.proposals.length" class="astra-proposals">
              <button
                v-for="proposal in message.proposals"
                :key="proposal.id"
                type="button"
                class="astra-proposal"
                :disabled="proposal.status === 'completed' || confirmingId === proposal.id"
                @click="void onConfirmProposal(proposal, index)"
              >
                {{ proposal.status === 'completed' ? 'Done' : proposal.label }}
              </button>
              <button
                v-for="proposal in message.proposals.filter((p) => p.href)"
                :key="`${proposal.id}-nav`"
                type="button"
                class="astra-proposal astra-proposal--nav"
                @click="navigateAstraHref(proposal.href)"
              >
                {{ proposal.navigateLabel || 'View' }}
              </button>
            </div>
          </article>
          <p v-if="sending" class="astra-status">Thinking…</p>
        </template>
      </div>

      <div v-if="suggestions.length" class="astra-suggestions">
        <button
          v-for="(suggestion, index) in suggestions"
          :key="`${suggestionLabel(suggestion)}-${index}`"
          type="button"
          class="astra-suggestion"
          @click="onSuggestion(suggestion)"
        >
          {{ suggestionLabel(suggestion) }}
        </button>
      </div>

      <footer class="astra-composer">
        <p v-if="error" class="astra-error">{{ error }}</p>
        <div class="astra-composer__row">
          <textarea
            ref="inputEl"
            v-model="draft"
            rows="1"
            class="astra-input"
            placeholder="What can I help you with?"
            :disabled="sending"
            @keydown="onKeydown"
          />
          <button
            type="button"
            class="astra-send"
            :disabled="!canSend"
            aria-label="Send"
            @click="onSubmit"
          >
            <PaperAirplaneIcon class="astra-send__icon" aria-hidden="true" />
          </button>
        </div>
        <p class="astra-footnote">Astra uses your workspace data. Writes still need your confirmation.</p>
      </footer>
    </div>

    <MobileAstraHistorySheet
      ref="historySheetRef"
      :open="historyOpen"
      :active-id="conversationId"
      @close="historyOpen = false"
      @select="void openConversation($event)"
    />
  </Teleport>
</template>

<style scoped>
.astra-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-elevated);
  padding-top: var(--safe-top);
  padding-bottom: calc(var(--safe-bottom) + var(--keyboard-inset, 0px));
  transition: padding-bottom 0.2s ease;
}

.astra-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: var(--bg-elevated);
}

.astra-header__brand {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.astra-header__logo {
  width: 1.85rem;
  height: 1.85rem;
  object-fit: contain;
}

.astra-header__copy {
  min-width: 0;
}

.astra-header__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.astra-header__subtitle {
  margin: 0.05rem 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.astra-header__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.astra-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border: none;
  border-radius: 12px;
  background: var(--bg-soft);
  color: var(--text);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.astra-icon-btn__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.astra-text-btn {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.35rem 0.5rem;
}

.astra-context {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-elevated));
}

.astra-context__label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.astra-context__pill {
  min-width: 0;
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-soft));
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.astra-transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.astra-empty {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.65rem;
  padding: 0.5rem 0.25rem 1rem;
  width: 100%;
}

.astra-empty__logo {
  width: 4.25rem;
  height: 4.25rem;
  object-fit: contain;
}

.astra-empty__greeting {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
}

.astra-empty__hint {
  margin: 0;
  max-width: 18rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.astra-nba-loading {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.astra-nba-grid {
  width: 100%;
  margin-top: 0.85rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.astra-nba-card {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  text-align: left;
}

.astra-nba-card__title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.35;
}

.astra-nba-card__body {
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.astra-message {
  max-width: 92%;
  padding: 0.75rem 0.9rem;
  border-radius: 1rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.astra-message--user {
  align-self: flex-end;
  background: var(--accent-strong);
  color: #fff;
  border-bottom-right-radius: 0.35rem;
}

.astra-message--assistant {
  align-self: flex-start;
  background: var(--bg-soft);
  color: var(--text);
  border-bottom-left-radius: 0.35rem;
}

.astra-message p {
  margin: 0;
}

.astra-proposals {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.astra-proposal {
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.35rem 0.7rem;
}

.astra-proposal:disabled {
  opacity: 0.65;
}

.astra-proposal--nav {
  border-style: dashed;
}

.astra-status {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.astra-suggestions {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0 1rem 0.5rem;
}

.astra-suggestion {
  flex: 0 0 auto;
  max-width: 16rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated));
  color: var(--accent-strong);
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.astra-composer {
  flex-shrink: 0;
  padding: 0.55rem 1rem 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: var(--bg-elevated);
}

.astra-error {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--danger);
}

.astra-composer__row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.astra-input {
  flex: 1;
  min-height: 2.75rem;
  max-height: 7rem;
  resize: none;
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 1rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 16px;
  line-height: 1.35;
}

.astra-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 2px rgba(96, 73, 231, 0.22);
}

.astra-send {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: 999px;
  background: var(--accent-strong);
  color: #fff;
}

.astra-send:disabled {
  opacity: 0.45;
}

.astra-send__icon {
  width: 1.15rem;
  height: 1.15rem;
}

.astra-footnote {
  margin: 0.45rem 0 0;
  font-size: 0.68rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
