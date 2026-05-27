<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <div v-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <button
      type="button"
      class="mb-4 inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      @click="router.push({ name: 'portal-case-list' })"
    >
      ← {{ t('cases.portalCasesBack') }}
    </button>

    <div v-if="loading" class="h-48 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />

    <template v-else-if="caseRecord">
      <header class="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ caseRecord.caseId }}</p>
        <h1 class="mt-1 text-xl font-bold text-gray-900 dark:text-white">{{ caseRecord.title }}</h1>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statusClass(caseRecord.status)">
            {{ caseRecord.status }}
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ caseRecord.priority }}</span>
        </div>
        <p v-if="caseRecord.description" class="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {{ caseRecord.description }}
        </p>
      </header>

      <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('cases.portalCasesConversation') }}</h2>
        </div>

        <div class="max-h-[50vh] overflow-y-auto p-4 space-y-4">
          <p v-if="!activities.length" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {{ t('cases.portalCasesNoMessages') }}
          </p>
          <div
            v-for="(act, idx) in activities"
            :key="act._id || idx"
            class="flex"
            :class="isFromCustomer(act) ? '' : 'justify-end'"
          >
            <div
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
              :class="isFromCustomer(act)
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                : 'bg-blue-600 text-white'"
            >
              <p class="text-xs font-medium opacity-80 mb-1">{{ act.actorName || t('cases.portalCasesSupport') }}</p>
              <p class="whitespace-pre-wrap break-words">{{ act.message || '—' }}</p>
              <p class="mt-1 text-[10px] opacity-70">{{ formatDate(act.createdAt) }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="canReply"
          class="border-t border-gray-200 dark:border-gray-700 p-4"
        >
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('cases.portalCasesReplyLabel') }}</label>
          <textarea
            v-model="replyBody"
            rows="3"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            :placeholder="t('cases.portalCasesReplyPlaceholder')"
          />
          <div class="mt-3 flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('cases.portalCasesAttachmentsLabel') }}
            </label>
            <input
              type="file"
              multiple
              class="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-100 dark:hover:file:bg-gray-600"
              :disabled="replying || uploading"
              @change="handleFileSelect"
            />
            <p v-if="uploadError" class="text-sm text-red-600 dark:text-red-400">{{ uploadError }}</p>
            <div v-if="uploadedAttachments.length" class="flex flex-wrap gap-2">
              <span
                v-for="att in uploadedAttachments"
                :key="att.attachmentId"
                class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                <span class="max-w-[220px] truncate" :title="att.originalFileName">{{ att.originalFileName }}</span>
                <button
                  type="button"
                  class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  :disabled="replying || uploading"
                  @click="removeUploaded(att.attachmentId)"
                >
                  ✕
                </button>
              </span>
            </div>
          </div>
          <p v-if="replyError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ replyError }}</p>
          <button
            type="button"
            :disabled="replying || uploading || (!replyBody.trim() && uploadedAttachments.length === 0)"
            class="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="submitReply"
          >
            {{ replying ? t('cases.portalCasesReplySending') : t('cases.portalCasesReplySend') }}
          </button>
        </div>
        <p v-else class="border-t border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
          {{ t('cases.portalCasesClosedNoReply') }}
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { usePortalCases } from '@/composables/usePortalCases';
import { uploadPortalAttachment } from '@/utils/portalAttachmentUpload';
import portalApiClient from '@/utils/portalApiClient';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { getCase, replyToCase } = usePortalCases();

const loading = ref(true);
const error = ref(null);
const caseRecord = ref(null);
const replyBody = ref('');
const replying = ref(false);
const replyError = ref(null);
const uploading = ref(false);
const uploadError = ref(null);
const uploadedAttachments = ref([]);
const allowReplyByCapability = ref(true);

const activities = computed(() => {
  const list = caseRecord.value?.activities;
  return Array.isArray(list) ? list : [];
});

const canReply = computed(() => {
  const s = String(caseRecord.value?.status || '');
  return s !== 'Closed' && s !== 'Resolved' && allowReplyByCapability.value !== false;
});

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed' || s === 'resolved') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
}

function isFromCustomer(act) {
  const type = String(act?.activityType || '');
  if (type === 'channel_message_received' || type === 'email_received') return true;
  const email = String(authStore.user?.email || '').toLowerCase();
  const actor = String(act?.actorName || '').toLowerCase();
  return email && actor.includes(email);
}

async function loadCase() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getCase(route.params.id);
    if (res.success) {
      caseRecord.value = res.data;
    } else {
      error.value = res.message || t('cases.portalCasesLoadFailed');
    }
  } catch (err) {
    error.value = err.message || t('cases.portalCasesLoadFailed');
    if (err.status === 404) {
      error.value = t('cases.portalCasesNotFound');
    }
  } finally {
    loading.value = false;
  }
}

async function submitReply() {
  if (!replyBody.value.trim() || !caseRecord.value?._id) return;
  replying.value = true;
  replyError.value = null;
  try {
    const res = await replyToCase(caseRecord.value._id, {
      body: replyBody.value.trim(),
      subject: `Re: ${caseRecord.value.title || 'Case'}`,
      attachments: uploadedAttachments.value.map((a) => ({ attachmentId: a.attachmentId }))
    });
    if (res.success) {
      replyBody.value = '';
      uploadedAttachments.value = [];
      await loadCase();
    } else {
      replyError.value = res.message || t('cases.portalCasesReplyFailed');
    }
  } catch (err) {
    replyError.value = err.message || t('cases.portalCasesReplyFailed');
  } finally {
    replying.value = false;
  }
}

function removeUploaded(attachmentId) {
  uploadedAttachments.value = uploadedAttachments.value.filter((a) => a.attachmentId !== attachmentId);
}

async function handleFileSelect(e) {
  const files = Array.from(e?.target?.files || []);
  // Reset input so selecting the same file again works.
  try { e.target.value = ''; } catch (_) {}
  if (!files.length) return;

  uploading.value = true;
  uploadError.value = null;
  try {
    for (const file of files) {
      const data = await uploadPortalAttachment(file);
      if (!data?.attachmentId) continue;
      uploadedAttachments.value.push(data);
    }
  } catch (err) {
    uploadError.value = err.message || t('cases.portalCasesAttachmentUploadFailed');
  } finally {
    uploading.value = false;
  }
}

async function loadPortalCapabilities() {
  try {
    const res = await portalApiClient.get('/me');
    if (res.success && res.data?.portalCapabilities) {
      allowReplyByCapability.value = res.data.portalCapabilities.allowReply !== false;
    }
  } catch {
    allowReplyByCapability.value = true;
  }
}

watch(() => route.params.id, loadCase);
onMounted(async () => {
  await Promise.all([loadPortalCapabilities(), loadCase()]);
});
</script>
