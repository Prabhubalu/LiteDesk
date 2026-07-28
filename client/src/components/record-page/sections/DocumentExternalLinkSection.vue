<template>
  <section v-if="record?._id" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ providerLabel }}
        </p>
        <p v-if="record.externalUrl" class="break-all text-xs text-gray-500 dark:text-gray-400">
          {{ record.externalUrl }}
        </p>
        <p
          v-if="record.externalLinkStatus === 'unavailable'"
          class="text-xs font-medium text-red-600 dark:text-red-400"
        >
          {{ t('documents.externalLinkUnavailable') }}
        </p>
        <p
          v-else-if="record.externalLinkStatus === 'available'"
          class="text-xs text-green-600 dark:text-green-400"
        >
          {{ t('documents.externalLinkAvailable') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="canCheck"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          :disabled="checking"
          @click="handleCheckLink"
        >
          {{ checking ? t('documents.externalLinkChecking') : t('documents.externalLinkCheck') }}
        </button>
        <button
          v-if="record.externalUrl"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openExternal"
        >
          {{ t('documents.openExternalLink') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDocuments } from '@/composables/useDocuments';
import { useNotifications } from '@/composables/useNotifications';
import { resolveExternalProvider } from '@/utils/documentExternalProviders';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const { checkExternalLink } = useDocuments();
const checking = ref(false);

const canCheck = computed(() => props.context?.canCheckExternalLink !== false);

const providerLabel = computed(() => {
  const provider = resolveExternalProvider(props.record?.sourceProvider, props.record?.externalUrl);
  if (provider === 'google_drive') return t('documents.externalProviderGoogleDrive');
  if (provider === 'onedrive') return t('documents.externalProviderOneDrive');
  if (provider === 'dropbox') return t('documents.externalProviderDropbox');
  return t('documents.typeExternalLink');
});

async function handleCheckLink() {
  if (!props.record?._id || checking.value) return;
  checking.value = true;
  try {
    const response = await checkExternalLink(props.record._id);
    if (!response?.success) {
      notifications.error(response?.message || t('documents.externalLinkCheckFailed'));
      return;
    }
    if (response.data && props.record) {
      Object.assign(props.record, response.data);
    }
    const status = response.data?.externalLinkStatus;
    if (status === 'unavailable') {
      notifications.warning(t('documents.externalLinkUnavailable'));
    } else {
      notifications.success(t('documents.externalLinkCheckSuccess'));
    }
    props.context?.onExternalLinkUpdated?.();
  } catch (error) {
    notifications.error(error?.message || t('documents.externalLinkCheckFailed'));
  } finally {
    checking.value = false;
  }
}

async function openExternal() {
  const url = String(props.record?.externalUrl || '').trim();
  if (!url) return;
  if (props.record?.externalLinkStatus === 'unavailable') {
    const proceed = await confirmAction(t('documents.externalLinkUnavailableConfirm'));
    if (!proceed) return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
</script>
