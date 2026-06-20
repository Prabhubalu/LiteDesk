<template>
  <section v-if="record?._id" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('documents.inlineCommentsTitle') }}
      </h3>
      <span v-if="openCount" class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
        {{ openCount }}
      </span>
    </div>

    <div v-if="pendingAnchor?.quotedText" class="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/30">
      <p class="text-xs font-medium text-indigo-800 dark:text-indigo-200">{{ t('documents.inlineCommentsSelectedText') }}</p>
      <p class="mt-1 text-sm italic text-gray-700 dark:text-gray-300">“{{ pendingAnchor.quotedText }}”</p>
    </div>

    <div v-if="canComment" class="mb-4 space-y-2">
      <textarea
        v-model="draftBody"
        rows="3"
        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        :placeholder="t('documents.inlineCommentsPlaceholder')"
      />
      <div class="flex flex-wrap items-center gap-2">
        <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input v-model="isSuggestion" type="checkbox" class="rounded border-gray-300" />
          {{ t('documents.inlineCommentsSuggestion') }}
        </label>
        <input
          v-if="isSuggestion"
          v-model="suggestedText"
          type="text"
          class="min-w-[180px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          :placeholder="t('documents.inlineCommentsSuggestedTextPlaceholder')"
        />
      </div>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="submitting || !draftBody.trim()"
        @click="submitComment"
      >
        {{ submitting ? t('documents.inlineCommentsSubmitting') : t('documents.inlineCommentsSubmit') }}
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">{{ t('documents.inlineCommentsLoading') }}</div>
    <p v-else-if="!threads.length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('documents.inlineCommentsEmpty') }}</p>

    <div v-else class="space-y-3">
      <article
        v-for="thread in threads"
        :key="thread._id"
        class="rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700"
        :class="thread.status === 'resolved' ? 'opacity-70' : ''"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ authorName(thread.authorId) }}</p>
            <p v-if="thread.quotedText" class="mt-1 text-xs italic text-gray-500 dark:text-gray-400">“{{ thread.quotedText }}”</p>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ thread.body }}</p>
            <p v-if="thread.commentType === 'suggestion' && thread.suggestedText" class="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
              {{ t('documents.inlineCommentsSuggestedText', { text: thread.suggestedText }) }}
            </p>
          </div>
          <button
            v-if="canComment"
            type="button"
            class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            @click="toggleResolve(thread)"
          >
            {{ thread.status === 'resolved' ? t('documents.inlineCommentsReopen') : t('documents.inlineCommentsResolve') }}
          </button>
        </div>

        <div v-if="thread.replies?.length" class="mt-3 space-y-2 border-l border-gray-200 pl-3 dark:border-gray-700">
          <div v-for="reply in thread.replies" :key="reply._id">
            <p class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ authorName(reply.authorId) }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ reply.body }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const {
  fetchDocumentInlineComments,
  createDocumentInlineComment,
  resolveDocumentInlineComment,
  reopenDocumentInlineComment
} = useDocuments();

const threads = ref([]);
const loading = ref(false);
const submitting = ref(false);
const draftBody = ref('');
const isSuggestion = ref(false);
const suggestedText = ref('');

const canComment = computed(() => props.context?.canEdit !== false);
const pendingAnchor = computed(() => props.context?.pendingCommentAnchor || null);
const openCount = computed(() => threads.value.filter((row) => row.status === 'open').length);

function authorName(author) {
  if (!author || typeof author !== 'object') return t('documents.inlineCommentsUnknownAuthor');
  const name = `${author.firstName || ''} ${author.lastName || ''}`.trim();
  return name || author.email || author.username || t('documents.inlineCommentsUnknownAuthor');
}

async function loadComments() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const response = await fetchDocumentInlineComments(props.record._id);
    threads.value = response?.data || [];
  } catch (error) {
    notifications.error(error?.message || t('documents.inlineCommentsLoadFailed'));
  } finally {
    loading.value = false;
  }
}

async function submitComment() {
  if (!props.record?._id || !draftBody.value.trim()) return;
  submitting.value = true;
  try {
    const payload = {
      body: draftBody.value.trim(),
      commentType: isSuggestion.value ? 'suggestion' : 'comment',
      suggestedText: isSuggestion.value ? suggestedText.value.trim() : undefined,
      quotedText: pendingAnchor.value?.quotedText,
      anchorFrom: pendingAnchor.value?.anchorFrom,
      anchorTo: pendingAnchor.value?.anchorTo
    };
    const response = await createDocumentInlineComment(props.record._id, payload);
    if (!response?.success) {
      notifications.error(response?.message || t('documents.inlineCommentsCreateFailed'));
      return;
    }
    draftBody.value = '';
    isSuggestion.value = false;
    suggestedText.value = '';
    props.context?.onCommentAnchorCleared?.();
    await loadComments();
    notifications.success(t('documents.inlineCommentsCreateSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.inlineCommentsCreateFailed'));
  } finally {
    submitting.value = false;
  }
}

async function toggleResolve(thread) {
  if (!props.record?._id || !thread?._id) return;
  try {
    const action = thread.status === 'resolved'
      ? reopenDocumentInlineComment
      : resolveDocumentInlineComment;
    const response = await action(props.record._id, thread._id);
    if (!response?.success) {
      notifications.error(response?.message || t('documents.inlineCommentsUpdateFailed'));
      return;
    }
    await loadComments();
  } catch (error) {
    notifications.error(error?.message || t('documents.inlineCommentsUpdateFailed'));
  }
}

watch(() => props.record?._id, () => {
  void loadComments();
});

onMounted(() => {
  void loadComments();
});
</script>
