<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  AtSymbolIcon,
  FaceSmileIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import type { TaskAssignee } from '@/api/tasks'

type MentionItem = {
  id: string
  name: string
  type: 'user' | 'all'
  email?: string
  avatar?: string
  initials: string
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '✅', '🔥', '👀', '🙏', '😊', '💯']

const props = defineProps<{
  users: TaskAssignee[]
  sending?: boolean
  placeholder?: string
  resolveAvatar: (raw?: string | null) => string
  initialsFor: (name: string) => string
}>()

const emit = defineEmits<{
  send: [payload: { content: string; files: File[] }]
}>()

const draft = ref('')
const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)
const emojiOpen = ref(false)
const mentions = ref<MentionItem[]>([])
const mentionStart = ref<number | null>(null)
const mentionQuery = ref('')

const mentionOpen = computed(() => mentionStart.value !== null)

const mentionOptions = computed<MentionItem[]>(() => {
  const people = props.users
    .map((user) => {
      const name =
        [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ').trim()
        || user.email
        || 'User'
      return {
        id: String(user._id || ''),
        name,
        type: 'user' as const,
        email: user.email,
        avatar: props.resolveAvatar(user.avatar),
        initials: props.initialsFor(name)
      }
    })
    .filter((item) => item.id)
  return [
    { id: 'all', name: 'All', type: 'all' as const, initials: '@' },
    ...people
  ]
})

const filteredMentions = computed(() => {
  const query = mentionQuery.value.trim().toLowerCase()
  const list = mentionOptions.value
  if (!query) return list.slice(0, 8)
  return list
    .filter((item) => item.name.toLowerCase().includes(query) || item.email?.toLowerCase().includes(query))
    .slice(0, 8)
})

const canSend = computed(() => Boolean(draft.value.trim() || files.value.length) && !props.sending)

function onInput() {
  const el = textarea.value
  if (!el) return
  const caret = el.selectionStart
  const before = draft.value.slice(0, caret)
  const match = /(^|[\s])@([^\s@]*)$/.exec(before)
  if (!match) {
    mentionStart.value = null
    mentionQuery.value = ''
    return
  }
  mentionStart.value = caret - match[2].length - 1
  mentionQuery.value = match[2]
}

function insertAtCursor(text: string, replaceFrom: number | null = null) {
  const el = textarea.value
  const start = replaceFrom ?? el?.selectionStart ?? draft.value.length
  const end = el?.selectionEnd ?? draft.value.length
  draft.value = `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`
  const next = start + text.length
  void nextTick(() => {
    el?.focus()
    el?.setSelectionRange(next, next)
  })
}

function insertMention(item: MentionItem) {
  const start = mentionStart.value ?? draft.value.length
  insertAtCursor(`@${item.name} `, start)
  mentions.value = [...mentions.value.filter((row) => row.name !== item.name), item]
  mentionStart.value = null
  mentionQuery.value = ''
}

function insertEmoji(emoji: string) {
  insertAtCursor(emoji)
  emojiOpen.value = false
}

function startMention() {
  emojiOpen.value = false
  insertAtCursor('@')
  void nextTick(onInput)
}

function onPickFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  files.value = [...files.value, ...picked].slice(0, 10)
  input.value = ''
}

function removeFile(index: number) {
  files.value = files.value.filter((_, i) => i !== index)
}

function serializeContent(): string {
  let text = draft.value.trim()
  const ordered = [...mentions.value].sort((a, b) => b.name.length - a.name.length)
  for (const item of ordered) {
    text = text.split(`@${item.name}`).join(`@[${item.name}](${item.type}:${item.id})`)
  }
  return text
}

function submit() {
  if (!canSend.value) return
  emit('send', { content: serializeContent(), files: files.value })
}

function reset() {
  draft.value = ''
  files.value = []
  mentions.value = []
  mentionStart.value = null
  mentionQuery.value = ''
  emojiOpen.value = false
}

