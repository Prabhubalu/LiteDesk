<template>
  <SettingsScrollPanel content-class="max-w-2xl">
    <template #header>
      <div>
        <button
          type="button"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
          @click="$emit('back')"
        >
          {{ t('actions.back') }}
        </button>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.invoicesSettingsTitle') }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('settings.invoicesSettingsDesc') }}</p>
      </div>
    </template>

    <div class="space-y-6">
      <ModuleDocumentTemplateSettings
        module-key="invoices"
        title-key="settings.invoicesDocumentTemplateTitle"
        description-key="settings.invoicesDocumentTemplateHelp"
      />

      <ModuleDocumentShadowParity module-key="invoices" />

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.invoicesBrandingNoteTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.invoicesBrandingNoteHelp') }}</p>
        <button
          type="button"
          class="mt-3 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          @click="goToQuoteBranding"
        >
          {{ t('settings.invoicesBrandingNoteLink') }}
        </button>
      </section>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import ModuleDocumentTemplateSettings from '@/components/settings/ModuleDocumentTemplateSettings.vue';
import ModuleDocumentShadowParity from '@/components/settings/ModuleDocumentShadowParity.vue';

defineEmits(['back']);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

function goToQuoteBranding() {
  router.push({
    path: '/settings',
    query: { ...route.query, tab: 'automation', automationView: 'quotes' }
  });
}
</script>
