<template>
  <SettingsScrollPanel>
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ t('settings.auditLogTitle') }}
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.auditLogSubtitle') }}
        </p>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ t('settings.auditLogFilterArea') }}
          </label>
          <select
            v-model="filters.surface"
            class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2"
            @change="reload"
          >
            <option value="">{{ t('settings.auditLogFilterAll') }}</option>
            <option v-for="s in surfaceOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </div>
        <button
          type="button"
          class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          @click="reload"
        >
          {{ t('settings.auditLogRefresh') }}
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
        </div>
        <div v-else-if="error" class="p-6 text-sm text-red-600 dark:text-red-400">
          {{ error }}
        </div>
        <div v-else-if="tableRows.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.auditLogEmpty') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm text-left">
            <thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap w-8" />
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ t('settings.auditLogColWhen') }}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ t('settings.auditLogColWho') }}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ t('settings.auditLogColDevice') }}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ t('settings.auditLogColIp') }}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ t('settings.auditLogColArea') }}
                </th>
                <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  {{ t('settings.auditLogColChanges') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <template v-for="row in tableRows" :key="row.key">
                <tr
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  :class="{ 'cursor-pointer': row.changes.length > 1 }"
                  @click="row.changes.length > 1 ? toggleExpand(row.key) : undefined"
                >
                  <td class="px-4 py-3 align-top text-gray-400">
                    <button
                      v-if="row.changes.length > 1"
                      type="button"
                      class="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      :aria-expanded="expandedIds.has(row.key)"
                      @click.stop="toggleExpand(row.key)"
                    >
                      <svg
                        class="h-3.5 w-3.5 transition-transform"
                        :class="{ 'rotate-90': expandedIds.has(row.key) }"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                  <td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap align-top">
                    {{ row.when }}
                  </td>
                  <td class="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap align-top">
                    {{ row.who }}
                  </td>
                  <td
                    class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap align-top max-w-[12rem] truncate"
                    :title="row.userAgent || undefined"
                  >
                    {{ row.device }}
                  </td>
                  <td
                    class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap align-top font-mono text-xs"
                    :title="row.ipRaw && row.ipRaw !== row.ip ? row.ipRaw : undefined"
                  >
                    {{ row.ip }}
                  </td>
                  <td class="px-4 py-3 align-top">
                    <span class="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {{ row.area }}
                    </span>
                  </td>
                  <td class="px-4 py-3 align-top text-gray-900 dark:text-white">
                    <template v-if="row.changes.length === 1">
                      <span class="font-medium">{{ row.changes[0].label }}</span>
                      <span class="text-gray-500 dark:text-gray-400 font-normal">
                        :
                        <span
                          v-if="row.changes[0].from && row.changes[0].from !== '—'"
                          class="line-through decoration-gray-400 mx-1"
                        >{{ row.changes[0].from }}</span>
                        <span v-else class="text-gray-400 mx-1">{{ t('settings.auditLogNoData') }}</span>
                        →
                        <span class="font-medium ml-1">{{
                          row.changes[0].to && row.changes[0].to !== '—'
                            ? row.changes[0].to
                            : t('settings.auditLogNoData')
                        }}</span>
                      </span>
                    </template>
                    <template v-else>
                      <span class="font-medium">{{ row.summary }}</span>
                      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">
                        {{ row.changeLabels }}
                      </p>
                    </template>
                  </td>
                </tr>
                <tr v-if="row.changes.length > 1 && expandedIds.has(row.key)" :key="`${row.key}-details`">
                  <td colspan="7" class="px-4 py-3 bg-gray-50 dark:bg-gray-900/40">
                    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                      {{ t('settings.auditLogAllChanges') }}
                    </p>
                    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table class="min-w-full text-xs">
                        <thead class="bg-white dark:bg-gray-800">
                          <tr>
                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {{ t('settings.auditLogColSetting') }}
                            </th>
                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {{ t('settings.auditLogColBefore') }}
                            </th>
                            <th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {{ t('settings.auditLogColAfter') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800/60">
                          <tr v-for="change in row.changes" :key="`${row.key}-${change.field}`">
                            <td class="px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {{ change.label }}
                            </td>
                            <td class="px-3 py-2 text-gray-500 dark:text-gray-400 break-words max-w-[16rem]">
                              <span
                                v-if="change.from && change.from !== '—'"
                                class="line-through decoration-gray-400"
                              >{{ change.from }}</span>
                              <span v-else class="text-gray-400">{{ t('settings.auditLogNoData') }}</span>
                            </td>
                            <td class="px-3 py-2 font-medium text-gray-900 dark:text-white break-words max-w-[16rem]">
                              {{ change.to && change.to !== '—' ? change.to : t('settings.auditLogNoData') }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div
          v-if="!loading && pagination.totalPages > 1"
          class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700"
        >
          <button
            type="button"
            class="text-sm text-gray-600 dark:text-gray-300 disabled:opacity-40"
            :disabled="pagination.page <= 1"
            @click="goPage(pagination.page - 1)"
          >
            {{ t('settings.auditLogPrev') }}
          </button>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.auditLogPage', { page: pagination.page, total: pagination.totalPages }) }}
          </span>
          <button
            type="button"
            class="text-sm text-gray-600 dark:text-gray-300 disabled:opacity-40"
            :disabled="pagination.page >= pagination.totalPages"
            @click="goPage(pagination.page + 1)"
          >
            {{ t('settings.auditLogNext') }}
          </button>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';

const { t } = useI18n();

const loading = ref(false);
const error = ref(null);
const items = ref([]);
const surfaceOptions = ref([]);
const expandedIds = ref(new Set());
const pagination = reactive({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 1
});

const filters = reactive({
  surface: ''
});

function actorLabel(row) {
  return row.actorName || row.actorEmail || t('settings.auditLogUnknownActor');
}

function formatIp(ip) {
  if (!ip) return t('settings.auditLogUnknownIp');
  const normalized = String(ip).trim().replace(/^::ffff:/i, '');
  if (normalized === '::1' || normalized === '127.0.0.1' || normalized.toLowerCase() === 'localhost') {
    return t('settings.auditLogLocalhost');
  }
  return String(ip).trim();
}

function formatDate(value) {
  if (!value) return '';
  try {
    return formatUserDateTime(value);
  } catch {
    return String(value);
  }
}

function toggleExpand(key) {
  const next = new Set(expandedIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedIds.value = next;
}

/** One table row per save (audit event), not per field. */
const tableRows = computed(() => {
  const rows = [];
  for (const item of items.value) {
    const changes = item.presentation?.changes || [];
    if (changes.length === 0) continue;

    const area = item.presentation?.surfaceLabel || item.surface;
    const labels = changes.map((c) => c.label).filter(Boolean);
    const preview = labels.slice(0, 3).join(', ');
    const more = labels.length > 3 ? ` +${labels.length - 3}` : '';

    rows.push({
      key: String(item._id),
      when: formatDate(item.createdAt),
      who: actorLabel(item),
      device: item.device?.label || t('settings.auditLogUnknownDevice'),
      ip: formatIp(item.ipAddress),
      ipRaw: item.ipAddress || '',
      userAgent: item.userAgent || '',
      area,
      changes,
      summary: t('settings.auditLogChangedMany', { area, count: changes.length }),
      changeLabels: `${preview}${more}`
    });
  }
  return rows;
});

async function fetchLogs() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    if (filters.surface) params.set('surface', filters.surface);

    const data = await apiClient(`/settings/audit-log?${params.toString()}`, {
      method: 'GET'
    });

    if (!data?.success) {
      throw new Error(data?.message || t('settings.auditLogLoadError'));
    }

    items.value = data.data?.items || [];
    expandedIds.value = new Set();
    if (Array.isArray(data.data?.surfaces) && data.data.surfaces.length) {
      surfaceOptions.value = data.data.surfaces;
    }
    const p = data.data?.pagination || {};
    pagination.page = p.page || 1;
    pagination.limit = p.limit || 50;
    pagination.total = p.total || 0;
    pagination.totalPages = p.totalPages || 1;
  } catch (err) {
    console.error('Failed to load settings audit log:', err);
    error.value = err?.message || t('settings.auditLogLoadError');
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function reload() {
  pagination.page = 1;
  fetchLogs();
}

function goPage(page) {
  pagination.page = page;
  fetchLogs();
}

onMounted(fetchLogs);
</script>
