<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" @click="requestClose" />
      <div class="relative flex h-full w-full max-w-6xl flex-col bg-white shadow-2xl dark:bg-gray-900">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ isNew ? t('settings.helpdeskExecCannedDrawerNewTitle') : t('settings.helpdeskExecCannedDrawerEditTitle') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('settings.helpdeskExecCannedDrawerSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            @click="requestClose"
          >
            <span class="sr-only">{{ t('actions.close') }}</span>
            ✕
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
          <div class="grid shrink-0 gap-5 lg:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('settings.helpdeskExecCannedName') }}
              </label>
              <input
                v-model.trim="draft.name"
                type="text"
                :placeholder="t('settings.helpdeskExecCannedDrawerNamePh')"
                class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <p class="mb-2 text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecCannedChannel') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in channelOptions"
                  :key="option.value"
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="draft.channel === option.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
                  @click="draft.channel = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="showSubject" class="mt-5 shrink-0">
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('settings.helpdeskExecCannedSubject') }}
              </label>
              <CaseCannedResponseMergeTagMenu @select="(token) => insertMergeTag('subject', token)" />
            </div>
            <input
              ref="subjectInputRef"
              v-model="draft.subject"
              type="text"
              :placeholder="CANNED_SUBJECT_PLACEHOLDER"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @focus="activeField = 'subject'"
            />
          </div>

          <div class="mt-5 flex min-h-0 flex-1 flex-col gap-2">
            <div class="flex shrink-0 items-center justify-between gap-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('settings.helpdeskExecCannedBody') }}
              </label>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ useRichBodyEditor ? t('settings.helpdeskExecCannedBodyEmailHint') : t('settings.helpdeskExecCannedBodyInternalHint') }}
              </span>
            </div>

            <div class="flex min-h-0 flex-1 gap-4">
              <div
                class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <div
                  v-if="useRichBodyEditor"
                  class="min-h-0 flex-1 overflow-hidden px-1.5 py-1"
                  @focusin="activeField = 'body'"
                >
                  <TaskDescriptionEditor
                    ref="bodyEditorRef"
                    :key="bodyEditorKey"
                    v-model="draft.body"
                    :placeholder="t('cases.recordEmailComposerBodyPlaceholder')"
                    class="h-full min-h-[280px] border-0 shadow-none [&_.task-description-editor]:h-full [&_.task-description-editor]:border-0 [&_.task-description-editor]:shadow-none [&_.tiptap]:min-h-[260px] [&_.tiptap]:px-3 [&_.tiptap]:py-2"
                  />
                </div>

                <div
                  v-else
                  class="flex min-h-0 flex-1 flex-col px-3 py-3"
                  @focusin="activeField = 'body'"
                >
                  <CommentInput
                    ref="internalBodyRef"
                    :key="bodyEditorKey"
                    v-model="draft.body"
                    variant="activity"
                    :show-submit="false"
                    :allow-attachments="false"
                    :placeholder="t('cases.recordInternalCommentPlaceholder')"
                    class="flex min-h-0 flex-1 flex-col [&_.comment-input]:flex [&_.comment-input]:min-h-0 [&_.comment-input]:flex-1 [&_.comment-input]:flex-col [&_.comment-editor]:min-h-[240px]"
                  />
                </div>
              </div>

              <CaseCannedResponseMergeTagPicker
                fill-height
                class="hidden w-[320px] shrink-0 lg:flex"
                :target-label="activeFieldLabel"
                @select="(token) => insertMergeTag(activeField, token)"
              />
            </div>

            <CaseCannedResponseMergeTagPicker
              class="mt-1 lg:hidden"
              :target-label="activeFieldLabel"
              @select="(token) => insertMergeTag(activeField, token)"
            />
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <button
            v-if="!isNew"
            type="button"
            class="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            @click="$emit('remove')"
          >
            {{ t('actions.remove') }}
          </button>
          <div v-else />
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="requestClose"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              @click="save"
            >
              {{ t('settings.helpdeskExecCannedDrawerSave') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CaseCannedResponseMergeTagMenu from '@/components/cases/CaseCannedResponseMergeTagMenu.vue';
import CaseCannedResponseMergeTagPicker from '@/components/cases/CaseCannedResponseMergeTagPicker.vue';
import CommentInput from '@/components/record-page/CommentInput.vue';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import { formatCaseCannedResponseMergeTag } from '@/constants/caseCannedResponseMergeTags';
import { focusInputAtCursor, insertTextAtCursor } from '@/utils/insertAtCursor';

const props = defineProps({
  open: { type: Boolean, default: false },
  isNew: { type: Boolean, default: true },
  initialResponse: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save', 'remove']);

const { t } = useI18n();

const CANNED_SUBJECT_PLACEHOLDER = 'Re: {{case.title}}';
const DEFAULT_BODY = '<p>Hi {{contact.firstName}},</p><p></p><p>Best regards,<br/>{{agent.name}}</p>';
const DEFAULT_INTERNAL_BODY = 'Escalating case {{case.caseId}}. Please review when available.';

const channelOptions = computed(() => [
  { value: 'email', label: t('settings.helpdeskExecCannedChannelEmail') },
  { value: 'internal', label: t('settings.helpdeskExecCannedChannelInternal') },
  { value: 'all', label: t('settings.helpdeskExecCannedChannelAll') }
]);

const draft = reactive(createEmptyDraft());
const subjectInputRef = ref(null);
const bodyEditorRef = ref(null);
const internalBodyRef = ref(null);
const activeField = ref('body');
const bodyEditorKey = ref('email-new');

const activeFieldLabel = computed(() =>
  activeField.value === 'subject'
    ? t('settings.helpdeskExecCannedSubject')
    : t('settings.helpdeskExecCannedBody')
);

const showSubject = computed(() => draft.channel === 'email' || draft.channel === 'all');
const useRichBodyEditor = computed(() => draft.channel !== 'internal');

function htmlToPlain(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function plainToHtml(text) {
  const value = String(text || '').trim();
  if (!value) return '<p></p>';
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function createEmptyDraft() {
  return {
    id: '',
    name: '',
    channel: 'email',
    subject: 'Re: {{case.title}}',
    body: DEFAULT_BODY
  };
}

function slugifyId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeBodyForChannel(body, channel) {
  const value = String(body || '').trim();
  if (channel === 'internal') {
    return value ? htmlToPlain(value) : DEFAULT_INTERNAL_BODY;
  }
  return value ? plainToHtml(value) : DEFAULT_BODY;
}

function loadDraft(response) {
  const base = response || createEmptyDraft();
  const channel = base.channel || 'email';
  draft.id = base.id || '';
  draft.name = base.name || '';
  draft.channel = channel;
  draft.subject = base.subject ?? 'Re: {{case.title}}';
  draft.body = normalizeBodyForChannel(base.body, channel);
  bodyEditorKey.value = `${channel}-${draft.id || 'new'}-${Date.now()}`;
}

watch(
  () => [props.open, props.initialResponse, props.isNew],
  () => {
    if (props.open) loadDraft(props.isNew ? null : props.initialResponse);
  },
  { immediate: true }
);

watch(
  () => draft.channel,
  (channel, previous) => {
    if (!previous || channel === previous) return;
    if (channel === 'internal') {
      draft.body = normalizeBodyForChannel(draft.body, 'internal');
    } else if (previous === 'internal') {
      draft.body = normalizeBodyForChannel(draft.body, channel);
    }
    bodyEditorKey.value = `${channel}-${draft.id || 'new'}-${Date.now()}`;
  }
);

function requestClose() {
  emit('close');
}

function insertMergeTag(field, token) {
  const tag = formatCaseCannedResponseMergeTag(token);
  const targetField = field === 'subject' ? 'subject' : 'body';
  activeField.value = targetField;

  if (targetField === 'subject') {
    const el = subjectInputRef.value;
    const { value, cursor } = insertTextAtCursor(el, tag);
    draft.subject = value;
    nextTick(() => focusInputAtCursor(el, cursor));
    return;
  }

  if (useRichBodyEditor.value) {
    bodyEditorRef.value?.insertText?.(tag);
    return;
  }

  draft.body = `${draft.body || ''}${tag}`;
  nextTick(() => internalBodyRef.value?.focus?.());
}

function save() {
  const body = useRichBodyEditor.value
    ? String(draft.body || '').trim()
    : htmlToPlain(draft.body);

  if (!String(draft.name || '').trim() || !body) return;

  emit('save', {
    id: draft.id || slugifyId(draft.name) || `macro-${Date.now()}`,
    name: draft.name.trim(),
    channel: draft.channel || 'email',
    subject: showSubject.value ? String(draft.subject || '').trim() : '',
    body
  });
}
</script>
