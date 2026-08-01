<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div
      v-if="showToolbar"
      class="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800 sm:px-6"
    >
      <div class="relative min-w-0 flex-1">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          v-model="searchQuery"
          type="search"
          class="w-full rounded-md border border-gray-200 bg-white py-1 pl-7 pr-2 text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          :placeholder="t('liveChat.closedSessionTranscriptSearch')"
          :aria-label="t('liveChat.closedSessionTranscriptSearch')"
        />
      </div>
      <button
        v-if="canAdmin"
        type="button"
        class="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        :disabled="exporting"
        @click="emit('export')"
      >
        {{ t('liveChat.exportTranscript') }}
      </button>
    </div>

    <div
      ref="scrollRef"
      class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-neutral-950 sm:px-6"
    >
      <div v-if="loading" class="py-6 text-sm text-gray-500 dark:text-gray-400">
        {{ t('liveChat.loadingMessages') }}
      </div>
      <div v-else-if="error" class="py-6 text-sm text-rose-600 dark:text-rose-300">
        {{ error }}
      </div>
      <template v-else>
        <div v-if="!filteredMessages.length" class="py-6 text-sm text-gray-500 dark:text-gray-400">
          {{ searchQuery ? t('liveChat.closedSessionTranscriptSearchEmpty') : t('liveChat.noMessagesYet') }}
        </div>

        <template v-for="m in filteredMessages" :key="m._id">
          <div v-if="isSystemMessage(m)" class="flex justify-center">
            <p class="rounded-full bg-gray-200/80 px-3 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {{ m.body || '—' }}
            </p>
          </div>
          <div
            v-else
            class="flex"
            :class="m.direction === 'inbound' ? '' : 'justify-end'"
          >
            <div
              class="max-w-[min(100%,42rem)] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm shadow-sm"
              :class="messageBubbleClass(m)"
            >
              <p
                v-if="m.direction === 'inbound'"
                class="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400"
              >
                {{ inboundAuthorLabel(m) }}
              </p>
              <p
                v-else-if="!isInternalNote(m)"
                class="mb-1 text-[11px] font-medium"
                :class="isBotMessage(m) ? 'text-indigo-200' : 'text-teal-100'"
              >
                {{ outboundAuthorLabel(m) }}
              </p>
              <p>{{ m.body || '—' }}</p>
              <ul v-if="messageAttachments(m).length" class="mt-2 space-y-1">
                <li v-for="(att, attIdx) in messageAttachments(m)" :key="`${m._id}-att-${attIdx}`">
                  <a
                    :href="attachmentHref(att)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-xs underline dark:bg-white/10"
                    :class="m.direction === 'outbound' && !isInternalNote(m) ? 'text-white/95' : 'text-indigo-700 dark:text-indigo-300'"
                  >
                    <PaperClipIcon class="h-3 w-3 shrink-0" />
                    <span class="truncate">{{ att.fileName || t('liveChat.composerAttachment') }}</span>
                  </a>
                </li>
              </ul>
              <div class="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                <span>{{ formatTime(m.createdAt) }}</span>
                <ChatMessageReceiptIcon
                  v-if="m.direction === 'outbound'"
                  :status="receiptStatus(m)"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <div
      v-if="!loading && !error"
      class="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 sm:px-6"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ t('liveChat.sessionClosedHint') }}</span>
        <button
          v-if="canReply"
          type="button"
          class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="emit('add-note')"
        >
          {{ t('liveChat.addNote') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon, PaperClipIcon } from '@heroicons/vue/24/outline';
import ChatMessageReceiptIcon from '@/components/cases/ChatMessageReceiptIcon.vue';
import { liveChatAttachmentHref } from '@/utils/liveChatAttachmentUpload';
import { receiptStatusFromMessage } from '@/utils/chatMessageReceipt';
import { formatTime } from '@/utils/localeFormat';

const props = defineProps({
  messages: { type: Array, default: () => [] },
  session: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  showToolbar: { type: Boolean, default: true },
  canReply: { type: Boolean, default: false },
  canAdmin: { type: Boolean, default: false },
  exporting: { type: Boolean, default: false },
});

const emit = defineEmits(['export', 'add-note']);

const { t } = useI18n();

const searchQuery = ref('');
const scrollRef = ref(null);

const filteredMessages = computed(() => {
  const q = String(searchQuery.value || '').trim().toLowerCase();
  const rows = Array.isArray(props.messages) ? props.messages : [];
  if (!q) return rows;
  return rows.filter((m) => String(m?.body || '').toLowerCase().includes(q));
});

function isSystemMessage(message) {
  return String(message?.authorType || '') === 'system';
}

function isInternalNote(message) {
  return String(message?.body || '').startsWith('[Note] ');
}

function isBotMessage(message) {
  return String(message?.authorType || '') === 'bot';
}

function inboundAuthorLabel(message) {
  return message.authorName || t('liveChat.visitor');
}

function outboundAuthorLabel(message) {
  if (isBotMessage(message)) {
    const name = String(message?.authorName || '').trim();
    return name ? `${t('liveChat.botLabel')} · ${name}` : t('liveChat.botLabel');
  }
  return String(message?.authorName || '').trim() || t('liveChat.agent');
}

function messageBubbleClass(message) {
  if (isInternalNote(message)) {
    return 'border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50';
  }
  if (message.direction === 'inbound') {
    return 'border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
  }
  if (isBotMessage(message)) {
    return 'border border-violet-200 bg-violet-600 text-white dark:border-violet-700 dark:bg-violet-700';
  }
  return 'border border-indigo-200 bg-indigo-600 text-white dark:border-indigo-700 dark:bg-indigo-700';
}

function receiptStatus(message) {
  return receiptStatusFromMessage(message);
}

function messageAttachments(message) {
  return Array.isArray(message?.attachments) ? message.attachments : [];
}

function attachmentHref(att) {
  return liveChatAttachmentHref(att);
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => props.messages.length,
  () => {
    if (!searchQuery.value) scrollToBottom();
  },
);
</script>
