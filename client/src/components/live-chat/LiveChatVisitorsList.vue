<template>
  <aside
    class="flex w-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:w-[320px]"
  >
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('liveChat.visitorsTitle') }}</h2>
        <button
          type="button"
          class="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          :title="t('actions.refresh')"
          @click="loadVisitors"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <input
        v-model.trim="search"
        type="search"
        class="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        :placeholder="t('liveChat.visitorsSearchPlaceholder')"
        @input="debouncedSearch"
      />
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error" class="p-4 text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>

    <div v-else-if="!visitors.length" class="flex flex-1 items-center justify-center p-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ emptyLabel }}</p>
    </div>

    <ul v-else class="min-h-0 flex-1 overflow-y-auto">
      <li v-for="visitor in visitors" :key="visitor._id">
        <button
          type="button"
          class="w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
          :class="selectedVisitorId === String(visitor._id) ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''"
          @click="$emit('select', visitor)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                {{ displayName(visitor) }}
              </p>
              <p v-if="visitor.email" class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                {{ visitor.email }}
              </p>
              <p v-if="visitor.externalId" class="mt-0.5 truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">
                {{ visitor.externalId }}
              </p>
            </div>
            <span class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
              {{ formatRelative(visitor.lastSeenAt) }}
            </span>
          </div>
          <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {{ t('liveChat.visitorSessionCount', { count: visitor.sessionCount || 0 }) }}
          </p>
        </button>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  selectedVisitorId: { type: String, default: '' },
});

defineEmits(['select']);

const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const visitors = ref([]);
const search = ref('');
let searchTimer = null;

const emptyLabel = computed(() =>
  search.value ? t('liveChat.visitorsSearchEmpty') : t('liveChat.visitorsEmpty'),
);

function displayName(visitor) {
  const name = String(visitor?.name || '').trim();
  if (name) return name;
  const email = String(visitor?.email || '').trim();
  if (email) return email;
  return t('liveChat.anonymousVisitor');
}

function formatRelative(value) {
  if (!value) return '';
  try {
    return formatUserDateTime(value);
  } catch {
    return '';
  }
}

async function loadVisitors() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/live-chat/visitors', {
      params: {
        limit: 100,
        search: search.value || undefined,
      },
    });
    visitors.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err?.message || t('liveChat.visitorsLoadFailed');
    visitors.value = [];
  } finally {
    loading.value = false;
  }
}

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadVisitors, 300);
}

watch(
  () => props.selectedVisitorId,
  () => {
    loadVisitors();
  },
);

onMounted(loadVisitors);

defineExpose({ reload: loadVisitors });
</script>
