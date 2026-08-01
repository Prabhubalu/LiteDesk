<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div v-else-if="error" class="flex flex-1 items-center justify-center p-8 text-sm text-rose-600 dark:text-rose-300">
      {{ error }}
    </div>
    <template v-else-if="visitor">
      <div class="border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:px-6">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ displayName }}</h2>
        <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div v-if="visitor.email">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorEmail') }}</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ visitor.email }}</dd>
          </div>
          <div v-if="visitor.phone">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorPhone') }}</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ visitor.phone }}</dd>
          </div>
          <div v-if="visitor.externalId">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorExternalId') }}</dt>
            <dd class="font-mono text-gray-900 dark:text-gray-100">{{ visitor.externalId }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorFirstSeen') }}</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ formatDate(visitor.firstSeenAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorLastSeen') }}</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ formatDate(visitor.lastSeenAt) }}</dd>
          </div>
          <div v-if="visitor.lastPageUrl">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('liveChat.visitorLastPage') }}</dt>
            <dd class="truncate text-gray-900 dark:text-gray-100">{{ visitor.lastPageUrl }}</dd>
          </div>
        </dl>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.visitorSessionsTitle') }}</h3>
        <p v-if="!sessions.length" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {{ t('liveChat.visitorNoSessions') }}
        </p>
        <ul v-else class="mt-3 space-y-2">
          <li v-for="session in sessions" :key="session._id">
            <button
              type="button"
              class="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
              @click="openSession(String(session._id))"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {{ sessionLabel(session) }}
                </span>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="session.status === 'closed'
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'"
                >
                  {{ session.status === 'closed' ? t('liveChat.filterClosed') : t('liveChat.filterOpen') }}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ formatDate(session.lastMessageAt || session.createdAt) }}
              </p>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLiveChatTabNavigation } from '@/composables/useLiveChatTabNavigation';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  visitorId: { type: String, required: true },
});

const { t } = useI18n();
const { openSession } = useLiveChatTabNavigation();

const loading = ref(true);
const error = ref('');
const visitor = ref(null);
const sessions = ref([]);

const displayName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (name) return name;
  const email = String(visitor.value?.email || '').trim();
  if (email) return email;
  return t('liveChat.anonymousVisitor');
});

function formatDate(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value);
  } catch {
    return '—';
  }
}

function sessionLabel(session) {
  const key = String(session?.sessionKey || '').trim();
  if (key) return key;
  const name = String(session?.visitor?.name || '').trim();
  if (name) return name;
  return t('liveChat.visitor');
}

async function load() {
  const id = String(props.visitorId || '').trim();
  if (!id) return;

  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/live-chat/visitors/${id}`);
    if (!res?.success || !res.data) {
      error.value = t('liveChat.visitorLoadFailed');
      visitor.value = null;
      sessions.value = [];
      return;
    }
    visitor.value = res.data;
    sessions.value = Array.isArray(res.data.sessions) ? res.data.sessions : [];
  } catch (err) {
    error.value = err?.message || t('liveChat.visitorLoadFailed');
    visitor.value = null;
    sessions.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visitorId,
  () => load(),
  { immediate: true },
);
</script>
