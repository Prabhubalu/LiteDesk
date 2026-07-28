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
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatBotsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatBotsDesc') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          {{ t('settings.addonsLiveChatBotAdd') }}
        </button>
      </div>
    </template>

    <div class="mb-4 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <p class="text-sm text-amber-900 dark:text-amber-200">{{ t('settings.addonsLiveChatBotsHint') }}</p>
    </div>

    <div
      v-if="deflection"
      class="mb-4 max-w-3xl rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/20"
    >
      <h3 class="text-sm font-semibold text-violet-900 dark:text-violet-100">
        {{ t('settings.addonsLiveChatBotDeflectionTitle') }}
      </h3>
      <p class="mt-1 text-xs text-violet-800/80 dark:text-violet-200/80">
        {{ t('settings.addonsLiveChatBotDeflectionHint', { days: deflection.windowDays }) }}
      </p>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-xs text-violet-700/70 dark:text-violet-300/70">{{ t('settings.addonsLiveChatBotDeflectionSessions') }}</dt>
          <dd class="font-semibold text-violet-950 dark:text-violet-50">{{ deflection.botSessions }}</dd>
        </div>
        <div>
          <dt class="text-xs text-violet-700/70 dark:text-violet-300/70">{{ t('settings.addonsLiveChatBotDeflectionContained') }}</dt>
          <dd class="font-semibold text-violet-950 dark:text-violet-50">{{ deflection.contained }}</dd>
        </div>
        <div>
          <dt class="text-xs text-violet-700/70 dark:text-violet-300/70">{{ t('settings.addonsLiveChatBotDeflectionEscalated') }}</dt>
          <dd class="font-semibold text-violet-950 dark:text-violet-50">{{ deflection.escalated }}</dd>
        </div>
        <div>
          <dt class="text-xs text-violet-700/70 dark:text-violet-300/70">{{ t('settings.addonsLiveChatBotDeflectionRate') }}</dt>
          <dd class="font-semibold text-violet-950 dark:text-violet-50">
            {{ deflection.deflectionRate == null ? '—' : `${Math.round(deflection.deflectionRate * 100)}%` }}
          </dd>
        </div>
      </dl>
      <p v-if="deflection.aiAnswered" class="mt-2 text-[11px] text-violet-800/80 dark:text-violet-200/80">
        {{ t('settings.addonsLiveChatBotDeflectionAiAnswered', { count: deflection.aiAnswered }) }}
      </p>
    </div>

    <div class="mb-4 max-w-3xl">
      <button
        type="button"
        class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        @click="emit('open-website-content')"
      >
        {{ t('settings.addonsLiveChatWebsiteContentManage') }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-4 max-w-3xl">
      <div
        v-if="!bots.length"
        class="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        {{ t('settings.addonsLiveChatBotsEmpty') }}
      </div>

      <div
        v-for="bot in bots"
        :key="bot._id"
        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ bot.name }}</h3>
              <span
                v-if="!bot.enabled"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ t('common.disabled') }}
              </span>
            </div>
            <p v-if="bot.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ bot.description }}</p>
            <p class="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">{{ bot.botKey }}</p>
            <p v-if="bot.greetingMessage" class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {{ bot.greetingMessage }}
            </p>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="bot.isDefault" class="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {{ t('settings.addonsLiveChatBotDefault') }}
              </span>
              <span v-if="bot.useKnowledgeBase !== false">{{ t('settings.addonsLiveChatBotSourceKb') }}</span>
              <span v-if="bot.useWebsiteContent !== false">{{ t('settings.addonsLiveChatBotSourceWebsite') }}</span>
              <span
                v-if="bot.aiAssist"
                class="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              >
                {{ t('settings.addonsLiveChatBotAiAssistBadge') }}
              </span>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
              @click="openEdit(bot)"
            >
              {{ t('actions.edit') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-800 dark:text-red-300"
              @click="removeBot(bot)"
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
        {{ editingId ? t('settings.addonsLiveChatBotEdit') : t('settings.addonsLiveChatBotAdd') }}
      </h3>
      <div class="mt-4 space-y-3">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotName') }}
          <input
            v-model.trim="form.name"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotKey') }}
          <input
            v-model.trim="form.botKey"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotDescription') }}
          <textarea
            v-model.trim="form.description"
            rows="2"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotGreeting') }}
          <textarea
            v-model.trim="form.greetingMessage"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            :placeholder="t('settings.addonsLiveChatBotGreetingPlaceholder')"
          />
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300" />
          {{ t('common.enabled') }}
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="form.isDefault" type="checkbox" class="rounded border-gray-300" />
          {{ t('settings.addonsLiveChatBotDefault') }}
        </label>
        <fieldset class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <legend class="px-1 text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.addonsLiveChatBotSources') }}</legend>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.useKnowledgeBase" type="checkbox" class="rounded border-gray-300" />
            {{ t('settings.addonsLiveChatBotSourceKb') }}
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.useWebsiteContent" type="checkbox" class="rounded border-gray-300" />
            {{ t('settings.addonsLiveChatBotSourceWebsite') }}
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.aiAssist" type="checkbox" class="rounded border-gray-300" />
            {{ t('settings.addonsLiveChatBotAiAssist') }}
          </label>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.addonsLiveChatBotAiAssistHint') }}</p>
        </fieldset>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotFallback') }}
          <textarea
            v-model.trim="form.fallbackMessage"
            rows="2"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsLiveChatBotConfidence') }}
          <input
            v-model.number="form.confidenceMinScore"
            type="number"
            min="1"
            max="20"
            class="mt-1 w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
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
          :disabled="saving || !form.name"
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
const emit = defineEmits(['back', 'open-website-content']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const bots = ref([]);
const editorOpen = ref(false);
const editingId = ref('');
const form = ref(emptyForm());
const deflection = ref(null);

function emptyForm() {
  return {
    name: '',
    botKey: '',
    description: '',
    greetingMessage: '',
    enabled: true,
    isDefault: false,
    useKnowledgeBase: true,
    useWebsiteContent: true,
    aiAssist: false,
    fallbackMessage: '',
    confidenceMinScore: 2,
  };
}

async function loadBots() {
  loading.value = true;
  error.value = '';
  try {
    const [res, metrics] = await Promise.all([
      apiClient.get('/live-chat/bots'),
      apiClient.get('/live-chat/bots/deflection-metrics').catch(() => null),
    ]);
    bots.value = Array.isArray(res?.data) ? res.data : [];
    deflection.value = metrics?.data || null;
  } catch (err) {
    error.value = err?.message || t('settings.addonsLiveChatBotsLoadFailed');
    bots.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = '';
  form.value = emptyForm();
  editorOpen.value = true;
}

function openEdit(bot) {
  editingId.value = String(bot._id);
  form.value = {
    name: bot.name || '',
    botKey: bot.botKey || '',
    description: bot.description || '',
    greetingMessage: bot.greetingMessage || '',
    enabled: bot.enabled !== false,
    isDefault: bot.isDefault === true,
    useKnowledgeBase: bot.useKnowledgeBase !== false,
    useWebsiteContent: bot.useWebsiteContent !== false,
    aiAssist: bot.aiAssist === true,
    fallbackMessage: bot.fallbackMessage || '',
    confidenceMinScore: Number(bot.confidenceMinScore) || 4,
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
      await apiClient.put(`/live-chat/bots/${editingId.value}`, payload);
    } else {
      await apiClient.post('/live-chat/bots', payload);
    }
    notifications.success(t('settings.addonsLiveChatBotsSaved'));
    cancelEdit();
    await loadBots();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatBotsSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function removeBot(bot) {
  if (!bot?._id) return;
  if (!await confirmAction(t('settings.addonsLiveChatBotDeleteConfirm'))) return;
  try {
    await apiClient.delete(`/live-chat/bots/${bot._id}`);
    notifications.success(t('settings.addonsLiveChatBotDeleted'));
    await loadBots();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatBotsSaveFailed'));
  }
}

onMounted(loadBots);
</script>
