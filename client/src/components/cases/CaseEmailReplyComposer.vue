<template>
  <div
    :class="[
      'case-email-reply-composer border-t border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/40',
      fillHeight ? 'flex h-full min-h-0 flex-col' : 'shrink-0'
    ]"
  >
    <div class="flex shrink-0 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-900">
      <button
        v-for="tab in composeTabs"
        :key="tab.id"
        type="button"
        class="border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
        :class="
          composeTab === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        "
        :disabled="disabled || sending"
        @click="setComposeTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Internal comment -->
    <div
      v-if="composeTab === 'internal'"
      :class="[
        'mx-3 my-2 flex flex-col',
        fillHeight ? 'min-h-0 flex-1' : ''
      ]"
    >
      <CommentInput
        ref="internalCommentInputRef"
        v-model="internalCommentDraft"
        variant="activity"
        :show-submit="false"
        :allow-attachments="false"
        :disabled="disabled || sending"
        :placeholder="t('cases.recordInternalCommentPlaceholder')"
        :class="fillHeight ? 'flex min-h-0 flex-1 flex-col' : ''"
      />
      <div class="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <CaseCannedResponseMenu
          :items="internalCannedResponses"
          :loading="internalCannedLoading"
          :disabled="disabled || sending"
          active-channel="internal"
          @open="loadInternalCannedResponses"
          @select="applyInternalCannedResponse"
        />
        <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          v-if="isClosed"
          type="button"
          class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="$emit('reopen')"
        >
          {{ t('cases.recordReopen') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="disabled || sending || !canSubmitInternalComment"
          @click="submitInternal"
        >
          <span v-if="sending" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {{ t('cases.recordSend') }}
        </button>
        </div>
      </div>
    </div>

    <!-- Customer email reply -->
    <div
      v-else
      :class="[
        'mx-3 my-2 flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900',
        fillHeight ? 'flex-1' : ''
      ]"
    >
      <p
        v-if="error"
        class="shrink-0 border-b border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
      >
        {{ error }}
      </p>

      <!-- Collapsible compact headers -->
      <div class="shrink-0 border-b border-gray-200 dark:border-gray-600">
        <button
          type="button"
          class="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-gray-100/80 dark:hover:bg-gray-700/40"
          :aria-expanded="headersExpanded"
          :title="headersExpanded ? t('cases.recordEmailComposerHeadersToggleHide') : t('cases.recordEmailComposerHeadersToggle')"
          @click="headersExpanded = !headersExpanded"
        >
          <ChevronRightIcon
            class="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform"
            :class="{ 'rotate-90': headersExpanded }"
          />
          <span class="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-500 dark:text-gray-400">{{ t('cases.recordEmailComposerHeadersSummaryTo') }}:</span>
            {{ headerSummaryTo }}
            <span class="mx-1 text-gray-300 dark:text-gray-600">·</span>
            <span class="font-medium text-gray-500 dark:text-gray-400">{{ t('cases.recordEmailComposerHeadersSummarySubject') }}:</span>
            {{ headerSummarySubject }}
          </span>
          <span
            v-if="hasCcOrBcc"
            class="shrink-0 rounded bg-gray-200/80 px-1 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            {{ ccBccBadge }}
          </span>
        </button>

        <div
          v-show="headersExpanded"
          class="space-y-1 border-t border-gray-200/80 px-2 py-1.5 dark:border-gray-600/80"
        >
          <div class="flex items-center gap-1.5 text-xs">
            <span class="w-10 shrink-0 text-right font-medium text-gray-500 dark:text-gray-400">
              {{ t('cases.recordEmailComposerFrom') }}
            </span>
            <span
              class="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-600 dark:text-gray-300"
              :title="fromDisplayLine"
            >
              {{ fromDisplayLine || (composePreviewLoading ? '…' : '—') }}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="w-10 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">To</span>
            <input
              v-model="form.to"
              type="text"
              :disabled="disabled || sending"
              class="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :placeholder="t('cases.recordEmailComposerToPlaceholder')"
            />
            <button
              type="button"
              class="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              :class="showCc ? 'text-indigo-600 dark:text-indigo-400' : ''"
              @click="showCc = !showCc"
            >
              Cc
            </button>
            <button
              type="button"
              class="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              :class="showBcc ? 'text-indigo-600 dark:text-indigo-400' : ''"
              @click="showBcc = !showBcc"
            >
              Bcc
            </button>
          </div>

          <div v-if="showCc" class="flex items-center gap-1.5">
            <span class="w-10 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cc</span>
            <input
              v-model="form.cc"
              type="text"
              :disabled="disabled || sending"
              class="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div v-if="showBcc" class="flex items-center gap-1.5">
            <span class="w-10 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Bcc</span>
            <input
              v-model="form.bcc"
              type="text"
              :disabled="disabled || sending"
              class="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <span class="w-10 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('cases.recordEmailComposerSubject') }}
            </span>
            <input
              v-model="form.subject"
              type="text"
              required
              :disabled="disabled || sending"
              class="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <!-- Body (maximized) -->
      <div
        :class="[
          'min-h-0 flex-1 overflow-hidden px-1.5 py-1',
          fillHeight ? 'flex flex-col' : ''
        ]"
      >
        <TaskDescriptionEditor
          v-if="showRichEditor"
          :key="richEditorKey"
          v-model="form.body"
          :placeholder="t('cases.recordEmailComposerBodyPlaceholder')"
          class="h-full min-h-[120px] [&_.tiptap]:min-h-[120px] [&_.tiptap]:px-3 [&_.tiptap]:py-2"
        />
      </div>

      <!-- Footer toolbar -->
      <div class="shrink-0 border-t border-gray-200 px-2 py-2 dark:border-gray-600">
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          multiple
          @change="handleFileSelect"
        />
        <div class="flex flex-wrap items-center gap-1">
          <CaseCannedResponseMenu
            :items="emailCannedResponses"
            :loading="emailCannedLoading"
            :disabled="disabled || sending"
            active-channel="email"
            @open="loadEmailCannedResponses"
            @select="applyEmailCannedResponse"
          />
          <button
            type="button"
            class="rounded p-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('cases.recordEmailComposerBodyPlaceholder')"
          >
            A
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :disabled="disabled || sending || uploading"
            :title="t('cases.recordEmailComposerAttach')"
            @click="fileInputRef?.click()"
          >
            <PaperClipIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            disabled
            aria-hidden="true"
          >
            <LinkIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            disabled
            aria-hidden="true"
          >
            <FaceSmileIcon class="h-4 w-4" />
          </button>
          <span
            v-for="(att, idx) in attachments"
            :key="idx"
            class="inline-flex max-w-[10rem] items-center gap-1 truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <span class="truncate">{{ att.fileName }}</span>
            <button type="button" class="shrink-0 text-gray-500 hover:text-red-600" @click="removeAttachment(idx)">
              ×
            </button>
          </span>
          <div class="ml-auto flex items-center gap-2">
            <button
              v-if="isClosed"
              type="button"
              class="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="$emit('reopen')"
            >
              {{ t('cases.recordReopen') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 opacity-60 dark:border-gray-600 dark:text-gray-300"
              disabled
            >
              <SparklesIcon class="h-3.5 w-3.5" />
              {{ t('cases.recordEmailComposerAiDraft') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="disabled || sending || !canSendEmail"
              @click="submitEmail"
            >
              <span
                v-if="sending"
                class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
              />
              {{ t('cases.recordSend') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronRightIcon,
  FaceSmileIcon,
  LinkIcon,
  PaperClipIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import CommentInput from '@/components/record-page/CommentInput.vue';
import CaseCannedResponseMenu from '@/components/cases/CaseCannedResponseMenu.vue';
import { useEmailComposeForm } from '@/composables/useEmailComposeForm';
import { useCaseCannedResponses } from '@/composables/useCaseCannedResponses';
import {
  buildCaseCannedResponseContext,
  resolveCannedResponse
} from '@/utils/caseCannedResponses';
import { useAuthStore } from '@/stores/authRegistry';
import {
  buildCaseEmailReplyDraft,
  buildCaseEmailReplyFromMessage,
  htmlBodyHasText,
  resolveCaseReplyToEmail
} from '@/utils/caseEmailReply';

const props = defineProps({
  caseId: { type: String, required: true },
  caseRecord: { type: Object, default: null },
  contactEmail: { type: String, default: '' },
  emailThreads: { type: Array, default: () => [] },
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  showInternalToggle: { type: Boolean, default: true },
  fillHeight: { type: Boolean, default: false }
});

const emit = defineEmits(['send-email', 'send', 'reopen']);

const { t } = useI18n();
const authStore = useAuthStore();

const {
  responses: emailCannedResponses,
  loading: emailCannedLoading,
  load: fetchEmailCannedResponses
} = useCaseCannedResponses();

const {
  responses: internalCannedResponses,
  loading: internalCannedLoading,
  load: fetchInternalCannedResponses
} = useCaseCannedResponses();

function loadEmailCannedResponses() {
  return fetchEmailCannedResponses('email', { includeAll: true });
}

function loadInternalCannedResponses() {
  return fetchInternalCannedResponses('internal', { includeAll: true });
}

const composeTab = ref('reply');
const internalCommentDraft = ref('');
const internalCommentInputRef = ref(null);
const headersExpanded = ref(false);

const composeTabs = computed(() => {
  const tabs = [
    { id: 'reply', label: t('cases.recordEmailComposerTabReply') },
    { id: 'replyAll', label: t('cases.recordEmailComposerTabReplyAll') },
    { id: 'forward', label: t('cases.recordEmailComposerTabForward') }
  ];
  if (props.showInternalToggle) {
    tabs.push({ id: 'internal', label: t('cases.recordEmailComposerTabInternalComment') });
  }
  return tabs;
});

const internalNote = computed(() => composeTab.value === 'internal');
const showRichEditor = ref(false);
const richEditorKey = computed(() => `case-email-editor-${props.caseId || 'none'}`);

function buildBridgeState() {
  return {
    isOpen: true,
    alwaysActive: true,
    standaloneMode: false,
    relatedTo: { moduleKey: 'cases', recordId: String(props.caseId || '') },
    initialTo: props.contactEmail || '',
    initialDraft: buildCaseEmailReplyDraft({
      caseRecord: props.caseRecord,
      contactEmail: props.contactEmail,
      emailThreads: props.emailThreads
    })
  };
}

const composeBridge = reactive(buildBridgeState());

function syncComposeBridgeDraft() {
  const next = buildBridgeState();
  composeBridge.relatedTo = next.relatedTo;
  composeBridge.initialTo = next.initialTo;
  composeBridge.initialDraft = next.initialDraft;
}

function remountRichEditor() {
  showRichEditor.value = false;
  nextTick(() => {
    showRichEditor.value = composeTab.value !== 'internal';
  });
}

function setComposeTab(id) {
  composeTab.value = id;
  if (id === 'internal') {
    error.value = null;
    showRichEditor.value = false;
    return;
  }
  if (id === 'forward') {
    headersExpanded.value = true;
    const subj = String(form.value.subject || '').trim();
    if (subj && !/^fwd:\s*/i.test(subj)) {
      form.value.subject = `Fwd: ${subj.replace(/^re:\s*/i, '')}`;
    }
    form.value.to = '';
    composeBridge.initialDraft = {
      ...(composeBridge.initialDraft || {}),
      parentCommunicationId: null
    };
  } else if (id === 'replyAll') {
    headersExpanded.value = true;
    showCc.value = true;
  }
  remountRichEditor();
}

function applyDraftFields(draft) {
  if (!draft) return;
  if (draft.to !== undefined) form.value.to = draft.to;
  if (draft.cc !== undefined) {
    form.value.cc = draft.cc;
    if (String(draft.cc || '').trim()) showCc.value = true;
  }
  if (draft.bcc !== undefined) {
    form.value.bcc = draft.bcc;
    if (String(draft.bcc || '').trim()) showBcc.value = true;
  }
  if (draft.subject !== undefined) form.value.subject = draft.subject;
  if (draft.body !== undefined) form.value.body = draft.body;
  composeBridge.initialDraft = {
    ...(composeBridge.initialDraft || {}),
    ...draft
  };
}

function applyReplyTarget(message, { replyAll = false, forward = false } = {}) {
  if (!message) return;
  composeTab.value = forward ? 'forward' : replyAll ? 'replyAll' : 'reply';
  const draft = buildCaseEmailReplyFromMessage(message, {
    caseRecord: props.caseRecord,
    contactEmail: props.contactEmail,
    emailThreads: props.emailThreads,
    replyAll,
    forward
  });
  applyDraftFields(draft);
  headersExpanded.value = forward || replyAll || Boolean(String(draft.cc || '').trim());
  remountRichEditor();
}

watch(
  () => props.caseId,
  (id) => {
    if (!id) {
      showRichEditor.value = false;
      return;
    }
    headersExpanded.value = false;
    syncComposeBridgeDraft();
    remountRichEditor();
  },
  { immediate: true }
);

function forwardComposeEmit(event, payload) {
  if (event === 'submit') {
    emit('send-email', payload);
  }
}

const {
  form,
  showCc,
  showBcc,
  error,
  attachments,
  uploading,
  fileInputRef,
  fromDisplayLine,
  composePreviewLoading,
  toRecipients,
  handleFileSelect,
  removeAttachment,
  handleSend,
  clearAfterSend
} = useEmailComposeForm(composeBridge, forwardComposeEmit);

const resolvedToEmail = computed(() =>
  resolveCaseReplyToEmail({
    caseRecord: props.caseRecord,
    contactEmail: props.contactEmail,
    emailThreads: props.emailThreads
  })
);

function applyResolvedToEmail({ force = false } = {}) {
  const addr = resolvedToEmail.value;
  if (!addr) return;
  const current = String(form.value.to || '').trim();
  if (!force && current) return;
  form.value.to = addr;
  composeBridge.initialTo = addr;
  if (composeBridge.initialDraft) {
    composeBridge.initialDraft = { ...composeBridge.initialDraft, to: addr };
  }
}

watch(
  () => props.emailThreads?.length,
  () => {
    if (!props.caseId) return;
    const draft = buildCaseEmailReplyDraft({
      caseRecord: props.caseRecord,
      contactEmail: props.contactEmail,
      emailThreads: props.emailThreads
    });
    composeBridge.initialDraft = {
      ...(composeBridge.initialDraft || {}),
      ...(draft.parentCommunicationId ? { parentCommunicationId: draft.parentCommunicationId } : {}),
      subject: draft.subject,
      to: draft.to
    };
    if (draft.subject) form.value.subject = draft.subject;
    applyResolvedToEmail();
  }
);

watch(resolvedToEmail, (addr, prev) => {
  if (!addr || addr === prev) return;
  applyResolvedToEmail();
});

watch(
  () => props.caseId,
  (id) => {
    if (!id) return;
    nextTick(() => applyResolvedToEmail({ force: true }));
  }
);

nextTick(() => {
  if (props.caseId) applyResolvedToEmail({ force: true });
});

const headerSummaryTo = computed(() => {
  const raw = String(form.value.to || resolvedToEmail.value || '').trim();
  return raw || '—';
});

const headerSummarySubject = computed(() => {
  const raw = String(form.value.subject || '').trim();
  return raw || '—';
});

const hasCcOrBcc = computed(
  () => Boolean(String(form.value.cc || '').trim()) || Boolean(String(form.value.bcc || '').trim())
);

const ccBccBadge = computed(() => {
  const parts = [];
  if (String(form.value.cc || '').trim()) parts.push('Cc');
  if (String(form.value.bcc || '').trim()) parts.push('Bcc');
  return parts.join('+');
});

watch([showCc, showBcc], () => {
  if (showCc.value || showBcc.value) headersExpanded.value = true;
});

const canSendEmail = computed(
  () =>
    toRecipients.value.length > 0 &&
    String(form.value.subject || '').trim().length > 0 &&
    htmlBodyHasText(form.value.body)
);

function submitEmail() {
  if (!canSendEmail.value) return;
  handleSend();
}

const canSubmitInternalComment = computed(() =>
  Boolean(String(internalCommentDraft.value || '').trim())
);

const cannedContext = computed(() =>
  buildCaseCannedResponseContext({
    caseRecord: props.caseRecord,
    agentUser: authStore.user,
    contactEmail: props.contactEmail
  })
);

function applyEmailCannedResponse(item) {
  const resolved = resolveCannedResponse(item, cannedContext.value);
  if (resolved.subject) form.value.subject = resolved.subject;
  if (resolved.body) form.value.body = resolved.body;
}

function applyInternalCannedResponse(item) {
  const resolved = resolveCannedResponse(item, cannedContext.value);
  const plain = String(resolved.body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  internalCommentDraft.value = plain;
}

function submitInternal() {
  const payload = internalCommentInputRef.value?.getSubmitPayload?.();
  const message = String(payload?.content || internalCommentDraft.value || '').trim();
  if (!message) return;
  emit('send', {
    message,
    channel: 'Email',
    internal: true
  });
  internalCommentDraft.value = '';
}

defineExpose({
  applyReplyTarget,
  clear: () => {
    clearAfterSend();
    internalCommentDraft.value = '';
    composeTab.value = 'reply';
    headersExpanded.value = false;
  }
});
</script>
