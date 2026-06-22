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
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatQueuesTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatQueuesDesc') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          {{ t('settings.addonsLiveChatQueueAdd') }}
        </button>
      </div>
    </template>

    <div class="mb-4 max-w-3xl rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
      <p class="text-sm text-indigo-900 dark:text-indigo-200">{{ t('settings.addonsLiveChatQueuesAssignmentHint') }}</p>
      <RouterLink
        :to="assignmentRulesLink"
        class="mt-2 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
      >
        {{ t('settings.addonsLiveChatQueuesAssignmentLink') }}
      </RouterLink>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-4 max-w-3xl">
      <div
        v-if="!queues.length"
        class="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        {{ t('settings.addonsLiveChatQueuesEmpty') }}
      </div>

      <div
        v-for="queue in queues"
        :key="queue._id"
        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ queue.name }}</h3>
              <span
                v-if="queue.isDefault"
                class="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {{ t('settings.addonsLiveChatQueueDefault') }}
              </span>
              <span
                v-if="!queue.enabled"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ t('common.disabled') }}
              </span>
            </div>
            <p v-if="queue.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ queue.description }}</p>
            <p class="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">{{ queue.queueKey }}</p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
              @click="openEdit(queue)"
            >
              {{ t('actions.edit') }}
            </button>
            <button
              v-if="!queue.isDefault"
              type="button"
              class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-800 dark:text-red-300"
              @click="removeQueue(queue)"
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
        {{ editingId ? t('settings.addonsLiveChatQueueEdit') : t('settings.addonsLiveChatQueueAdd') }}
      </h3>
      <div class="mt-4 space-y-3">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatQueueName') }}
          <input
            v-model.trim="form.name"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatQueueKey') }}
          <input
            v-model.trim="form.queueKey"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatQueueDescription') }}
          <textarea
            v-model.trim="form.description"
            rows="2"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('common.enabled') }}
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input v-model="form.isDefault" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('settings.addonsLiveChatQueueDefault') }}
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
          :disabled="saving"
          @click="saveEditor"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['back']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const queues = ref([]);
const editorOpen = ref(false);
const editingId = ref('');
const form = ref(emptyForm());

const assignmentRulesLink = computed(() => ({
  path: '/settings',
  query: {
    tab: 'automation',
    automationView: 'assignment-rules',
    assignmentApp: 'PLATFORM',
    assignmentModule: 'live_chat_sessions',
  },
}));

function emptyForm() {
  return {
    name: '',
    queueKey: '',
    description: '',
    enabled: true,
    isDefault: false,
  };
}

async function loadQueues() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/live-chat/queues');
    queues.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err?.message || t('settings.addonsLiveChatQueuesLoadFailed');
    queues.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = '';
  form.value = emptyForm();
  editorOpen.value = true;
}

function openEdit(queue) {
  editingId.value = String(queue._id);
  form.value = {
    name: queue.name || '',
    queueKey: queue.queueKey || '',
    description: queue.description || '',
    enabled: queue.enabled !== false,
    isDefault: queue.isDefault === true,
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
      await apiClient.put(`/live-chat/queues/${editingId.value}`, payload);
    } else {
      await apiClient.post('/live-chat/queues', payload);
    }
    notifications.success(t('settings.addonsLiveChatQueuesSaved'));
    cancelEdit();
    await loadQueues();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatQueuesSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function removeQueue(queue) {
  if (!queue?._id || queue.isDefault) return;
  if (!window.confirm(t('settings.addonsLiveChatQueueDeleteConfirm'))) return;
  try {
    await apiClient.delete(`/live-chat/queues/${queue._id}`);
    notifications.success(t('settings.addonsLiveChatQueueDeleted'));
    await loadQueues();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatQueuesSaveFailed'));
  }
}

onMounted(loadQueues);
</script>
