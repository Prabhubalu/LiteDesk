<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      @click.self="$emit('close')"
    >
      <div class="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div
        class="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
        :class="PLATFORM_HOME_CARD_CLASS"
        role="dialog"
        aria-modal="true"
        :aria-label="t('cases.portalCasesCreateTitle')"
      >
        <div :class="['px-5 py-4', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
            {{ t('cases.portalCasesCreateTitle') }}
          </h2>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {{ t('cases.portalCasesCreateIntro') }}
          </p>
        </div>

        <form class="min-h-0 flex-1 overflow-y-auto px-5 py-4 arivu-scrollbar" @submit.prevent="submit">
          <div
            v-if="kbEnabled && (kbLoading || kbArticles.length)"
            class="mb-4 rounded-xl p-4"
            :class="[PLATFORM_HOME_INTENT_GRADIENT_CLASS, PLATFORM_HOME_INSET_CONTROL_CLASS]"
          >
            <p class="text-sm font-medium text-neutral-900 dark:text-white">
              {{ t('cases.portalCasesKbSuggestionsTitle') }}
            </p>
            <p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {{ t('cases.portalCasesKbSuggestionsHint') }}
            </p>

            <div v-if="kbLoading" class="mt-3 space-y-2">
              <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
            </div>

            <ul v-else class="mt-3 space-y-2">
              <li
                v-for="article in kbArticles"
                :key="article._id"
              >
                <button
                  type="button"
                  class="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/80 dark:hover:bg-neutral-900/50"
                  @click="openArticle(article)"
                >
                  <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ article.title }}</p>
                  <p v-if="article.description" class="mt-0.5 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {{ article.description }}
                  </p>
                </button>
              </li>
            </ul>
          </div>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {{ t('cases.portalCasesFieldTitle') }} *
              </label>
              <input
                v-model="form.title"
                type="text"
                required
                class="min-h-11 w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
                :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
                @input="scheduleKbSearch"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {{ t('cases.portalCasesFieldDescription') }} *
              </label>
              <textarea
                v-model="form.description"
                required
                rows="4"
                class="w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
                :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
                @input="scheduleKbSearch"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {{ t('cases.portalCasesFieldPriority') }}
              </label>
              <select
                v-model="form.priority"
                class="min-h-11 w-full rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
                :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
              >
                <option value="Low">{{ t('cases.portalCasePriorityLow') }}</option>
                <option value="Medium">{{ t('cases.portalCasePriorityMedium') }}</option>
                <option value="High">{{ t('cases.portalCasePriorityHigh') }}</option>
                <option value="Critical">{{ t('cases.portalCasePriorityCritical') }}</option>
              </select>
            </div>

            <div v-if="allowAttachments" class="space-y-2">
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {{ t('cases.portalCasesAttachmentsLabel') }}
              </label>
              <input
                type="file"
                multiple
                class="block w-full text-sm text-neutral-700 dark:text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-200 dark:file:bg-neutral-700 dark:file:text-neutral-100 dark:hover:file:bg-neutral-600"
                :disabled="creating || uploadingAttachments"
                @change="handleFileSelect"
              />
              <p v-if="uploadError" class="text-sm text-danger-600 dark:text-danger-400">{{ uploadError }}</p>
              <div v-if="uploadedAttachments.length" class="flex flex-wrap gap-2">
                <span
                  v-for="att in uploadedAttachments"
                  :key="att.attachmentId"
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-700 dark:text-neutral-200"
                  :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
                >
                  <span class="max-w-[220px] truncate" :title="att.originalFileName">{{ att.originalFileName }}</span>
                  <button
                    type="button"
                    class="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                    :disabled="creating || uploadingAttachments"
                    @click="removeUploaded(att.attachmentId)"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>
          </div>

          <p v-if="createError" class="mt-4 text-sm text-danger-600 dark:text-danger-400">{{ createError }}</p>
        </form>

        <div :class="['flex justify-end gap-2 px-5 py-4', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
          <button
            type="button"
            class="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="$emit('close')"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="creating || uploadingAttachments || !form.title.trim() || !form.description.trim()"
            @click="submit"
          >
            {{ creating ? t('cases.portalCasesSubmitting') : t('cases.portalCasesSubmit') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePortalCases } from '@/composables/usePortalCases';
import { usePortalKnowledge } from '@/composables/usePortalKnowledge';
import { uploadPortalAttachment } from '@/utils/portalAttachmentUpload';
import {
  capturePortalCaseCreated,
  capturePortalCaseCreateStarted,
  capturePortalCaseKbArticleClicked
} from '@/config/posthogPortal';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_INTENT_GRADIENT_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  open: { type: Boolean, default: false },
  kbEnabled: { type: Boolean, default: true },
  allowAttachments: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'created']);

