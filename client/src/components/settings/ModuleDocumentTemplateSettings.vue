<template>
  <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
    <div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
    </div>

    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-6">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <template v-else>
      <div v-if="!templates.length" class="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
        <p>{{ t('settings.moduleDocumentTemplateEmpty') }}</p>
        <RouterLink
          to="/templates"
          class="mt-2 inline-flex text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {{ t('settings.moduleDocumentTemplateGoTemplates') }}
        </RouterLink>
      </div>

      <div v-else class="space-y-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {{ t('settings.moduleDocumentTemplateLabel') }}
        </label>
        <select
          v-model="selectedTemplateId"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          :disabled="saving"
        >
          <option value="">{{ t('settings.moduleDocumentTemplateAuto') }}</option>
          <option v-for="template in templates" :key="template.id" :value="template.id">
            {{ template.name }}
            <template v-if="template.latestPublishedVersion"> (v{{ template.latestPublishedVersion }})</template>
          </option>
        </select>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.moduleDocumentTemplateHint') }}
        </p>
      </div>

      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          :disabled="saving || !hasChanges"
          @click="resetSelection"
        >
          {{ t('actions.reset') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving || !hasChanges || !canSave"
          @click="save"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  moduleKey: {
    type: String,
    required: true,
    validator: (value) => ['quotes', 'invoices'].includes(String(value))
  },
  titleKey: {
    type: String,
    required: true
  },
  descriptionKey: {
    type: String,
    required: true
  }
});

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const saving = ref(false);
const loadError = ref(null);
const templates = ref([]);
const selectedTemplateId = ref('');
const savedTemplateId = ref('');

const title = computed(() => t(props.titleKey));
const description = computed(() => t(props.descriptionKey));

const canSave = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin' || authStore.user?.isPlatformAdmin === true;
});

const hasChanges = computed(() => selectedTemplateId.value !== savedTemplateId.value);

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await apiClient.get(`/settings/content-platform/documents/${props.moduleKey}`);
    const data = res?.data || {};
    templates.value = Array.isArray(data.templates) ? data.templates : [];
    selectedTemplateId.value = String(data.defaultTemplateId || '');
    savedTemplateId.value = selectedTemplateId.value;
  } catch (e) {
    loadError.value = e?.message || t('settings.moduleDocumentTemplateLoadFailed');
  } finally {
    loading.value = false;
  }
}

function resetSelection() {
  selectedTemplateId.value = savedTemplateId.value;
}

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const res = await apiClient.put(`/settings/content-platform/documents/${props.moduleKey}`, {
      defaultTemplateId: selectedTemplateId.value || null
    });
    const data = res?.data || {};
    templates.value = Array.isArray(data.templates) ? data.templates : templates.value;
    selectedTemplateId.value = String(data.defaultTemplateId || '');
    savedTemplateId.value = selectedTemplateId.value;
    notifications.success(t('settings.moduleDocumentTemplateSaved'));
  } catch (e) {
    notifications.error(e?.message || t('settings.moduleDocumentTemplateSaveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
