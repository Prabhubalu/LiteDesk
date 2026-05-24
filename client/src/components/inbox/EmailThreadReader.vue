<!--
  EmailThreadReader.vue

  Gmail-style full-replacement reader for a single inbox thread. Mounted by
  InboxSurface in place of the thread list when the user clicks a row.

  Responsibilities:
    - Fetch the thread's messages via /api/communications/threads/:threadId/messages
    - Render the Gmail-style chrome: top toolbar, subject + tags chip, message
      cards (avatar | sender | recipients | date | body | attachments), bottom
      action bar (Reply / Reply all / Forward).
    - Mark the thread viewed once on mount (PATCH /threads/:threadId/view).
    - Emit semantic events (close / reply / forward / done / snooze /
      assign-to-me / open-record) so the parent owns global state (compose
      drawer, list refresh, route sync). The reader holds no global state.
-->
<template>
  <div class="flex h-full min-h-[60vh] flex-col bg-white dark:bg-gray-900">
    <!-- Top toolbar (Back · Archive · Snooze · Assign · More) -->
    <div
      class="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700"
    >
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="t('inbox.emailThreadReaderBackToInbox2')"
        :aria-label="t('inbox.emailThreadReaderBackToInbox')"
        @click="emit('close')"
      >
        <ArrowLeftIcon class="h-5 w-5" />
      </button>
      <div class="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="threadRow?.done ? 'Reopen thread' : 'Archive (mark done)'"
        :aria-label="threadRow?.done ? 'Reopen thread' : 'Mark thread done'"
        :disabled="actionLoading"
        @click="emit('toggle-done', threadRow)"
      >
        <ArchiveBoxIcon class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="t('inbox.emailThreadReaderSnoozeToTomorrow2')"
        :aria-label="t('inbox.emailThreadReaderSnoozeToTomorrow')"
        :disabled="actionLoading"
        @click="emit('snooze', threadRow)"
      >
        <ClockIcon class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="t('common.formAssignToMe')"
        :aria-label="t('common.formAssignToMe')"
        :disabled="actionLoading"
        @click="emit('assign-to-me', threadRow)"
      >
        <UserPlusIcon class="h-5 w-5" />
      </button>

      <button
        v-if="recordPath"
        type="button"
        class="ml-2 hidden items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 sm:inline-flex"
        :title="`Open ${recordKindLabel} record`"
        @click="emit('open-record', threadRow)"
      >
        <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        Go to {{ recordKindLabel }}
      </button>

      <div class="ml-auto flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span v-if="!loading && thread">{{ thread.messageCount }} message{{ thread.messageCount === 1 ? '' : 's' }}</span>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          :title="t('inbox.emailThreadReaderReloadThread2')"
          :aria-label="t('inbox.emailThreadReaderReloadThread')"
          :disabled="loading"
          @click="loadThread"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Subject + tags -->
    <div class="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3 sm:px-8">
      <h2 class="min-w-0 break-words text-xl font-normal text-gray-900 dark:text-white sm:text-2xl">
        {{ subject }}
      </h2>
      <template v-if="threadRow?.tags && threadRow.tags.length > 0">
        <span
          v-for="tag in threadRow.tags"
          :key="tag"
          class="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {{ tag }}
        </span>
      </template>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-3 pb-6 sm:px-6">
      <div
        v-if="loading"
        class="flex items-center justify-center py-16"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>

      <div
        v-else-if="errorMessage"
        class="mx-auto mt-6 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200"
      >
        {{ errorMessage }}
      </div>

      <div v-else-if="thread" class="mx-auto max-w-3xl space-y-3">
        <article
          v-for="(msg, idx) in thread.messages"
          :key="String(msg._id)"
          class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <header class="flex items-start gap-3 px-4 pt-4 sm:px-5">
            <span
              class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase ring-1 ring-gray-200/80 dark:ring-gray-600"
              :class="avatarColorClass(msg)"
            >
              {{ avatarInitial(msg) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2">
                <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ senderName(msg) }}
                </span>
                <span class="truncate text-xs text-gray-500 dark:text-gray-400">
                  &lt;{{ senderEmail(msg) }}&gt;
                </span>
              </div>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ recipientsDisplay(msg) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <time
                class="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400"
                :title="formatFullDate(messageDate(msg))"
              >
                {{ formatRelative(messageDate(msg)) }}
              </time>
              <span
                v-if="msg.direction === 'outbound'"
                class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >{{ t('inbox.emailThreadReaderSent') }}</span>
            </div>
          </header>

          <div
            class="email-body px-4 pb-4 pt-3 text-sm text-gray-800 dark:text-gray-200 sm:px-5 sm:text-[15px]"
            v-html="renderMessageBody(msg.body)"
          />

          <div
            v-if="msg.attachments && msg.attachments.length > 0"
            class="border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5"
          >
            <p class="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ msg.attachments.length }} attachment{{ msg.attachments.length === 1 ? '' : 's' }}
            </p>
            <ul class="flex flex-wrap gap-2">
              <li
                v-for="att in msg.attachments"
                :key="att.storagePath"
                class="flex max-w-xs items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
              >
                <PaperClipIcon class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                <span class="min-w-0 flex-1 truncate" :title="att.fileName">{{ att.fileName }}</span>
                <span class="shrink-0 text-gray-400">{{ formatFileSize(att.fileSize) }}</span>
              </li>
            </ul>
          </div>

          <!-- Bottom action bar — only on the last message, like Gmail -->
          <footer
            v-if="idx === thread.messages.length - 1"
            class="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              @click="emit('reply', threadRow)"
            >
              <ArrowUturnLeftIcon class="h-4 w-4" />{{ t('records.activityReply') }}</button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              @click="emit('forward', { row: threadRow, message: msg })"
            >
              <ArrowUturnRightIcon class="h-4 w-4" />{{ t('inbox.emailThreadReaderForward') }}</button>
          </footer>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  PaperClipIcon,
  UserPlusIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  threadId: { type: String, required: true },
  /** Summary row from the inbox list — used for header info while messages load. */
  threadRow: { type: Object, default: null },
  /** Optional record-path string ("/people/123") to enable the "Go to record" link. */
  recordPath: { type: String, default: '' }
});

