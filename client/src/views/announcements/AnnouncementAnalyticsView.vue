<template>
  <div class="flex min-h-0 flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
    <div class="border-b border-neutral-200 bg-white px-6 py-5 dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        class="mb-3 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        @click="router.push('/announcements')"
      >
        {{ t('announcements.backToList') }}
      </button>
      <h1 class="text-page-title text-neutral-900 dark:text-white">
        {{ t('announcements.analyticsTitle') }}
      </h1>
      <p class="text-helper mt-1 text-neutral-600 dark:text-neutral-400">
        {{ t('announcements.analyticsSubtitle') }}
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-6 py-6">
      <div
        v-if="loading"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
        />
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-200"
      >
        {{ error }}
      </div>

      <div
        v-else-if="!hasAnyData"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <h2 class="text-section-title text-neutral-900 dark:text-white">
          {{ t('announcements.analyticsEmptyTitle') }}
        </h2>
        <p class="text-helper mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
          {{ t('announcements.analyticsEmptyDescription') }}
        </p>
        <RouterLink
          to="/announcements/new"
          class="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {{ t('announcements.create') }}
        </RouterLink>
      </div>

      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p class="text-meta text-neutral-500 dark:text-neutral-400">{{ card.label }}</p>
            <p class="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">{{ card.value }}</p>
          </div>
        </div>

        <div class="mt-8 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h2 class="text-section-title text-neutral-900 dark:text-white">
              {{ t('announcements.analyticsTop') }}
            </h2>
          </div>
          <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
            <thead class="bg-neutral-50 dark:bg-neutral-950">
              <tr>
                <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colTitle') }}</th>
                <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colViews') }}</th>
                <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colCtaClicks') }}</th>
                <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colClickRate') }}</th>
                <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colDismissals') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr
                v-for="row in top"
                :key="row.id"
                class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                :class="selectedId === row.id ? 'bg-primary-50/60 dark:bg-primary-950/30' : ''"
                @click="selectAnnouncement(row.id)"
              >
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {{ row.title }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{{ row.views }}</td>
                <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{{ row.ctaClicks }}</td>
                <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{{ row.clickRate }}%</td>
                <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{{ row.dismissals }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="selectedId && detail"
          class="mt-8 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h2 class="text-section-title text-neutral-900 dark:text-white">
            {{ detail.announcement.title }}
          </h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="m in detailCards"
              :key="m.label"
              class="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700"
            >
              <p class="text-meta text-neutral-500">{{ m.label }}</p>
              <p class="text-value mt-1 text-neutral-900 dark:text-white">{{ m.value }}</p>
            </div>
          </div>
          <div
            v-if="detail.bySurface?.length"
            class="mt-6"
          >
            <p class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.analyticsBySurface') }}</p>
            <ul class="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              <li
                v-for="s in detail.bySurface"
                :key="s.surface"
              >
                {{ s.surface }} — {{ s.count }}
              </li>
            </ul>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref('');
const summary = ref(null);
const top = ref([]);
const detail = ref(null);
const selectedId = ref(typeof route.query.id === 'string' ? route.query.id : '');

const hasAnyData = computed(() => {
  const s = summary.value;
  if (!s) return false;
  return (s.totalViews || 0) > 0 || top.value.length > 0 || (s.activeAnnouncements || 0) > 0;
});

const summaryCards = computed(() => {
  const s = summary.value || {};
  return [
    { label: t('announcements.metricActive'), value: s.activeAnnouncements ?? 0 },
    { label: t('announcements.colViews'), value: s.totalViews ?? 0 },
    { label: t('announcements.colCtaClicks'), value: s.totalCtaClicks ?? 0 },
    { label: t('announcements.colClickRate'), value: `${s.clickRate ?? 0}%` },
  ];
});

const detailCards = computed(() => {
  const m = detail.value?.metrics || {};
  return [
    { label: t('announcements.colViews'), value: m.views ?? 0 },
    { label: t('announcements.metricUnique'), value: m.uniqueViewers ?? 0 },
    { label: t('announcements.colCtaClicks'), value: m.ctaClicks ?? 0 },
    { label: t('announcements.metricAckRate'), value: `${m.ackRate ?? 0}%` },
  ];
});

async function loadDetail(id) {
  if (!id) {
    detail.value = null;
    return;
  }
  const detailRes = await apiClient.get(`/announcements/${id}/analytics`);
  detail.value = detailRes?.data || null;
}

function selectAnnouncement(id) {
  selectedId.value = id;
  void router.replace({ path: '/announcements/analytics', query: { id } });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/announcements/analytics/summary');
    summary.value = res?.data?.summary || null;
    top.value = Array.isArray(res?.data?.top) ? res.data.top : [];
    if (!selectedId.value && top.value[0]?.id) {
      selectedId.value = top.value[0].id;
    }
    await loadDetail(selectedId.value);
  } catch (err) {
    error.value = err?.message || t('announcements.loadFailed');
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.id,
  (id) => {
    const next = typeof id === 'string' ? id : '';
    if (next === selectedId.value) return;
    selectedId.value = next;
    if (!loading.value) {
      void loadDetail(next).catch((err) => {
        error.value = err?.message || t('announcements.loadFailed');
      });
    }
  },
);

onMounted(() => {
  void load();
});
</script>
