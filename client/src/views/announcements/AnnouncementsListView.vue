<template>
  <div class="flex min-h-0 flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
    <div class="border-b border-neutral-200 bg-white px-6 py-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-page-title text-neutral-900 dark:text-white">
            {{ t('announcements.pageTitle') }}
          </h1>
          <p class="text-helper mt-1 text-neutral-600 dark:text-neutral-400">
            {{ t('announcements.pageSubtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="openAnalytics()"
          >
            {{ t('announcements.navAnalytics') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            @click="router.push('/announcements/new')"
          >
            {{ t('announcements.create') }}
          </button>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto px-6 py-6">
      <div
        v-if="loading"
        class="space-y-3"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-14 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
        />
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-200"
      >
        {{ error }}
      </div>

      <div
        v-else-if="!items.length"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <h2 class="text-section-title text-neutral-900 dark:text-white">
          {{ t('announcements.emptyTitle') }}
        </h2>
        <p class="text-helper mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
          {{ t('announcements.emptyDescription') }}
        </p>
        <button
          type="button"
          class="mt-6 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          @click="router.push('/announcements/new')"
        >
          {{ t('announcements.create') }}
        </button>
      </div>

      <div
        v-else
        class="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      >
        <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
          <thead class="bg-neutral-50 dark:bg-neutral-950">
            <tr>
              <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colTitle') }}</th>
              <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colType') }}</th>
              <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colStatus') }}</th>
              <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colPriority') }}</th>
              <th class="px-4 py-3 text-left text-meta font-normal text-neutral-500">{{ t('announcements.colViews') }}</th>
              <th class="px-4 py-3 text-right text-meta font-normal text-neutral-500">{{ t('announcements.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
            <tr
              v-for="row in items"
              :key="row.id"
              class="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-left text-sm font-medium text-neutral-900 hover:text-primary-600 dark:text-white"
                  @click="router.push(`/announcements/${row.id}`)"
                >
                  {{ row.title }}
                </button>
                <p
                  v-if="row.shortDescription"
                  class="text-meta mt-0.5 line-clamp-1 text-neutral-500"
                >
                  {{ row.shortDescription }}
                </p>
              </td>
              <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                {{ row.displayType === 'popover' ? t('announcements.typePopover') : t('announcements.typeBanner') }}
              </td>
              <td class="px-4 py-3">
                <span :class="statusClass(row)">{{ statusLabel(row) }}</span>
              </td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-700 dark:text-neutral-300">
                {{ row.priority }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                <button
                  type="button"
                  class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                  :aria-label="t('announcements.navAnalytics')"
                  @click="openAnalytics(row.id)"
                >
                  {{ row.stats?.views ?? 0 }}
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="text-sm text-primary-600 hover:underline"
                    @click="router.push(`/announcements/${row.id}`)"
                  >
                    {{ isViewOnlyStatus(row.status) ? t('announcements.view') : t('announcements.edit') }}
                  </button>
                  <button
                    v-if="isTerminalStatus(row.status)"
                    type="button"
                    class="text-sm text-neutral-600 hover:underline dark:text-neutral-300"
                    @click="onDuplicate(row.id)"
                  >
                    {{ t('announcements.duplicate') }}
                  </button>
                  <button
                    v-if="row.status === 'published'"
                    type="button"
                    class="text-sm text-neutral-600 hover:underline dark:text-neutral-300"
                    @click="onPause(row.id)"
                  >
                    {{ t('announcements.pause') }}
                  </button>
                  <button
                    v-if="row.status === 'paused'"
                    type="button"
                    class="text-sm text-neutral-600 hover:underline dark:text-neutral-300"
                    @click="onResume(row.id)"
                  >
                    {{ t('announcements.resume') }}
                  </button>
                  <button
                    v-if="!isTerminalStatus(row.status)"
                    type="button"
                    class="text-sm text-danger-600 hover:underline"
                    @click="onArchive(row.id)"
                  >
                    {{ t('announcements.archive') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();

const loading = ref(true);
const error = ref('');
const items = ref([]);

function openAnalytics(announcementId) {
  if (announcementId) {
    void router.push({ path: '/announcements/analytics', query: { id: announcementId } });
    return;
  }
  void router.push('/announcements/analytics');
}

function isTerminalStatus(status) {
  return status === 'archived' || status === 'expired';
}

/** Published is live-locked; content edits require pause first. */
function isViewOnlyStatus(status) {
  return status === 'published' || isTerminalStatus(status);
}

function statusLabel(row) {
  if (row.effectiveStatus === 'active') return t('announcements.statusActive');
  const key = {
    draft: 'statusDraft',
    scheduled: 'statusScheduled',
    published: 'statusPublished',
    paused: 'statusPaused',
    expired: 'statusExpired',
    archived: 'statusArchived',
  }[row.status];
  return key ? t(`announcements.${key}`) : row.status;
}

function statusClass(row) {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs';
  if (row.effectiveStatus === 'active') return `${base} bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300`;
  if (row.status === 'paused') return `${base} bg-warning-50 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300`;
  if (row.status === 'draft' || row.status === 'scheduled') return `${base} bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300`;
  return `${base} bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/announcements');
    items.value = Array.isArray(res?.data?.items) ? res.data.items : [];
  } catch (err) {
    error.value = err?.message || t('announcements.loadFailed');
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function onPause(id) {
  try {
    await apiClient.post(`/announcements/${id}/pause`);
    await load();
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
  }
}

async function onResume(id) {
  try {
    await apiClient.post(`/announcements/${id}/resume`);
    await load();
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
  }
}

async function onArchive(id) {
  try {
    await apiClient.post(`/announcements/${id}/archive`);
    await load();
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
  }
}

async function onDuplicate(id) {
  if (!id) return;
  await router.push({ path: '/announcements/new', query: { duplicateFrom: String(id) } });
}

onMounted(() => {
  void load();
});
</script>
