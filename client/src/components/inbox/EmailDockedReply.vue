<template>
  <div
    class="overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-md ring-1 ring-black/[0.04] dark:border-gray-600 dark:bg-gray-900 dark:ring-white/5"
  >
    <!-- Collapsed recipient header (click to expand) -->
    <div
      v-if="!recipientsExpanded"
      class="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50"
    >
      <ArrowUturnLeftIcon class="h-4 w-4 shrink-0 text-neutral-500 dark:text-gray-400" aria-hidden="true" />
      <button
        type="button"
        class="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm text-neutral-800 hover:bg-neutral-200/60 dark:text-gray-200 dark:hover:bg-gray-700/60"
        :title="t('inbox.emailDockedReplyEditRecipients')"
        @click="expandRecipients"
      >
        <span class="font-medium">{{ collapsedRecipientLine }}</span>
      </button>
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="rounded p-1.5 text-neutral-500 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-gray-700"
          :title="t('inbox.emailDockedReplyPopOut')"
          :aria-label="t('inbox.emailDockedReplyPopOut')"
          @click="onPopOut"
        >
          <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="rounded p-1.5 text-neutral-500 hover:bg-neutral-200/80 dark:text-gray-400 dark:hover:bg-gray-700"
          :title="t('settings.roleDrawerCloseSr')"
          :aria-label="t('settings.roleDrawerCloseSr')"
          @click="onDiscard"
        >
          <XMarkIcon class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Expanded recipient editor (Gmail-style To / Cc / Bcc) -->
    <div
      v-else
      class="border-b border-neutral-100 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex items-start gap-2 px-3 pt-2">
        <ArrowUturnLeftIcon class="mt-2 h-4 w-4 shrink-0 text-neutral-500 dark:text-gray-400" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <!-- To row -->
          <div class="flex items-start gap-2 border-b border-neutral-100 py-1.5 dark:border-gray-800">
            <span class="mt-1.5 w-7 shrink-0 text-xs text-neutral-500 dark:text-gray-400">To</span>
            <div
              class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5"
              @click="focusToInput"
            >
              <span
                v-for="(token, idx) in toTokens"
                :key="`to-${idx}-${token}`"
                class="inline-flex max-w-full items-center gap-0.5 rounded-full bg-neutral-100 py-0.5 pl-2.5 pr-1 text-xs text-neutral-800 dark:bg-gray-700 dark:text-gray-100"
              >
                <span class="truncate">{{ chipLabelForToken(token) }}</span>
                <button
                  type="button"
                  class="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-gray-600"
                  :aria-label="t('inbox.emailDockedReplyRemoveRecipient')"
                  @click.stop="removeToToken(idx)"
                >
                  <XMarkIcon class="h-3 w-3" />
                </button>
              </span>
              <input
                ref="toInputRef"
                v-model="toInputDraft"
                type="text"
                class="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-white"
                :placeholder="toTokens.length ? '' : t('inbox.emailComposeDrawerRecipientExampleComCommaSeparatedFor')"
                @keydown="onToInputKeydown"
                @blur="commitToInput"
              />
            </div>
            <div v-if="!showCc || !showBcc" class="flex shrink-0 gap-2 pt-1 text-xs">
              <button
                v-if="!showCc"
                type="button"
                class="text-neutral-500 hover:text-neutral-900 dark:hover:text-gray-200"
                @click="enableCc"
              >
                Cc
              </button>
              <button
                v-if="!showBcc"
                type="button"
                class="text-neutral-500 hover:text-neutral-900 dark:hover:text-gray-200"
                @click="enableBcc"
              >
                Bcc
              </button>
            </div>
          </div>

          <!-- Cc row -->
          <div
            v-if="showCc"
            class="flex items-start gap-2 border-b border-neutral-100 py-1.5 dark:border-gray-800"
          >
            <span class="mt-1.5 w-7 shrink-0 text-xs text-neutral-500 dark:text-gray-400">Cc</span>
            <input
              v-model="form.cc"
              type="text"
              class="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-white"
              :placeholder="t('inbox.emailComposeDrawerCcExampleComCommaSeparated')"
            />
          </div>

          <!-- Bcc row -->
          <div
            v-if="showBcc"
            class="flex items-start gap-2 border-b border-neutral-100 py-1.5 dark:border-gray-800"
          >
            <span class="mt-1.5 w-7 shrink-0 text-xs text-neutral-500 dark:text-gray-400">Bcc</span>
            <input
              v-model="form.bcc"
              type="text"
              class="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-white"
              :placeholder="t('inbox.emailComposeDrawerBccExampleComCommaSeparated')"
            />
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-0.5 pt-0.5">
          <button
            type="button"
            class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('inbox.emailDockedReplyPopOut')"
            :aria-label="t('inbox.emailDockedReplyPopOut')"
            @click="onPopOut"
          >
            <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('settings.roleDrawerCloseSr')"
            :aria-label="t('settings.roleDrawerCloseSr')"
            @click="onDiscard"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <form class="flex flex-col" @submit.prevent="handleSend">
      <div
        v-if="error"
        class="mx-3 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
      >
        {{ error }}
      </div>

      <div class="px-1 py-2">
        <TaskDescriptionEditor
          v-model="form.body"
          :placeholder="t('inbox.emailDockedReplyPlaceholder')"
          class="[&_.tiptap]:min-h-[120px] [&_.tiptap]:max-h-[280px] [&_.tiptap]:overflow-y-auto [&_.tiptap]:px-3 [&_.ProseMirror]:text-sm"
        />
      </div>

      <ul v-if="attachments.length" class="space-y-1 px-3 pb-2">
        <li
          v-for="(att, idx) in attachments"
          :key="idx"
          class="flex items-center justify-between gap-2 rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <span class="truncate">{{ att.fileName }}</span>
          <button
            type="button"
            class="shrink-0 text-neutral-500 hover:text-red-600"
            @click="removeAttachment(idx)"
          >
            <XMarkIcon class="size-3.5" />
          </button>
        </li>
      </ul>

      <div class="flex items-center gap-1 border-t border-neutral-100 px-3 py-2 dark:border-gray-800">
        <button
          type="submit"
          class="inline-flex items-center rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
          :disabled="sending || !form.body?.replace(/<[^>]+>/g, '').trim()"
        >
          {{ sending ? t('inbox.emailDockedReplySending') : t('inbox.emailComposeDrawerSend') }}
        </button>
        <button
          type="button"
          class="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800"
          :title="t('inbox.emailComposeDrawerAttachments')"
          :disabled="uploading"
          @click="fileInputRef?.click()"
        >
          <PaperClipIcon class="size-5" aria-hidden="true" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          multiple
          @change="handleFileSelect"
        />
        <div class="flex-1" />
        <button
          type="button"
          class="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-gray-300 dark:hover:bg-gray-800"
          :title="t('inbox.emailComposeWindowDiscardDraft')"
          @click="onDiscard"
        >
          <TrashIcon class="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowUturnLeftIcon,
  ArrowsPointingOutIcon,
  PaperClipIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import { useEmailComposeForm } from '@/composables/useEmailComposeForm';
