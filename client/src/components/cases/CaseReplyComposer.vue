<template>
  <div
    :class="[
      'case-reply-composer bg-white px-3 py-2 dark:bg-gray-900 sm:px-4',
      fillHeight ? 'flex h-full min-h-0 flex-col' : 'shrink-0 border-t border-gray-200 dark:border-gray-700'
    ]"
  >
    <div class="mb-1.5 flex shrink-0 flex-wrap items-center gap-2 text-[11px] sm:text-xs">
      <label
        v-if="!hideChannelSelect && !fixedChannel"
        class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400"
      >
        <span class="font-medium">{{ t('cases.recordComposerVia') }}</span>
        <HeadlessSelect
          :model-value="viaChannel"
          :options="channelOptions"
          :disabled="disabled"
          teleport
          :searchable="false"
          wrapper-class="inline-block min-w-[7rem]"
          :button-class="composerSelectButtonClass"
          @update:model-value="viaChannel = $event"
        />
      </label>
      <label class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <span class="font-medium">{{ t('cases.recordComposerFrom') }}</span>
        <span class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          {{ fromLabel }}
        </span>
      </label>
      <label
        v-if="showInternalToggle && !internalCommentMode"
        class="ml-auto inline-flex cursor-pointer items-center gap-2 text-gray-600 dark:text-gray-400"
      >
        <input
          v-model="internalComment"
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          :disabled="disabled"
        />
        {{ t('cases.recordInternalComment') }}
      </label>
    </div>

    <div
      v-if="useCommentComposer"
      :class="[fillHeight ? 'flex min-h-0 flex-1 flex-col' : '']"
    >
      <CommentInput
        ref="commentInputRef"
        v-model="commentDraft"
        variant="activity"
        :show-submit="false"
        :allow-attachments="false"
        :disabled="disabled || sending"
        :placeholder="commentPlaceholder"
        :class="fillHeight ? 'flex min-h-0 flex-1 flex-col' : ''"
      />
      <div class="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <CaseCannedResponseMenu
            :items="cannedResponses"
            :loading="cannedLoading"
            :disabled="disabled || sending || draftingAi"
            :active-channel="cannedChannel"
            @open="onCannedMenuOpen"
            @select="applyCannedResponse"
          />
          <button
            v-if="canUseAiDraft"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
            :disabled="disabled || sending || draftingAi"
            @click="draftWithAi"
          >
            <span v-if="draftingAi" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            {{ draftingAi ? t('cases.recordAiDrafting') : t('cases.recordAiDraft') }}
          </button>
          <div v-if="showAiDraftFeedback" class="inline-flex items-center gap-1">
            <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('cases.recordAiFeedbackPrompt') }}</span>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              :disabled="aiFeedbackSent"
              @click="sendAiDraftFeedback('up')"
            >
              {{ t('cases.recordAiFeedbackUp') }}
            </button>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              :disabled="aiFeedbackSent"
              @click="sendAiDraftFeedback('down')"
            >
              {{ t('cases.recordAiFeedbackDown') }}
            </button>
          </div>
        </div>
        <p v-if="aiError" class="basis-full text-xs text-red-600 dark:text-red-400">{{ aiError }}</p>
        <div class="flex items-center gap-2">
          <button
            v-if="isClosed"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="$emit('reopen')"
          >
            {{ t('cases.recordReopen') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="disabled || sending || !commentDraft.trim()"
            @click="submitComment"
          >
          <span v-if="sending" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {{ t('cases.recordSend') }}
        </button>
        </div>
      </div>
    </div>

    <div
      v-else
      :class="[
        'rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-800/50',
        fillHeight ? 'flex min-h-0 flex-1 flex-col' : ''
      ]"
    >
      <textarea
        v-model="draft"
        :rows="fillHeight ? undefined : 3"
        :disabled="disabled || sending"
        :placeholder="placeholder"
        :class="[
          'w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-gray-500',
          fillHeight ? 'min-h-0 flex-1 rounded-t-xl' : 'rounded-t-xl'
        ]"
        @input="onDraftInput"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      />
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-600">
        <div class="flex items-center gap-2">
          <CaseCannedResponseMenu
            v-if="internalComment"
            :items="cannedResponses"
            :loading="cannedLoading"
            :disabled="disabled || sending || draftingAi"
            :active-channel="cannedChannel"
            @open="onCannedMenuOpen"
            @select="applyCannedResponseToDraft"
          />
          <div v-else class="flex items-center gap-1 text-gray-400">
            <BoltIcon class="h-4 w-4 opacity-40" />
            <span class="text-xs text-gray-400">{{ t('cases.recordMacrosInternalOnly') }}</span>
          </div>
          <button
            v-if="canUseAiDraft"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
            :disabled="disabled || sending || draftingAi"
            @click="draftWithAi"
          >
            <span v-if="draftingAi" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            {{ draftingAi ? t('cases.recordAiDrafting') : t('cases.recordAiDraft') }}
          </button>
          <div v-if="showAiDraftFeedback" class="inline-flex items-center gap-1">
            <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('cases.recordAiFeedbackPrompt') }}</span>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              :disabled="aiFeedbackSent"
              @click="sendAiDraftFeedback('up')"
            >
              {{ t('cases.recordAiFeedbackUp') }}
            </button>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              :disabled="aiFeedbackSent"
              @click="sendAiDraftFeedback('down')"
            >
              {{ t('cases.recordAiFeedbackDown') }}
            </button>
          </div>
        </div>
        <p v-if="aiError" class="basis-full text-xs text-red-600 dark:text-red-400">{{ aiError }}</p>
        <div class="flex items-center gap-2">
          <button
            v-if="isClosed"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="$emit('reopen')"
          >
            {{ t('cases.recordReopen') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="disabled || sending || !draft.trim()"
            @click="submit"
          >
            <span v-if="sending" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {{ t('cases.recordSend') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BoltIcon } from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { CASE_CHANNELS } from '@/constants/caseLifecycle';
import { useAuthStore } from '@/stores/authRegistry';
import CommentInput from '@/components/record-page/CommentInput.vue';
import CaseCannedResponseMenu from '@/components/cases/CaseCannedResponseMenu.vue';
import { useCaseCannedResponses } from '@/composables/useCaseCannedResponses';
import {
  buildCaseCannedResponseContext,
  resolveCannedResponse
} from '@/utils/caseCannedResponses';
import apiClient from '@/utils/apiClient';
import { submitAiFeedback, trackAiAbilityUsed } from '@/utils/aiFeedback';
import { captureAiDraftAccepted } from '@/config/posthogAi';

const props = defineProps({
  caseRecord: { type: Object, default: null },
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  showInternalToggle: { type: Boolean, default: true },
  /** If set, forces the channel and hides the selector. */
  fixedChannel: { type: String, default: '' },
  /** Hide the "Via" channel selector. */
  hideChannelSelect: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  /** Fill parent height (used inside resizable pane). */
  fillHeight: { type: Boolean, default: false },
  /** Always use the rich internal comment composer (Notes tab). */
  internalCommentMode: { type: Boolean, default: false }
});

const emit = defineEmits(['send', 'reopen', 'typing', 'ai-error']);

const { t } = useI18n();
const authStore = useAuthStore();

const { responses: cannedResponses, loading: cannedLoading, load: fetchCannedResponses } =
  useCaseCannedResponses();

const draft = ref('');
const commentDraft = ref('');
const commentInputRef = ref(null);
const viaChannel = ref('');
const internalComment = ref(false);
const typingTimer = ref(null);
const lastTypingSentAt = ref(0);
const draftingAi = ref(false);
const aiError = ref('');
const showAiDraftFeedback = ref(false);
const aiFeedbackSent = ref(false);
const lastAiDraftMeta = ref({ provider: '', model: '', keyMode: '' });
/** True while the composer still holds an AI-generated draft (cleared on send/edit-away). */
const aiDraftPendingAccept = ref(false);

const canUseAiDraft = computed(() => Boolean(props.caseRecord?._id));

const channels = CASE_CHANNELS;

const channelOptions = computed(() =>
  channels.map((channel) => ({ value: channel, label: channel }))
);

const composerSelectButtonClass =
  'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white !bg-white dark:!bg-gray-800';

watch(
  () => [props.fixedChannel, props.caseRecord?.channel],
  (ch) => {
    const fixed = String(props.fixedChannel || '').trim();
    if (fixed) {
      viaChannel.value = fixed;
      return;
    }
    const recordChannel = Array.isArray(ch) ? ch[1] : ch;
    if (recordChannel) viaChannel.value = recordChannel;
    else if (!viaChannel.value) viaChannel.value = channels[0];
  },
  { immediate: true }
);

const fromLabel = computed(() => {
  const u = authStore.user;
  if (!u) return t('cases.recordSupport');
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || t('cases.recordSupport');
});

const placeholder = computed(
  () => props.placeholder || t('cases.recordComposerPlaceholder')
);

const useCommentComposer = computed(
  () => props.internalCommentMode || internalComment.value
);

const commentPlaceholder = computed(() => {
  if (props.internalCommentMode) {
    return props.placeholder || t('cases.recordInternalCommentPlaceholder');
  }
  return t('cases.recordInternalCommentPlaceholder');
});

const cannedContext = computed(() =>
  buildCaseCannedResponseContext({
    caseRecord: props.caseRecord,
    agentUser: authStore.user
  })
);

const cannedChannel = computed(() =>
  props.internalCommentMode || internalComment.value ? 'internal' : 'email'
);

async function onCannedMenuOpen() {
  await fetchCannedResponses(cannedChannel.value, { includeAll: true });
}

function applyCannedResponse(item) {
  applyCannedResponseToDraft(item);
}

function applyCannedResponseToDraft(item) {
  const resolved = resolveCannedResponse(item, cannedContext.value);
  const plain = String(resolved.body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  if (useCommentComposer.value) {
    commentDraft.value = plain;
  } else {
    draft.value = plain;
    internalComment.value = true;
  }
}

async function draftWithAi() {
  const caseId = props.caseRecord?._id;
  if (!caseId || draftingAi.value) return;
  draftingAi.value = true;
  aiError.value = '';
  showAiDraftFeedback.value = false;
  aiFeedbackSent.value = false;
  try {
    const data = await apiClient.post(`/ai/cases/${caseId}/draft-reply`, {});
    const text = String(data?.text || '').trim();
    if (!text) {
      aiError.value = t('cases.recordAiDraftEmpty');
      emit('ai-error', aiError.value);
      return;
    }
    if (useCommentComposer.value) {
      commentDraft.value = text;
    } else {
      draft.value = text;
    }
    lastAiDraftMeta.value = {
      provider: data?.provider || '',
      model: data?.model || '',
      keyMode: data?.keyMode || '',
    };
    aiDraftPendingAccept.value = true;
    showAiDraftFeedback.value = true;
    trackAiAbilityUsed({
      abilityKey: 'draft_reply',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
  } catch (err) {
    aiError.value = err?.message || t('cases.recordAiDraftFailed');
    emit('ai-error', aiError.value);
  } finally {
    draftingAi.value = false;
  }
}

function markAiDraftAcceptedIfPending() {
  if (!aiDraftPendingAccept.value) return;
  aiDraftPendingAccept.value = false;
  captureAiDraftAccepted({
    provider: lastAiDraftMeta.value.provider,
    model: lastAiDraftMeta.value.model,
    sourceId: props.caseRecord?._id,
    via: 'send',
  });
}

async function sendAiDraftFeedback(rating) {
  if (aiFeedbackSent.value) return;
  aiFeedbackSent.value = true;
  if (rating === 'up') {
    aiDraftPendingAccept.value = false;
  }
  await submitAiFeedback({
    rating,
    abilityKey: 'draft_reply',
    provider: lastAiDraftMeta.value.provider,
    model: lastAiDraftMeta.value.model,
    keyMode: lastAiDraftMeta.value.keyMode,
    sourceType: 'case',
    sourceId: props.caseRecord?._id,
  });
}

function submitComment() {
  const payload = commentInputRef.value?.getSubmitPayload?.();
  const message = String(payload?.content || commentDraft.value || '').trim();
  if (!message) return;
  markAiDraftAcceptedIfPending();
  emit('send', {
    message,
    channel: viaChannel.value,
    internal: props.internalCommentMode || internalComment.value
  });
  commentDraft.value = '';
  internalComment.value = false;
}

function submit() {
  const message = draft.value.trim();
  if (!message) return;
  markAiDraftAcceptedIfPending();
  emit('send', {
    message,
    channel: viaChannel.value,
    internal: internalComment.value
  });
  draft.value = '';
  internalComment.value = false;
}

watch(
  () => draft.value,
  (val) => {
    // Keep watcher for edge cases (programmatic changes), but main signal is onDraftInput.
    if (val) onDraftInput();
  }
);

function onDraftInput() {
  const msg = String(draft.value || '').trim();
  if (!msg) return;
  const send = () => {
    lastTypingSentAt.value = Date.now();
    emit('typing', { channel: viaChannel.value, internal: internalComment.value });
  };
  const now = Date.now();
  if (now - lastTypingSentAt.value > 900) {
    send();
    return;
  }
  if (typingTimer.value) clearTimeout(typingTimer.value);
  typingTimer.value = setTimeout(send, 900);
}

defineExpose({
  clear: () => {
    draft.value = '';
    commentDraft.value = '';
    internalComment.value = false;
  }
});
</script>