defineExpose({ reset })
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <div v-if="mentionOpen" class="mention-list">
      <button
        v-for="item in filteredMentions"
        :key="`${item.type}:${item.id}`"
        type="button"
        class="mention-row"
        @mousedown.prevent="insertMention(item)"
      >
        <span class="mention-row__avatar" :class="{ 'is-all': item.type === 'all' }">
          {{ item.initials }}
        </span>
        <span class="mention-row__copy">
          <strong>{{ item.type === 'all' ? '@All' : item.name }}</strong>
          <span v-if="item.email" class="muted">{{ item.email }}</span>
        </span>
      </button>
      <p v-if="!filteredMentions.length" class="mention-empty">No matches</p>
    </div>

    <div v-if="emojiOpen" class="emoji-grid">
      <button
        v-for="emoji in EMOJIS"
        :key="emoji"
        type="button"
        class="emoji-grid__btn"
        @mousedown.prevent="insertEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <textarea
      ref="textarea"
      v-model="draft"
      rows="2"
      :placeholder="placeholder || 'Write a comment…'"
      :disabled="sending"
      @input="onInput"
      @keydown.enter.exact.prevent="submit"
    />

    <div v-if="files.length" class="file-row">
      <span v-for="(file, index) in files" :key="`${file.name}-${index}`" class="file-chip">
        {{ file.name }}
        <button type="button" class="file-chip__remove" :aria-label="`Remove ${file.name}`" @click="removeFile(index)">
          <XMarkIcon />
        </button>
      </span>
    </div>

    <div class="toolbar">
      <input
        ref="fileInput"
        type="file"
        multiple
        class="sr-only"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
        @change="onPickFiles"
      />
      <button type="button" class="tool" aria-label="Attach file" @click="fileInput?.click()">
        <PaperClipIcon />
      </button>
      <button type="button" class="tool" aria-label="Mention someone" @click="startMention">
        <AtSymbolIcon />
      </button>
      <button
        type="button"
        class="tool"
        :class="{ 'is-on': emojiOpen }"
        aria-label="Add emoji"
        @click="emojiOpen = !emojiOpen"
      >
        <FaceSmileIcon />
      </button>
      <button class="send" type="submit" :disabled="!canSend" aria-label="Send comment">
        <PaperAirplaneIcon />
      </button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  display: grid;
  gap: 0.45rem;
  margin: 0.75rem 0 calc(0.35rem + var(--safe-bottom));
  padding: 0.75rem 0.85rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 8px 24px -18px rgba(15, 23, 42, 0.35);
}

.composer textarea {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  padding: 0.15rem 0.1rem 0;
  resize: none;
  font: inherit;
  font-size: 1rem;
  line-height: 1.45;
  outline: none;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.tool {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border: none;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--text-muted);
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.tool.is-on,
.tool:active {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.tool :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.send {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  margin-left: auto;
  border: none;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--accent-strong);
  padding: 0;
}

.send:disabled {
  color: var(--text-muted);
  opacity: 0.45;
}

.send :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
}

.file-row,
.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  border-radius: 0.5rem;
  padding: 0.28rem 0.45rem;
  background: var(--bg-soft);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 500;
}

.file-chip__remove {
  display: grid;
  place-items: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 0;
}

.file-chip__remove :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

.emoji-grid__btn {
  width: 2.2rem;
  height: 2.2rem;
  border: none;
  border-radius: 0.55rem;
  background: var(--bg-soft);
  font-size: 1.15rem;
}

.mention-list {
  max-height: 11rem;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 0.85rem;
  background: var(--bg-elevated);
}

.mention-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}

.mention-row__avatar {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, white);
  color: var(--accent-strong);
  font-size: 0.62rem;
  font-weight: 700;
  flex-shrink: 0;
}

.mention-row__avatar.is-all {
  background: color-mix(in srgb, var(--warning) 22%, white);
  color: var(--warning);
}

.mention-row__copy {
  min-width: 0;
  display: grid;
}

.mention-row__copy strong {
  font-size: 0.88rem;
  font-weight: 600;
}

.mention-empty,
.muted {
  margin: 0;
  padding: 0.7rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
