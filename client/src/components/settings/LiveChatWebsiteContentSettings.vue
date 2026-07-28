<template>
  <SettingsScrollPanel>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            :title="t('settings.addonsBackToHub')"
            @click="emit('back')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatWebsiteContentTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatWebsiteContentDesc') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          {{ t('settings.addonsLiveChatWebsiteContentAdd') }}
        </button>
      </div>
    </template>

    <div class="mb-4 max-w-3xl rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
      <p class="text-sm text-indigo-900 dark:text-indigo-200">{{ t('settings.addonsLiveChatWebsiteContentHint') }}</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-4 max-w-3xl">
      <div
        v-if="!pages.length"
        class="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        {{ t('settings.addonsLiveChatWebsiteContentEmpty') }}
      </div>

      <div
        v-for="page in pages"
        :key="page._id"
        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ page.title }}</h3>
              <span
                v-if="!page.enabled"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ t('common.disabled') }}
              </span>
            </div>
            <p class="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">{{ page.pageKey }}</p>
            <p v-if="page.matchPath" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.addonsLiveChatWebsiteContentMatchPath') }}: {{ page.matchPath }}
            </p>
            <p v-if="page.body" class="mt-2 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">{{ page.body }}</p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
              @click="openEdit(page)"
            >
              {{ t('actions.edit') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-800 dark:text-red-300"
              @click="removePage(page)"
            >
              {{ t('actions.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>

  <div
    v-if="editorOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ editingId ? t('settings.addonsLiveChatWebsiteContentEdit') : t('settings.addonsLiveChatWebsiteContentAdd') }}
      </h3>
      <div class="mt-4 space-y-3">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatWebsiteContentTitleLabel') }}
          <input
            v-model.trim="form.title"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatWebsiteContentKey') }}
          <input
            v-model.trim="form.pageKey"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatWebsiteContentMatchPath') }}
          <input
            v-model.trim="form.matchPath"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            :placeholder="t('settings.addonsLiveChatWebsiteContentMatchPathPlaceholder')"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatWebsiteContentBody') }}
          <textarea
            v-model.trim="form.body"
            rows="6"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300" />
          {{ t('common.enabled') }}
        </label>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="cancelEdit"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving || !form.title"
          @click="saveEditor"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

import { confirmAction } from '@/composables/useConfirmAction';
const emit = defineEmits(['back']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const pages = ref([]);
const editorOpen = ref(false);
const editingId = ref('');
const form = ref(emptyForm());

function emptyForm() {
  return {
    title: '',
    pageKey: '',
    body: '',
    matchPath: '',
    enabled: true,
  };
}

async function loadPages() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/live-chat/website-content');
    pages.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err?.message || t('settings.addonsLiveChatWebsiteContentLoadFailed');
    pages.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = '';
  form.value = emptyForm();
  editorOpen.value = true;
}

function openEdit(page) {
  editingId.value = String(page._id);
  form.value = {
    title: page.title || '',
    pageKey: page.pageKey || '',
    body: page.body || '',
    matchPath: page.matchPath || '',
    enabled: page.enabled !== false,
  };
  editorOpen.value = true;
}

function cancelEdit() {
  editorOpen.value = false;
  editingId.value = '';
  form.value = emptyForm();
}

async function saveEditor() {
  if (saving.value) return;
  saving.value = true;
  try {
    const payload = { ...form.value };
    if (editingId.value) {
      await apiClient.put(`/live-chat/website-content/${editingId.value}`, payload);
    } else {
      await apiClient.post('/live-chat/website-content', payload);
    }
    notifications.success(t('settings.addonsLiveChatWebsiteContentSaved'));
    cancelEdit();
    await loadPages();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatWebsiteContentSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function removePage(page) {
  if (!page?._id) return;
  if (!await confirmAction(t('settings.addonsLiveChatWebsiteContentDeleteConfirm'))) return;
  try {
    await apiClient.delete(`/live-chat/website-content/${page._id}`);
    notifications.success(t('settings.addonsLiveChatWebsiteContentDeleted'));
    await loadPages();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatWebsiteContentSaveFailed'));
  }
}

onMounted(loadPages);
</script>
