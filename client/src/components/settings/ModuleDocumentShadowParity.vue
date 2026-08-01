<template>
  <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
    <div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.moduleShadowParityTitle') }}</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.moduleShadowParityHelp') }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        {{ t('settings.moduleShadowParityModeLabel') }}: {{ renderModeLabel }}
      </span>
      <span
        v-if="summary.matchRate != null"
        class="rounded-full px-2.5 py-1 font-medium"
        :class="summary.matchRate === 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'"
      >
        {{ t('settings.moduleShadowParityMatchRate', { rate: summary.matchRate }) }}
      </span>
    </div>

    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-6">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.moduleShadowParityTotal') }}</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ summary.total }}</div>
        </div>
        <div class="rounded-lg border border-emerald-200 px-3 py-2 dark:border-emerald-900/50">
          <div class="text-xs text-emerald-700 dark:text-emerald-300">{{ t('settings.moduleShadowParityMatched') }}</div>
          <div class="text-lg font-semibold text-emerald-800 dark:text-emerald-200">{{ summary.matched }}</div>
        </div>
        <div class="rounded-lg border border-amber-200 px-3 py-2 dark:border-amber-900/50">
          <div class="text-xs text-amber-700 dark:text-amber-300">{{ t('settings.moduleShadowParityMismatched') }}</div>
          <div class="text-lg font-semibold text-amber-800 dark:text-amber-200">{{ summary.mismatched }}</div>
        </div>
        <div class="rounded-lg border border-red-200 px-3 py-2 dark:border-red-900/50">
          <div class="text-xs text-red-700 dark:text-red-300">{{ t('settings.moduleShadowParityErrors') }}</div>
          <div class="text-lg font-semibold text-red-800 dark:text-red-200">{{ summary.errors }}</div>
        </div>
      </div>

      <div v-if="canCompare" class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div class="flex-1 space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {{ t('settings.moduleShadowParityRecordLabel') }}
          </label>
          <input
            v-model="recordId"
            type="text"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.moduleShadowParityRecordPlaceholder')"
            :disabled="comparing"
          />
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="comparing || !recordId.trim()"
          @click="runCompare"
        >
          {{ comparing ? t('states.loading') : t('settings.moduleShadowParityCompare') }}
        </button>
      </div>

      <div v-if="recent.length" class="overflow-x-auto">
        <table class="min-w-full text-left text-xs">
          <thead class="text-gray-500 dark:text-gray-400">
            <tr>
              <th class="py-2 pr-3">{{ t('settings.moduleShadowParityColWhen') }}</th>
              <th class="py-2 pr-3">{{ t('settings.moduleShadowParityColRecord') }}</th>
              <th class="py-2 pr-3">{{ t('settings.moduleShadowParityColResult') }}</th>
              <th class="py-2 pr-3">{{ t('settings.moduleShadowParityColLegacy') }}</th>
              <th class="py-2">{{ t('settings.moduleShadowParityColPlatform') }}</th>
            </tr>
          </thead>
          <tbody class="text-gray-700 dark:text-gray-200">
            <tr v-for="row in recent" :key="row.id" class="border-t border-gray-100 dark:border-gray-700">
              <td class="py-2 pr-3 whitespace-nowrap">{{ formatWhen(row.createdAt) }}</td>
              <td class="py-2 pr-3">{{ row.recordLabel || row.recordId }}</td>
              <td class="py-2 pr-3">
                <span
                  class="rounded px-1.5 py-0.5 font-medium"
                  :class="resultClass(row)"
                >
                  {{ resultLabel(row) }}
                </span>
              </td>
              <td class="py-2 pr-3 font-mono">{{ shortHash(row.legacyChecksum) }}</td>
              <td class="py-2 font-mono">{{ row.platformChecksum ? shortHash(row.platformChecksum) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.moduleShadowParityEmpty') }}
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  moduleKey: {
    type: String,
    required: true,
    validator: (value) => ['quotes', 'invoices'].includes(String(value))
  }
});

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const comparing = ref(false);
const loadError = ref(null);
const renderMode = ref('legacy');
const summary = ref({ total: 0, matched: 0, mismatched: 0, errors: 0, matchRate: null });
const recent = ref([]);
const recordId = ref('');

const canCompare = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin' || authStore.user?.isPlatformAdmin === true;
});

const renderModeLabel = computed(() => {
  const mode = String(renderMode.value || 'legacy');
  if (mode === 'shadow') return t('settings.moduleShadowParityModeShadow');
  if (mode === 'platform') return t('settings.moduleShadowParityModePlatform');
  return t('settings.moduleShadowParityModeLegacy');
});

function shortHash(value) {
  const text = String(value || '');
  if (!text) return '—';
  return `${text.slice(0, 8)}…`;
}

function formatWhen(value) {
  if (!value) return '—';
  try {
    return formatUserDateTime(value) || String(value);
  } catch {
    return String(value);
  }
}

function resultLabel(row) {
  if (row.platformError) return t('settings.moduleShadowParityResultError');
  if (row.match === true) return t('settings.moduleShadowParityResultMatch');
  return t('settings.moduleShadowParityResultMismatch');
}

function resultClass(row) {
  if (row.platformError) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
  if (row.match === true) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const res = await apiClient.get(`/settings/content-platform/shadow-parity/${props.moduleKey}`);
    const data = res?.data || {};
    renderMode.value = data.renderMode || 'legacy';
    summary.value = data.summary || summary.value;
    recent.value = Array.isArray(data.recent) ? data.recent : [];
  } catch (e) {
    loadError.value = e?.message || t('settings.moduleShadowParityLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function runCompare() {
  if (!canCompare.value || !recordId.value.trim()) return;
  comparing.value = true;
  try {
    const res = await apiClient.post(`/settings/content-platform/shadow-parity/${props.moduleKey}/compare`, {
      recordId: recordId.value.trim()
    });
    const data = res?.data || {};
    if (data.match === true) {
      notifications.success(t('settings.moduleShadowParityCompareMatch'));
    } else if (data.platformError) {
      notifications.error(data.platformError);
    } else {
      notifications.warning(t('settings.moduleShadowParityCompareMismatch'));
    }
    await load();
  } catch (e) {
    notifications.error(e?.message || t('settings.moduleShadowParityCompareFailed'));
  } finally {
    comparing.value = false;
  }
}

onMounted(load);
</script>
