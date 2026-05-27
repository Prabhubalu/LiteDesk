<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <div v-if="error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
    </div>

    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{{ t('cases.portalCasesTitle') }}</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">{{ t('cases.portalCasesSubtitle') }}</p>
      </div>
      <button
        v-if="canCreateCase"
        type="button"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        @click="showCreate = true"
      >
        {{ t('cases.portalCasesNew') }}
      </button>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="h-24 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse" />
    </div>

    <div v-else-if="cases.length === 0" class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ t('cases.portalCasesEmptyTitle') }}</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">{{ t('cases.portalCasesEmptyMessage') }}</p>
      <button
        v-if="canCreateCase"
        type="button"
        class="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        @click="showCreate = true"
      >
        {{ t('cases.portalCasesNew') }}
      </button>
      <p v-else class="text-sm text-gray-600 dark:text-gray-400">{{ t('cases.portalCasesPartnerNoCreate') }}</p>
    </div>

    <div v-else class="space-y-3">
      <button
        v-for="item in cases"
        :key="item._id"
        type="button"
        class="w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
        @click="openCase(item._id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ item.caseId }}</p>
            <h3 class="mt-0.5 text-base font-semibold text-gray-900 dark:text-white truncate">{{ item.title }}</h3>
            <p v-if="item.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ item.description }}</p>
          </div>
          <span
            class="shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="statusClass(item.status)"
          >
            {{ item.status }}
          </span>
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('cases.portalCasesUpdated', { date: formatDate(item.updatedAt) }) }}
        </p>
      </button>
    </div>

    <!-- Create case modal -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeCreate"
      >
        <div class="fixed inset-0 bg-black/50" />
        <div class="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('cases.portalCasesCreateTitle') }}</h2>
          <form class="mt-4 space-y-4" @submit.prevent="submitCreate">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('cases.portalCasesFieldTitle') }} *</label>
              <input
                v-model="createForm.title"
                type="text"
                required
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('cases.portalCasesFieldDescription') }} *</label>
              <textarea
                v-model="createForm.description"
                required
                rows="4"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('cases.portalCasesFieldPriority') }}</label>
              <select
                v-model="createForm.priority"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('cases.portalCasesAttachmentsLabel') }}
              </label>
              <input
                type="file"
                multiple
                class="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-100 dark:hover:file:bg-gray-600"
                :disabled="creating || uploadingCreateAttachments"
                @change="handleCreateFileSelect"
              />
              <p v-if="createUploadError" class="text-sm text-red-600 dark:text-red-400">{{ createUploadError }}</p>
              <div v-if="createUploadedAttachments.length" class="flex flex-wrap gap-2">
                <span
                  v-for="att in createUploadedAttachments"
                  :key="att.attachmentId"
                  class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <span class="max-w-[220px] truncate" :title="att.originalFileName">{{ att.originalFileName }}</span>
                  <button
                    type="button"
                    class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    :disabled="creating || uploadingCreateAttachments"
                    @click="removeCreateUploaded(att.attachmentId)"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>
            <p v-if="createError" class="text-sm text-red-600 dark:text-red-400">{{ createError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                @click="closeCreate"
              >
                {{ t('actions.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="creating || uploadingCreateAttachments"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {{ creating ? t('cases.portalCasesSubmitting') : t('cases.portalCasesSubmit') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { usePortalCases } from '@/composables/usePortalCases';
import portalApiClient from '@/utils/portalApiClient';
import { uploadPortalAttachment } from '@/utils/portalAttachmentUpload';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { listCases, createCase } = usePortalCases();

const loading = ref(true);
const error = ref(null);
const cases = ref([]);
const canCreateCase = ref(true);
const showCreate = ref(false);
const creating = ref(false);
const createError = ref(null);
const uploadingCreateAttachments = ref(false);
const createUploadError = ref(null);
const createUploadedAttachments = ref([]);
const createForm = ref({
  title: '',
  description: '',
  priority: 'Medium'
});

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed' || s === 'resolved') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (s === 'new') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
}

function openCase(id) {
  router.push({ name: 'portal-case-detail', params: { id } });
}

function closeCreate() {
  showCreate.value = false;
  createError.value = null;
  createUploadError.value = null;
  createUploadedAttachments.value = [];
}

function removeCreateUploaded(attachmentId) {
  createUploadedAttachments.value = createUploadedAttachments.value.filter(
    (a) => a.attachmentId !== attachmentId
  );
}

async function handleCreateFileSelect(e) {
  const files = Array.from(e.target?.files || []);
  if (!files.length) return;
  uploadingCreateAttachments.value = true;
  createUploadError.value = null;
  try {
    for (const file of files) {
      const data = await uploadPortalAttachment(file);
      createUploadedAttachments.value.push(data);
    }
  } catch (err) {
    createUploadError.value = err.message || t('cases.portalCasesAttachmentUploadFailed');
  } finally {
    uploadingCreateAttachments.value = false;
    if (e?.target) e.target.value = '';
  }
}

async function submitCreate() {
  creating.value = true;
  createError.value = null;
  try {
    const attachments = createUploadedAttachments.value.map((a) => ({ attachmentId: a.attachmentId }));
    const res = await createCase({ ...createForm.value, attachments });
    if (res.success && res.data?._id) {
      closeCreate();
      createForm.value = { title: '', description: '', priority: 'Medium' };
      await fetchCases();
      router.push({ name: 'portal-case-detail', params: { id: res.data._id } });
    } else {
      createError.value = res.message || t('cases.portalCasesCreateFailed');
    }
  } catch (err) {
    createError.value = err.message || t('cases.portalCasesCreateFailed');
  } finally {
    creating.value = false;
  }
}

async function fetchCases() {
  if (!authStore.isAuthenticated || !authStore.user?.token) {
    error.value = t('cases.portalCasesAuthRequired');
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const res = await listCases({ limit: 50 });
    if (res.success) {
      cases.value = Array.isArray(res.data) ? res.data : [];
    } else {
      error.value = res.message || t('cases.portalCasesLoadFailed');
    }
  } catch (err) {
    if (err.status === 401) {
      error.value = t('cases.portalCasesSessionExpired');
    } else if (err.status === 403) {
      error.value = t('cases.portalCasesAccessDenied');
    } else {
      error.value = err.message || t('cases.portalCasesLoadFailed');
    }
  } finally {
    loading.value = false;
  }
}

async function loadPortalCapabilities() {
  try {
    const res = await portalApiClient.get('/me');
    if (res.success && res.data?.portalCapabilities) {
      canCreateCase.value = res.data.portalCapabilities.allowCreateCase !== false;
    }
  } catch {
    canCreateCase.value = true;
  }
}

onMounted(async () => {
  await Promise.all([loadPortalCapabilities(), fetchCases()]);
});
</script>
