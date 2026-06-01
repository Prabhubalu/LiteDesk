<!--
  EmailThreadReader.vue — conversation detail for inbox threads.
  Supports split-pane (list stays visible) and full-width mobile layouts.
-->
<template>
  <div class="flex h-full min-h-0 max-h-full flex-col overflow-hidden bg-white dark:bg-gray-950">
    <!-- Toolbar -->
    <div class="flex shrink-0 items-center gap-1 border-b border-[#EBEBEB] px-3 py-2 dark:border-gray-800">
      <button
        v-if="!splitView"
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('inbox.emailThreadReaderBackToInbox2')"
        @click="emit('close')"
      >
        <ArrowLeftIcon class="h-4 w-4" />
      </button>
      <button
        v-else-if="showClose"
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('settings.roleDrawerCloseSr')"
        @click="emit('close')"
      >
        <XMarkIcon class="h-4 w-4" />
      </button>
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/5"
          :disabled="!canNavigatePrev"
          @click="emit('navigate-prev')"
        >
          <ChevronUpIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/5"
          :disabled="!canNavigateNext"
          @click="emit('navigate-next')"
        >
          <ChevronDownIcon class="h-4 w-4" />
        </button>
      </div>

      <div class="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5"
          :title="threadRow?.done ? t('inbox.inboxSurfaceReopen') : t('inbox.inboxSurfaceMarkDone')"
          :disabled="actionLoading"
          @click="emit('toggle-done', threadRow)"
        >
          <ArchiveBoxIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5"
          :title="t('inbox.inboxSidebarMarkUnread')"
          @click="emit('toggle-read', threadRow)"
        >
          <EnvelopeOpenIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5"
          :title="t('inbox.inboxSidebarDelete')"
          @click="emit('toggle-done', threadRow)"
        >
          <TrashIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5"
          :title="t('inbox.emailThreadReaderReloadThread2')"
          :disabled="loading"
          @click="loadThread"
        >
          <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          v-if="recordPath"
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
          :title="t('inbox.inboxContextPanelOpenRecord')"
          @click="emit('open-record', threadRow)"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Subject + tags -->
    <div class="shrink-0 border-b border-[#EBEBEB] px-6 py-4 dark:border-gray-800">
      <h2 class="break-words text-[22px] font-semibold leading-tight tracking-tight text-[#37352F] dark:text-white">
        {{ subject }}
      </h2>
      <div v-if="threadRow?.tags?.length" class="mt-3 flex flex-wrap items-center gap-2">
        <span
          v-for="tag in threadRow.tags"
          :key="tag"
          class="inline-flex items-center gap-1 rounded-md bg-[#F1F1EF] px-2 py-0.5 text-[12px] text-[#37352F] dark:bg-gray-800 dark:text-gray-200"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Thread body -->
    <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="h-7 w-7 animate-spin rounded-full border-2 border-[#EBEBEB] border-t-[#2383E2] dark:border-gray-700 dark:border-t-blue-400" />
      </div>

      <div
        v-else-if="errorMessage"
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
      >
        {{ errorMessage }}
      </div>

      <div v-else-if="thread" class="mx-auto max-w-3xl space-y-2">
        <template v-for="(msg, idx) in thread.messages" :key="String(msg._id)">
          <!-- Collapsed earlier messages -->
          <button
            v-if="isMessageCollapsed(idx, thread.messages.length)"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-2.5 text-left transition hover:bg-[#F1F1EF] dark:border-gray-800 dark:bg-gray-900/60 dark:hover:bg-gray-800"
            @click="expandedIndex = idx"
          >
            <span class="min-w-0 flex-1 truncate text-[12px] text-[#787774] dark:text-gray-400">
              {{ senderEmail(msg) }}
            </span>
            <span class="min-w-0 flex-[2] truncate text-[12px] text-[#9B9A97] dark:text-gray-500">
              {{ messagePreview(msg) }}
            </span>
            <time class="shrink-0 text-[11px] tabular-nums text-[#9B9A97] dark:text-gray-500">
              {{ formatReaderDate(messageDate(msg)) }}
            </time>
          </button>

          <!-- Expanded message -->
          <article
            v-else
            class="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white dark:border-gray-800 dark:bg-gray-900"
          >
            <header class="flex items-start justify-between gap-3 border-b border-[#F1F1EF] px-5 py-4 dark:border-gray-800">
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium text-[#37352F] dark:text-white">
                  {{ senderEmail(msg) }}
                </p>
                <p class="mt-0.5 text-[12px] text-[#9B9A97] dark:text-gray-500">
                  {{ recipientsDisplay(msg) || t('inbox.inboxReaderToMe') }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="rounded-md p-1 text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
                  @click="openDockedReply"
                >
                  <ArrowUturnLeftIcon class="h-4 w-4" />
                </button>
                <time class="text-[11px] tabular-nums text-[#9B9A97] dark:text-gray-500">
                  {{ formatReaderDate(messageDate(msg)) }}
                </time>
              </div>
            </header>

            <div
              class="email-body px-5 py-5 text-[14px] leading-relaxed text-[#37352F] dark:text-gray-200"
              v-html="renderEmailMessageBody(msg.body)"
            />

            <div
              v-if="msg.attachments && msg.attachments.length > 0"
              class="border-t border-[#F1F1EF] px-5 py-3 dark:border-gray-800"
            >
              <ul class="flex flex-wrap gap-2">
                <li
                  v-for="att in msg.attachments"
                  :key="att.storagePath"
                  class="flex max-w-xs items-center gap-2 rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <span class="min-w-0 flex-1 truncate font-medium" :title="att.fileName">{{ att.fileName }}</span>
                  <span class="shrink-0 text-[#9B9A97]">{{ formatFileSize(att.fileSize) }}</span>
                </li>
              </ul>
            </div>

            <footer
              v-if="idx === thread.messages.length - 1"
              class="flex flex-wrap items-center gap-2 border-t border-[#F1F1EF] px-5 py-4 dark:border-gray-800"
            >
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-4 py-2 text-[13px] font-medium text-[#37352F] transition hover:bg-[#FAFAF8] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                @click="openDockedReply"
              >
                <ArrowUturnLeftIcon class="h-4 w-4" />
                {{ t('records.activityReply') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-[#EBEBEB] bg-white px-4 py-2 text-[13px] font-medium text-[#37352F] transition hover:bg-[#FAFAF8] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                @click="emit('forward', { row: threadRow, message: msg })"
              >
                <ArrowUturnRightIcon class="h-4 w-4" />
                {{ t('inbox.emailThreadReaderForward') }}
              </button>
            </footer>
          </article>
        </template>

        <div v-if="dockedReplyOpen" ref="dockedReplyRef" class="mt-4 scroll-mt-4">
          <EmailDockedReply
            :is-open="dockedReplyOpen"
            :standalone-mode="composeStandaloneMode"
            :related-to="composeRelatedTo"
            :initial-draft="replyInitialDraft"
            :sending-mailbox="composeSendingMailbox"
            :sending-mailbox-hint="composeSendingMailboxHint"
            :recipient-address="replyRecipientAddress"
            :sending="dockedReplySending"
            @close="closeDockedReply"
            @submit="onDockedSubmit"
            @pop-out="onDockedPopOut"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import apiClient from '@/utils/apiClient';
import { renderEmailMessageBody } from '@/utils/emailMessageBody';
import EmailDockedReply from '@/components/inbox/EmailDockedReply.vue';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EnvelopeOpenIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  threadId: { type: String, required: true },
  threadRow: { type: Object, default: null },
  recordPath: { type: String, default: '' },
  /** When true, hides back button (list remains visible beside reader). */
  splitView: { type: Boolean, default: false },
  /** Close control when splitView (panel docked beside list). */
  showClose: { type: Boolean, default: false },
  composeStandaloneMode: { type: Boolean, default: true },
  composeRelatedTo: { type: Object, default: null },
  composeSendingMailbox: { type: Object, default: null },
  composeSendingMailboxHint: { type: String, default: '' },
  /** Increment to open docked reply from parent (e.g. context panel). */
  dockedReplyPulse: { type: Number, default: 0 },
  /** Increment after successful send to close docked reply. */
  dockedReplyClosePulse: { type: Number, default: 0 },
  /** Increment to reload thread messages after send. */
  threadReloadPulse: { type: Number, default: 0 },
  /** Async send handler from inbox parent. */
  onSubmitCompose: { type: Function, default: null },
  canNavigatePrev: { type: Boolean, default: false },
  canNavigateNext: { type: Boolean, default: false }
});

const { t } = useI18n();

const emit = defineEmits([
  'close',
  'reply',
  'forward',
  'toggle-done',
  'toggle-read',
  'snooze',
  'assign-to-me',
  'open-record',
  'loaded',
  'submit-compose',
  'pop-out-compose',
  'navigate-prev',
  'navigate-next'
]);

const thread = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const actionLoading = ref(false);
const expandedIndex = ref(-1);
const dockedReplyOpen = ref(false);
const dockedReplySending = ref(false);
const dockedReplyRef = ref(null);

function resolveReplyToFromThread(row, messages) {
  const preset = String(row?.replyToAddress || '').trim();
  if (preset) return preset;

  const sorted = Array.isArray(messages) ? messages : [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const m = sorted[i];
    if (m?.direction === 'inbound' && m.fromAddress) {
      return String(m.fromAddress).trim();
    }
  }
  const last = sorted[sorted.length - 1];
  if (last?.direction === 'outbound' && Array.isArray(last.toAddresses) && last.toAddresses.length) {
    return String(last.toAddresses[0]).trim();
  }
  return '';
}

const replyRecipientAddress = computed(() => {
  return resolveReplyToFromThread(props.threadRow, thread.value?.messages);
});

const replyInitialDraft = computed(() => {
  const row = props.threadRow;
  if (!row) return null;
  const subj = String(row.subject || '').trim();
  const reSub = /^re:\s*/i.test(subj) ? subj : `Re: ${subj || '(no subject)'}`;
  const draft = {
    to: resolveReplyToFromThread(row, thread.value?.messages),
    subject: reSub,
    body: ''
  };
  if (row.anchorCommunicationId) {
    draft.parentCommunicationId = row.anchorCommunicationId;
  }
  return draft;
});

function openDockedReply() {
  dockedReplyOpen.value = true;
  nextTick(() => {
    dockedReplyRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function closeDockedReply() {
  dockedReplyOpen.value = false;
  dockedReplySending.value = false;
}

async function onDockedSubmit(payload) {
  dockedReplySending.value = true;
  try {
    if (typeof props.onSubmitCompose === 'function') {
      await props.onSubmitCompose(payload);
    } else {
      emit('submit-compose', payload);
    }
  } finally {
    dockedReplySending.value = false;
  }
}

function onDockedPopOut(draft) {
  emit('pop-out-compose', { row: props.threadRow, draft });
  closeDockedReply();
}

watch(() => props.dockedReplyPulse, (n, prev) => {
  if (n > 0 && n !== prev) openDockedReply();
});

watch(() => props.dockedReplyClosePulse, (n, prev) => {
  if (n > 0 && n !== prev) closeDockedReply();
});

watch(() => props.threadReloadPulse, (n, prev) => {
  if (n > 0 && n !== prev) void loadThread();
});

watch(() => props.threadId, (next, prev) => {
  closeDockedReply();
  expandedIndex.value = -1;
  if (next && next !== prev) {
    loadThread();
  }
});

const subject = computed(() => {
  if (thread.value?.subject) return thread.value.subject;
  if (props.threadRow?.subject) return props.threadRow.subject;
  return '(no subject)';
});

function isMessageCollapsed(idx, total) {
  if (total <= 1) return false;
  if (expandedIndex.value >= 0) return idx !== expandedIndex.value;
  return idx !== total - 1;
}

function messagePreview(msg) {
  const text = String(msg?.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 80) + (text.length > 80 ? '…' : '');
}

function formatReaderDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function loadThread() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const res = await apiClient.get(`/communications/threads/${encodeURIComponent(props.threadId)}/messages`);
    if (res?.success && res?.data) {
      thread.value = res.data;
      emit('loaded', res.data);
      markViewed();
    } else {
      errorMessage.value = res?.message || 'Could not load this thread.';
    }
  } catch (err) {
    errorMessage.value =
      err?.response?.data?.message || err?.message || 'Could not load this thread.';
  } finally {
    loading.value = false;
  }
}

async function markViewed() {
  try {
    await apiClient.patch(`/communications/threads/${encodeURIComponent(props.threadId)}/view`, {});
  } catch { /* ignore */ }
}

onMounted(() => {
  loadThread();
});

function senderName(msg) {
  const from = String(msg?.fromAddress || '').trim();
  if (!from) return msg?.direction === 'outbound' ? 'You' : 'Unknown sender';
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return m[1].trim();
  const local = from.split('@')[0] || from;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function senderEmail(msg) {
  const from = String(msg?.fromAddress || '').trim();
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

function recipientsDisplay(msg) {
  const to = Array.isArray(msg?.toAddresses) ? msg.toAddresses.filter(Boolean) : [];
  if (to.length === 0) return '';
  if (to.length === 1) return `to ${displayAddress(to[0])}`;
  return `to ${displayAddress(to[0])} and ${to.length - 1} more`;
}

function displayAddress(addr) {
  const s = String(addr || '').trim();
  const m = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  return m ? m[1].trim() : s;
}

function messageDate(msg) {
  return msg?.sentAt || msg?.receivedAt || msg?.createdAt || null;
}

function formatRelative(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (diffMs < 6 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function fileExt(fileName) {
  const m = String(fileName || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].slice(0, 4) : 'file';
}

function avatarInitial(msg) {
  const name = senderName(msg);
  const first = (name || '?').trim().charAt(0).toUpperCase();
  return first || '?';
}

function avatarColorClass(msg) {
  const email = senderEmail(msg) || senderName(msg) || '?';
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  const palette = [
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200'
  ];
  return palette[hash % palette.length];
}

</script>

<style scoped>
.email-body :deep(a) {
  color: rgb(96 73 231);
  text-decoration: underline;
}
.email-body :deep(p) { margin: 0 0 0.75rem; }
.email-body :deep(p:last-child) { margin-bottom: 0; }
.email-body :deep(blockquote) {
  margin: 0.75rem 0;
  padding-left: 0.75rem;
  border-left: 3px solid rgb(229 231 235);
  color: rgb(107 114 128);
}
.email-body :deep(pre),
.email-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: rgb(243 244 246);
  border-radius: 4px;
  padding: 0.1rem 0.3rem;
}
.email-body :deep(pre) { padding: 0.75rem; overflow-x: auto; }
.email-body :deep(img) { max-width: 100%; height: auto; }
.email-body :deep(table) { border-collapse: collapse; max-width: 100%; }
.email-body :deep(td),
.email-body :deep(th) {
  border: 1px solid rgb(229 231 235);
  padding: 0.25rem 0.5rem;
}
.dark .email-body :deep(a) { color: rgb(167 139 250); }
.dark .email-body :deep(blockquote) {
  border-left-color: rgb(75 85 99);
  color: rgb(156 163 175);
}
.dark .email-body :deep(pre),
.dark .email-body :deep(code) {
  background: rgb(31 41 55);
}
.dark .email-body :deep(td),
.dark .email-body :deep(th) {
  border-color: rgb(75 85 99);
}
</style>