import { displayNameFromAddress } from '@/utils/emailParticipantDisplay';
import {
  splitRecipientField,
  joinRecipientField,
  chipLabelForToken
} from '@/utils/emailRecipientField';

const props = defineProps({
  isOpen: { type: Boolean, default: true },
  standaloneMode: { type: Boolean, default: false },
  relatedTo: { type: Object, default: null },
  initialDraft: { type: Object, default: null },
  sendingMailbox: { type: Object, default: null },
  sendingMailboxHint: { type: String, default: '' },
  recipientAddress: { type: String, default: '' },
  sending: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit', 'pop-out']);

const { t } = useI18n();

const {
  form,
  showCc,
  showBcc,
  error,
  attachments,
  uploading,
  fileInputRef,
  close,
  handleFileSelect,
  removeAttachment,
  handleSend: submitForm
} = useEmailComposeForm(props, emit);

const recipientsExpanded = ref(false);
const toInputDraft = ref('');
const toInputRef = ref(null);

const toTokens = computed(() => splitRecipientField(form.value.to));

const recipientEmail = computed(() => {
  const raw = String(props.recipientAddress || props.initialDraft?.to || form.value.to || '').trim();
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
});

const recipientName = computed(() => {
  const raw = String(props.recipientAddress || props.initialDraft?.to || form.value.to || '').trim();
  const name = displayNameFromAddress(raw);
  if (name && name !== recipientEmail.value) return name;
  if (recipientEmail.value) return displayNameFromAddress(recipientEmail.value);
  return t('inbox.emailDockedReplyUnknownRecipient');
});

const collapsedRecipientLine = computed(() => {
  const tokens = toTokens.value;
  if (tokens.length === 0) {
    if (recipientEmail.value) {
      const name = recipientName.value;
      if (name && name !== recipientEmail.value) {
        return `${name} (${recipientEmail.value})`;
      }
      return recipientEmail.value;
    }
    return recipientName.value;
  }
  const labels = tokens.map((tok) => chipLabelForToken(tok));
  let line = labels.join(', ');
  if (showCc.value && form.value.cc?.trim()) line += `, Cc: ${form.value.cc.trim()}`;
  if (showBcc.value && form.value.bcc?.trim()) line += `, Bcc: ${form.value.bcc.trim()}`;
  return line;
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      recipientsExpanded.value = false;
      toInputDraft.value = '';
    }
  }
);

watch(
  () => [form.value.cc, form.value.bcc],
  () => {
    if (form.value.cc?.trim() || form.value.bcc?.trim()) {
      recipientsExpanded.value = true;
    }
  }
);

function expandRecipients() {
  recipientsExpanded.value = true;
  nextTick(() => focusToInput());
}

function focusToInput() {
  toInputRef.value?.focus();
}

function enableCc() {
  recipientsExpanded.value = true;
  showCc.value = true;
  nextTick(() => focusToInput());
}

function enableBcc() {
  recipientsExpanded.value = true;
  showBcc.value = true;
  nextTick(() => focusToInput());
}

function removeToToken(index) {
  const next = [...toTokens.value];
  next.splice(index, 1);
  form.value.to = joinRecipientField(next);
}

function commitToInput() {
  const draft = String(toInputDraft.value || '').trim();
  if (!draft) return;
  const existing = toTokens.value;
  const additions = splitRecipientField(draft);
  form.value.to = joinRecipientField([...existing, ...additions]);
  toInputDraft.value = '';
}

function onToInputKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    commitToInput();
  }
  if (event.key === 'Backspace' && !toInputDraft.value && toTokens.value.length) {
    removeToToken(toTokens.value.length - 1);
  }
}

