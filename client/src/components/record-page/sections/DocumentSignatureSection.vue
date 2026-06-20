<template>
  <section v-if="record?._id" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.signaturesTitle') }}</h3>
      <button
        v-if="canManage"
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        @click="showCreate = !showCreate"
      >
        {{ showCreate ? t('actions.cancel') : t('documents.signaturesRequest') }}
      </button>
    </div>

    <div v-if="showCreate && canManage" class="mb-4 space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <textarea
        v-model="messageInput"
        rows="2"
        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        :placeholder="t('documents.signaturesMessagePlaceholder')"
      />
      <div class="space-y-2">
        <div v-for="(signer, index) in signersInput" :key="index" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            v-model="signer.name"
            type="text"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            :placeholder="t('documents.signaturesSignerName')"
          />
          <input
            v-model="signer.email"
            type="email"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            :placeholder="t('documents.signaturesSignerEmail')"
          />
        </div>
        <button type="button" class="text-xs font-medium text-indigo-600 dark:text-indigo-400" @click="addSigner">
          {{ t('documents.signaturesAddSigner') }}
        </button>
      </div>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="creating"
        @click="createRequest"
      >
        {{ creating ? t('documents.signaturesCreating') : t('documents.signaturesSendRequest') }}
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('documents.signaturesLoading') }}</div>
    <p v-else-if="!requests.length" class="text-sm text-gray-500 dark:text-gray-400">{{ t('documents.signaturesEmpty') }}</p>

    <div v-else class="space-y-3">
      <article
        v-for="request in requests"
        :key="request._id"
        class="rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ statusLabel(request.status) }}</p>
          <button
            v-if="canManage && !['completed', 'cancelled'].includes(request.status)"
            type="button"
            class="text-xs text-red-600 dark:text-red-400"
            @click="cancelRequest(request._id)"
          >
            {{ t('documents.signaturesCancel') }}
          </button>
        </div>
        <p v-if="request.message" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ request.message }}</p>
        <ul class="mt-2 space-y-1">
          <li v-for="(signer, index) in request.signers || []" :key="`${request._id}-${index}`" class="text-xs text-gray-600 dark:text-gray-400">
            {{ signer.name || signer.email }} — {{ signer.status }}
          </li>
        </ul>

        <div v-if="canSignRequest(request)" class="mt-3 space-y-2">
          <input
            v-model="signatureInputs[request._id]"
            type="text"
            class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            :placeholder="t('documents.signaturesTypeSignature')"
          />
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="signingId === request._id"
            @click="signRequest(request._id)"
          >
            {{ signingId === request._id ? t('documents.signaturesSigning') : t('documents.signaturesSign') }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const {
  fetchDocumentSignatureRequests,
  createDocumentSignatureRequest,
  signDocumentSignatureRequest,
  cancelDocumentSignatureRequest
} = useDocuments();

const requests = ref([]);
const loading = ref(false);
const creating = ref(false);
const signingId = ref('');
const showCreate = ref(false);
const messageInput = ref('');
const signersInput = ref([{ name: '', email: '' }]);
const signatureInputs = reactive({});

const canManage = computed(() => props.context?.canEdit !== false);
const userEmail = computed(() => String(authStore.user?.email || '').toLowerCase());

function statusLabel(status) {
  const key = `documents.signaturesStatus${String(status || 'draft').replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function addSigner() {
  signersInput.value.push({ name: '', email: '' });
}

function canSignRequest(request) {
  if (!['sent', 'partially_signed'].includes(request.status)) return false;
  return (request.signers || []).some((signer) => {
    if (signer.status !== 'pending') return false;
    if (signer.email && signer.email.toLowerCase() === userEmail.value) return true;
    return signer.userId && String(signer.userId) === String(authStore.user?._id || '');
  });
}

async function loadRequests() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const response = await fetchDocumentSignatureRequests(props.record._id);
    requests.value = response?.data || [];
  } catch (error) {
    notifications.error(error?.message || t('documents.signaturesLoadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createRequest() {
  if (!props.record?._id) return;
  creating.value = true;
  try {
    const signers = signersInput.value
      .map((signer, index) => ({
        name: signer.name.trim(),
        email: signer.email.trim(),
        order: index + 1
      }))
      .filter((signer) => signer.email);
    const response = await createDocumentSignatureRequest(props.record._id, {
      message: messageInput.value.trim(),
      signers,
      send: true
    });
    if (!response?.success) {
      notifications.error(response?.message || t('documents.signaturesCreateFailed'));
      return;
    }
    showCreate.value = false;
    messageInput.value = '';
    signersInput.value = [{ name: '', email: '' }];
    await loadRequests();
    notifications.success(t('documents.signaturesCreateSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.signaturesCreateFailed'));
  } finally {
    creating.value = false;
  }
}

async function signRequest(requestId) {
  if (!props.record?._id) return;
  signingId.value = requestId;
  try {
    const response = await signDocumentSignatureRequest(props.record._id, requestId, {
      signatureText: signatureInputs[requestId]
    });
    if (!response?.success) {
      notifications.error(response?.message || t('documents.signaturesSignFailed'));
      return;
    }
    signatureInputs[requestId] = '';
    await loadRequests();
    notifications.success(t('documents.signaturesSignSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('documents.signaturesSignFailed'));
  } finally {
    signingId.value = '';
  }
}

async function cancelRequest(requestId) {
  try {
    const response = await cancelDocumentSignatureRequest(props.record._id, requestId);
    if (!response?.success) {
      notifications.error(response?.message || t('documents.signaturesCancelFailed'));
      return;
    }
    await loadRequests();
  } catch (error) {
    notifications.error(error?.message || t('documents.signaturesCancelFailed'));
  }
}

watch(() => props.record?._id, () => {
  void loadRequests();
});

onMounted(() => {
  void loadRequests();
});
</script>