const { t } = useI18n();
const router = useRouter();
const { createCase } = usePortalCases();
const { listArticles } = usePortalKnowledge();

const form = ref({ title: '', description: '', priority: 'Medium' });
const creating = ref(false);
const createError = ref(null);
const uploadingAttachments = ref(false);
const uploadError = ref(null);
const uploadedAttachments = ref([]);
const kbArticles = ref([]);
const kbLoading = ref(false);
let kbTimer = null;
let createStarted = false;

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && !createStarted) {
      createStarted = true;
      capturePortalCaseCreateStarted();
    }
    if (!isOpen) {
      resetForm();
    }
  }
);

function resetForm() {
  form.value = { title: '', description: '', priority: 'Medium' };
  createError.value = null;
  uploadError.value = null;
  uploadedAttachments.value = [];
  kbArticles.value = [];
  createStarted = false;
}

function kbQuery() {
  return [form.value.title, form.value.description].filter(Boolean).join(' ').trim();
}

function scheduleKbSearch() {
  if (!props.kbEnabled) return;
  if (kbTimer) window.clearTimeout(kbTimer);
  kbTimer = window.setTimeout(() => {
    void loadKbSuggestions();
  }, 450);
}

async function loadKbSuggestions() {
  const query = kbQuery();
  if (query.length < 3) {
    kbArticles.value = [];
    return;
  }
  kbLoading.value = true;
  try {
    const res = await listArticles({ search: query, limit: 3 });
    kbArticles.value = res?.success && Array.isArray(res.data) ? res.data.slice(0, 3) : [];
  } catch {
    kbArticles.value = [];
  } finally {
    kbLoading.value = false;
  }
}

function openArticle(article) {
  if (!article?._id) return;
  capturePortalCaseKbArticleClicked(String(article._id));
  emit('close');
  router.push({ name: 'portal-knowledge-article', params: { id: article._id } });
}

function removeUploaded(attachmentId) {
  uploadedAttachments.value = uploadedAttachments.value.filter((a) => a.attachmentId !== attachmentId);
}

async function handleFileSelect(e) {
  if (!props.allowAttachments) return;
  const files = Array.from(e.target?.files || []);
  if (!files.length) return;
  uploadingAttachments.value = true;
  uploadError.value = null;
  try {
    for (const file of files) {
      const data = await uploadPortalAttachment(file);
      uploadedAttachments.value.push(data);
    }
  } catch (err) {
    uploadError.value = err.message || t('cases.portalCasesAttachmentUploadFailed');
  } finally {
    uploadingAttachments.value = false;
    if (e?.target) e.target.value = '';
  }
}

async function submit() {
  creating.value = true;
  createError.value = null;
  try {
    const attachments = uploadedAttachments.value.map((a) => ({ attachmentId: a.attachmentId }));
    const res = await createCase({ ...form.value, attachments });
    if (res.success && res.data?._id) {
      capturePortalCaseCreated({ case_id: String(res.data._id) });
      emit('created', res.data);
      emit('close');
      resetForm();
    } else {
      createError.value = res.message || t('cases.portalCasesCreateFailed');
    }
  } catch (err) {
    createError.value = err.message || t('cases.portalCasesCreateFailed');
  } finally {
    creating.value = false;
  }
}
</script>