function onDiscard() {
  recipientsExpanded.value = false;
  toInputDraft.value = '';
  close();
}

function buildCurrentDraft() {
  commitToInput();
  const resolvedTo =
    String(form.value.to || '').trim() ||
    String(props.recipientAddress || props.initialDraft?.to || '').trim();
  return {
    to: resolvedTo || form.value.to,
    cc: form.value.cc || '',
    bcc: form.value.bcc || '',
    subject: String(form.value.subject || props.initialDraft?.subject || '').trim(),
    body: form.value.body || '',
    ...(props.initialDraft?.parentCommunicationId
      ? { parentCommunicationId: props.initialDraft.parentCommunicationId }
      : {}),
    ...(attachments.value.length ? { attachments: attachments.value.map((a) => ({ ...a })) } : {})
  };
}

function onPopOut() {
  emit('pop-out', buildCurrentDraft());
}

function handleSend() {
  commitToInput();
  const resolvedTo =
    String(form.value.to || '').trim() ||
    String(props.recipientAddress || props.initialDraft?.to || '').trim();
  if (resolvedTo && !form.value.to) {
    form.value.to = resolvedTo;
  }
  if (!String(form.value.subject || '').trim() && props.initialDraft?.subject) {
    form.value.subject = props.initialDraft.subject;
  }
  submitForm();
}
</script>
