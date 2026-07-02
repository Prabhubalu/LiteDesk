<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 mt-6">
    <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('templates.htmlImport.cssAllowlistTitle') }}
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('templates.htmlImport.cssAllowlistDescription') }}
      </p>
    </div>

    <div v-if="loadError" class="px-6 py-4 text-sm text-red-600 dark:text-red-400">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div v-else class="px-6 py-5 space-y-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ t('templates.htmlImport.cssAllowlistLabel') }}
      </label>
      <textarea
        v-model="allowlistText"
        rows="6"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
        :placeholder="t('templates.htmlImport.cssAllowlistPlaceholder')"
        :disabled="!canEdit || saving"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('templates.htmlImport.cssAllowlistHint') }}
      </p>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          :disabled="saving || !hasChanges || !canEdit"
          @click="resetAllowlist"
        >
          {{ t('actions.reset') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving || !hasChanges || !canEdit"
          @click="save"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { fetchCssAllowlist, saveCssAllowlist } from '../../services/htmlImportApi';

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const loadError = ref(null);
const allowlistText = ref('');
const savedAllowlistText = ref('');

const canEdit = computed(() => authStore.can('templates', 'edit'));
const hasChanges = computed(() => allowlistText.value !== savedAllowlistText.value);

function parseAllowlistText(text) {
  return String(text || '')
    .split(/\r?\n|,/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function formatAllowlistText(entries) {
  return (entries || []).join('\n');
}

function resetAllowlist() {
  allowlistText.value = savedAllowlistText.value;
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const allowlist = await fetchCssAllowlist();
    allowlistText.value = formatAllowlistText(allowlist);
    savedAllowlistText.value = allowlistText.value;
  } catch (error) {
    loadError.value = error?.message || t('templates.htmlImport.cssAllowlistLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const allowlist = parseAllowlistText(allowlistText.value);
    const saved = await saveCssAllowlist(allowlist);
    allowlistText.value = formatAllowlistText(saved);
    savedAllowlistText.value = allowlistText.value;
    notifications.success(t('templates.htmlImport.cssAllowlistSaved'));
  } catch (error) {
    notifications.error(error?.message || t('templates.htmlImport.cssAllowlistSaveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
