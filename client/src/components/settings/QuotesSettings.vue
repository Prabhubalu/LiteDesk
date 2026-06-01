<template>
  <SettingsScrollPanel content-class="max-w-2xl" :save-bar-visible="!loading && !loadError && hasChanges">
    <template #header>
      <div>
        <button
          type="button"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
          @click="$emit('back')"
        >
          {{ t('actions.back') }}
        </button>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.quotesSettingsTitle') }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('settings.quotesSettingsDesc') }}</p>
      </div>
    </template>

    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-16">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <form v-else class="space-y-6" @submit.prevent="save">
      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.quotesApprovalPolicyTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.quotesApprovalPolicyHelp') }}</p>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            v-model="form.requireApprovalBeforeSend"
            type="checkbox"
            class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-900 dark:text-white block">{{ t('settings.quotesRequireApprovalLabel') }}</span>
            <span class="text-gray-500 dark:text-gray-400">{{ t('settings.quotesRequireApprovalHint') }}</span>
          </span>
        </label>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.quotesPortalAgreementTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.quotesPortalAgreementHelp') }}</p>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            v-model="form.requireCustomerAgreement"
            type="checkbox"
            class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-900 dark:text-white block">{{ t('settings.quotesRequireAgreementLabel') }}</span>
            <span class="text-gray-500 dark:text-gray-400">{{ t('settings.quotesRequireAgreementHint') }}</span>
          </span>
        </label>

        <div v-if="form.requireCustomerAgreement" class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.quotesAgreementTextLabel') }}
          </label>
          <textarea
            v-model="form.customerAgreementText"
            rows="3"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.quotesAgreementTextPlaceholder')"
          />
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            v-model="form.requireTypedSignature"
            type="checkbox"
            class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            <span class="font-medium text-gray-900 dark:text-white block">{{ t('settings.quotesRequireSignatureLabel') }}</span>
            <span class="text-gray-500 dark:text-gray-400">{{ t('settings.quotesRequireSignatureHint') }}</span>
          </span>
        </label>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.quotesBrandingTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.quotesBrandingHelp') }}</p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.quotesDocumentTitleLabel') }}
          </label>
          <input
            v-model="form.documentTitle"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.quotesDocumentTitlePlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.quotesBrandColorLabel') }}
          </label>
          <div class="flex items-center gap-3">
            <input
              v-model="form.brandColor"
              type="text"
              class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              placeholder="#4f46e5"
            />
            <input
              v-model="form.brandColor"
              type="color"
              class="h-10 w-12 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.quotesBrandColorHint') }}</p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.quotesPdfFooterLabel') }}
          </label>
          <textarea
            v-model="form.pdfFooterText"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.quotesPdfFooterPlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.quotesEmailSignatureLabel') }}
          </label>
          <textarea
            v-model="form.emailSignature"
            rows="4"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.quotesEmailSignaturePlaceholder')"
          />
        </div>
      </section>
    </form>

    <SettingsSaveBar
      :visible="!loading && !loadError && hasChanges"
      :saving="saving"
      @reset="resetForm"
      @save="save"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';

defineEmits(['back']);

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const saving = ref(false);
const loadError = ref(null);
const savedSnapshot = ref('');
const form = ref({
  requireApprovalBeforeSend: false,
  requireCustomerAgreement: false,
  requireTypedSignature: false,
  customerAgreementText: '',
  documentTitle: '',
  brandColor: '',
  pdfFooterText: '',
  emailSignature: ''
});

function serializeForm() {
  return JSON.stringify(form.value);
}

const hasChanges = computed(() => savedSnapshot.value !== '' && serializeForm() !== savedSnapshot.value);

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await apiClient.get('/settings/quotes');
    const s = res?.settings || {};
    form.value.requireApprovalBeforeSend = s.requireApprovalBeforeSend === true;
    form.value.requireCustomerAgreement = s.requireCustomerAgreement === true;
    form.value.requireTypedSignature = s.requireTypedSignature === true;
    form.value.customerAgreementText = String(s.customerAgreementText || '');
    form.value.documentTitle = String(s.documentTitle || '');
    form.value.brandColor = String(s.brandColor || '');
    form.value.pdfFooterText = String(s.pdfFooterText || '');
    form.value.emailSignature = String(s.emailSignature || '');
  } catch (e) {
    loadError.value = e?.message || t('settings.quotesSettingsLoadFailed');
  } finally {
    loading.value = false;
    savedSnapshot.value = serializeForm();
  }
}

function resetForm() {
  if (!savedSnapshot.value) return;
  form.value = JSON.parse(savedSnapshot.value);
}

function syncAuthOrgSettings(settings) {
  if (!authStore.organization) return;
  const org = { ...authStore.organization };
  org.settings = { ...(org.settings || {}), quotes: { ...settings } };
  authStore.organization = org;
  localStorage.setItem('organization', JSON.stringify(org));
}

async function save() {
  saving.value = true;
  try {
    const res = await apiClient.put('/settings/quotes', {
      requireApprovalBeforeSend: form.value.requireApprovalBeforeSend === true,
      requireCustomerAgreement: form.value.requireCustomerAgreement === true,
      requireTypedSignature: form.value.requireTypedSignature === true,
      customerAgreementText: String(form.value.customerAgreementText || '').trim(),
      documentTitle: String(form.value.documentTitle || '').trim(),
      brandColor: String(form.value.brandColor || '').trim(),
      pdfFooterText: String(form.value.pdfFooterText || '').trim(),
      emailSignature: String(form.value.emailSignature || '').trim()
    });
    if (res?.success) {
      syncAuthOrgSettings(res.settings || form.value);
      savedSnapshot.value = serializeForm();
      notifications.success(t('settings.quotesSettingsSaved'));
      return;
    }
    notifications.error(res?.message || t('settings.quotesSettingsSaveFailed'));
  } catch (e) {
    notifications.error(e?.message || t('settings.quotesSettingsSaveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