const { t } = useI18n();

const emit = defineEmits([
  'close',
  'reply',
  'forward',
  'toggle-done',
  'snooze',
  'assign-to-me',
  'open-record',
  'loaded'
]);

const thread = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const actionLoading = ref(false);

const subject = computed(() => {
  if (thread.value?.subject) return thread.value.subject;
  if (props.threadRow?.subject) return props.threadRow.subject;
  return '(no subject)';
});

const recordKindLabel = computed(() => {
  const mk = props.threadRow?.relatedTo?.moduleKey || thread.value?.relatedTo?.moduleKey;
  if (!mk) return 'record';
  const m = String(mk).toLowerCase();
  if (m === 'people') return 'person';
  if (m === 'organizations') return 'organization';
  if (m === 'deals') return 'deal';
  if (m === 'tasks') return 'task';
  if (m === 'cases') return 'case';
  return m;
});

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
  // Fire-and-forget: marking a thread viewed is an optimization, not blocking.
  try {
    await apiClient.patch(`/communications/threads/${encodeURIComponent(props.threadId)}/view`, {});
  } catch { /* ignore */ }
}

watch(() => props.threadId, (next, prev) => {
  if (next && next !== prev) loadThread();
});

onMounted(() => {
  loadThread();
});

// ---------- Rendering helpers ----------

function senderName(msg) {
  const from = String(msg?.fromAddress || '').trim();
  if (!from) return msg?.direction === 'outbound' ? 'You' : 'Unknown sender';
  // "Display Name <user@host>" form
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return m[1].trim();
  // Bare "user@host" — derive a name from the local part
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

function avatarInitial(msg) {
  const name = senderName(msg);
  const first = (name || '?').trim().charAt(0).toUpperCase();
  return first || '?';
}

function avatarColorClass(msg) {
  // Stable color per sender email — keeps each thread participant the same hue
  // across messages without needing a server-side mapping.
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

// HTML rendering with the same sanitization rules as
// `client/src/components/communications/EmailThreadCard.vue`. Inlined here to
// keep this component self-contained — if the rules need to evolve later,
// extract `sanitizeHtml` into `client/src/utils/emailHtml.js` and import from
// both places.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(html) {
  const raw = String(html || '');
  if (!raw.trim()) return '<p class="text-gray-400">(no content)</p>';
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML || '<p class="text-gray-400">(no content)</p>';
}

function renderMessageBody(body) {
  const raw = String(body || '').trim();
  if (!raw) return '<p class="text-gray-400">(no content)</p>';
  if (/<[^>]+>/.test(raw)) return sanitizeHtml(raw);
  return `<p>${escapeHtml(raw).replace(/\n/g, '<br>')}</p>`;
}
</script>

<style scoped>
/*
  Style hooks for the rendered HTML body. Tailwind's `prose` would also work
  but pulls in @tailwindcss/typography and overrides too much for short emails.
  Keep this minimal and readable.
*/
.email-body :deep(a) {
  color: rgb(37 99 235);
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
.dark .email-body :deep(a) { color: rgb(96 165 250); }
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
