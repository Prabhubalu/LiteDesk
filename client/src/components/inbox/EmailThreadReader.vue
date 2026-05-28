<!--
  EmailThreadReader.vue — conversation detail for inbox threads.
  Supports split-pane (list stays visible) and full-width mobile layouts.
-->
<template>
  <div class="flex h-full min-h-0 max-h-full flex-col overflow-hidden bg-white dark:bg-gray-900">
    <!-- Top toolbar -->
    <div
      class="flex flex-wrap items-center gap-1 border-b border-neutral-200/90 bg-neutral-50/50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/40"
    >
      <button
        v-if="!splitView"
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="t('inbox.emailThreadReaderBackToInbox2')"
        :aria-label="t('inbox.emailThreadReaderBackToInbox')"
        @click="emit('close')"
      >
        <ArrowLeftIcon class="h-5 w-5" />
      </button>
      <div
        v-if="!splitView"
        class="mx-1 h-6 w-px bg-neutral-200 dark:bg-gray-700"
        aria-hidden="true"
      />
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="threadRow?.done ? t('inbox.inboxSurfaceReopen') : t('inbox.inboxSurfaceMarkDone')"
        :aria-label="threadRow?.done ? t('inbox.inboxSurfaceReopen') : t('inbox.inboxSurfaceMarkDone')"
        :disabled="actionLoading"
        @click="emit('toggle-done', threadRow)"
      >
        <ArchiveBoxIcon class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
        :title="t('inbox.emailThreadReaderSnoozeToTomorrow2')"
        :aria-label="t('inbox.emailThreadReaderSnoozeToTomorrow')"
        :disabled="actionLoading"
        @click="emit('snooze', threadRow)"
      >
        <ClockIcon class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
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
        class="ml-1 hidden items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 sm:inline-flex"
        @click="emit('open-record', threadRow)"
      >
        <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        {{ t('inbox.inboxContextPanelOpenRecord') }}
      </button>

      <div class="ml-auto flex items-center gap-1 text-xs text-neutral-500 dark:text-gray-400">
        <span v-if="!loading && thread">
          {{ thread.messageCount }}
          {{ thread.messageCount === 1 ? t('inbox.inboxProMessage') : t('inbox.inboxProMessages') }}
        </span>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          :title="t('inbox.emailThreadReaderReloadThread2')"
          :aria-label="t('inbox.emailThreadReaderReloadThread')"
          :disabled="loading"
          @click="loadThread"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Subject + participants -->
    <div class="border-b border-neutral-100 px-5 py-4 dark:border-gray-800 sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h2 class="break-words text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
            {{ subject }}
          </h2>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <div class="flex -space-x-2">
              <span
                v-for="(p, i) in participantAvatars"
                :key="i"
                class="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold uppercase ring-2 ring-white dark:ring-gray-900"
                :class="p.colorClass"
              >
                {{ p.initial }}
              </span>
            </div>
            <span class="text-sm text-neutral-600 dark:text-gray-400">
              {{ participantLine }}
            </span>
          </div>
          <div v-if="threadRow?.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="tag in threadRow.tags"
              :key="tag"
              class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
              :class="tagPillClass(tag)"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500"
            @click="openDockedReply"
          >
            <ArrowUturnLeftIcon class="h-4 w-4" />
            {{ t('records.activityReply') }}
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            :title="t('inbox.emailThreadReaderSnoozeToTomorrow2')"
            @click="emit('snooze', threadRow)"
          >
            <ClockIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable thread body -->
    <div class="arivu-scrollbar flex-1 overflow-y-auto">
      <div
        v-if="loading"
        class="flex items-center justify-center py-16"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600 dark:border-gray-700 dark:border-t-primary-400" />
      </div>

      <div
        v-else-if="errorMessage"
        class="mx-4 mt-6 max-w-2xl rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900 dark:border-warning-900/30 dark:bg-warning-950/30 dark:text-warning-200 sm:mx-6"
      >
        {{ errorMessage }}
      </div>

      <div v-else-if="thread" class="px-4 py-4 sm:px-6 sm:py-5">
        <!-- AI Summary -->
        <div
          class="mb-5 rounded-xl border border-primary-200/80 bg-gradient-to-br from-primary-50 to-white p-4 dark:border-primary-900/50 dark:from-primary-950/40 dark:to-gray-900"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <SparklesIcon class="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span class="text-sm font-semibold text-primary-900 dark:text-primary-100">
                {{ t('inbox.inboxProAiSummary') }}
              </span>
              <span class="rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
                {{ t('inbox.inboxContextPanelBeta') }}
              </span>
            </div>
            <button
              type="button"
              class="rounded-lg border border-primary-200 bg-white px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:bg-gray-900 dark:text-primary-300 dark:hover:bg-primary-950/50"
              @click="onGenerateBrief"
            >
              {{ t('inbox.inboxProGenerateBrief') }}
            </button>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-gray-300">
            {{ aiSummaryText }}
          </p>
        </div>

        <!-- Messages -->
        <div class="space-y-4">
          <article
            v-for="(msg, idx) in thread.messages"
            :key="String(msg._id)"
            class="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <header class="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 dark:border-gray-800 sm:px-5">
              <span
                class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase ring-1 ring-neutral-200/80 dark:ring-gray-600"
                :class="avatarColorClass(msg)"
              >
                {{ avatarInitial(msg) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                    {{ senderName(msg) }}
                  </span>
                  <span class="truncate text-xs text-neutral-500 dark:text-gray-400">
                    &lt;{{ senderEmail(msg) }}&gt;
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-neutral-500 dark:text-gray-400">
                  {{ recipientsDisplay(msg) }}
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <time
                  class="whitespace-nowrap text-xs text-neutral-500 dark:text-gray-400"
                  :title="formatFullDate(messageDate(msg))"
                >
                  {{ formatRelative(messageDate(msg)) }}
                </time>
                <span
                  v-if="msg.direction === 'outbound'"
                  class="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200"
                >
                  {{ t('inbox.emailThreadReaderSent') }}
                </span>
              </div>
            </header>

            <div
              class="email-body px-4 py-4 text-sm leading-relaxed text-neutral-800 dark:text-gray-200 sm:px-5 sm:text-[15px]"
              v-html="renderEmailMessageBody(msg.body)"
            />

            <div
              v-if="msg.attachments && msg.attachments.length > 0"
              class="border-t border-neutral-100 px-4 py-3 dark:border-gray-800 sm:px-5"
            >
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-gray-400">
                {{ msg.attachments.length }}
                {{ msg.attachments.length === 1 ? t('inbox.inboxProAttachment') : t('inbox.inboxProAttachments') }}
              </p>
              <ul class="flex flex-wrap gap-2">
                <li
                  v-for="att in msg.attachments"
                  :key="att.storagePath"
                  class="flex max-w-xs items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold uppercase text-neutral-600 ring-1 ring-neutral-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-600">
                    {{ fileExt(att.fileName) }}
                  </span>
                  <span class="min-w-0 flex-1 truncate font-medium" :title="att.fileName">{{ att.fileName }}</span>
                  <span class="shrink-0 text-neutral-400">{{ formatFileSize(att.fileSize) }}</span>
                </li>
              </ul>
            </div>

            <footer
              v-if="idx === thread.messages.length - 1"
              class="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50/50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/30 sm:px-5"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                @click="openDockedReply"
              >
                <ArrowUturnLeftIcon class="h-4 w-4" />
                {{ t('records.activityReply') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                @click="emit('forward', { row: threadRow, message: msg })"
              >
                <ArrowUturnRightIcon class="h-4 w-4" />
                {{ t('inbox.emailThreadReaderForward') }}
              </button>
            </footer>
          </article>
        </div>

        <!-- Gmail-style docked reply (inline below thread) -->
        <div
          v-if="dockedReplyOpen"
          ref="dockedReplyRef"
          class="mt-4 scroll-mt-4"
        >
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

    <!-- Quick reply bar (collapsed until opened) -->
    <div
      v-if="thread && !loading && !dockedReplyOpen"
      class="border-t border-neutral-200 bg-neutral-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 sm:px-6"
    >
      <button
        type="button"
        class="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-500 shadow-sm hover:border-primary-300 hover:ring-1 hover:ring-primary-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-primary-700"
        @click="openDockedReply"
      >
        {{ t('inbox.inboxProClickToReply') }}
      </button>
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
  ClockIcon,
  SparklesIcon,
  UserPlusIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  threadId: { type: String, required: true },
  threadRow: { type: Object, default: null },
  recordPath: { type: String, default: '' },
  /** When true, hides back button (list remains visible beside reader). */
  splitView: { type: Boolean, default: false },
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
  onSubmitCompose: { type: Function, default: null }
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
  'loaded',
  'submit-compose',
  'pop-out-compose'
]);

const thread = ref(null);
const loading = ref(true);
const errorMessage = ref('');
const actionLoading = ref(false);
const briefGenerated = ref(false);
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

watch(() => props.threadId, () => {
  closeDockedReply();
});

const subject = computed(() => {
  if (thread.value?.subject) return thread.value.subject;
  if (props.threadRow?.subject) return props.threadRow.subject;
  return '(no subject)';
});

const participantLine = computed(() => {
  const p = String(props.threadRow?.participantDisplay || '').trim();
  if (p) return p;
  if (thread.value?.messages?.length) {
    const names = [...new Set(thread.value.messages.map((m) => senderName(m)))].slice(0, 3);
    return names.join(', ');
  }
  return '';
});

const participantAvatars = computed(() => {
  const names = [];
  const p = String(props.threadRow?.participantDisplay || '').trim();
  if (p) {
    p.split(/\s*↔\s*/).forEach((part) => {
      const n = part.trim();
      if (n && !/^you$/i.test(n)) names.push(n);
    });
  }
  if (!names.length && thread.value?.messages) {
    thread.value.messages.forEach((m) => {
      const n = senderName(m);
      if (n && !names.includes(n)) names.push(n);
    });
  }
  return names.slice(0, 4).map((name, i) => ({
    initial: (name.charAt(0) || '?').toUpperCase(),
    colorClass: [
      'bg-primary-100 text-primary-800',
      'bg-violet-100 text-violet-800',
      'bg-emerald-100 text-emerald-800',
      'bg-amber-100 text-amber-800'
    ][i % 4]
  }));
});

const aiSummaryText = computed(() => {
  if (briefGenerated.value && thread.value?.messages?.length) {
    const count = thread.value.messageCount;
    const last = thread.value.messages[thread.value.messages.length - 1];
    const preview = String(last?.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    return preview
      ? t('inbox.inboxProAiSummaryGenerated', { count, preview })
      : t('inbox.inboxProAiSummaryGeneratedShort', { count });
  }
  return t('inbox.inboxProAiSummaryPlaceholder');
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

function onGenerateBrief() {
  briefGenerated.value = true;
}

async function markViewed() {
  try {
    await apiClient.patch(`/communications/threads/${encodeURIComponent(props.threadId)}/view`, {});
  } catch { /* ignore */ }
}

watch(() => props.threadId, (next, prev) => {
  if (next && next !== prev) {
    briefGenerated.value = false;
    loadThread();
  }
});

onMounted(() => {
  loadThread();
});

function tagPillClass(tag) {
  const t = String(tag || '').toLowerCase();
  if (t.includes('todo') || t.includes('to-do')) {
    return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200';
  }
  if (t.includes('newsletter')) {
    return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-200';
  }
  if (t.includes('reminder')) {
    return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-200';
  }
  return 'bg-neutral-100 text-neutral-700 dark:bg-gray-800 dark:text-gray-300';
}

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
