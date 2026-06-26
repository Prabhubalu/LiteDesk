<template>
  <section class="mb-8 space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {{ t('templates.dashboardTitle') }}
        </h2>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('templates.dashboardDescription') }}
        </p>
      </div>
      <button
        v-if="canCreate"
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        @click="emit('create')"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('templates.newTemplate') }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <button
        v-for="stat in stats"
        :key="stat.key"
        type="button"
        class="rounded-xl border p-4 text-left transition-colors"
        :class="activeStatus === stat.filter
          ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/30'
          : 'border-neutral-200 bg-white hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-primary-600'"
        @click="emit('filter-status', stat.filter)"
      >
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ stat.label }}</p>
        <p class="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {{ loading ? '—' : stat.value }}
        </p>
      </button>
    </div>

    <div class="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {{ t('templates.dashboardRecentTitle') }}
        </h3>
        <button
          v-if="activeStatus"
          type="button"
          class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          @click="emit('filter-status', '')"
        >
          {{ t('templates.dashboardClearFilter') }}
        </button>
      </div>

      <div v-if="loading" class="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('states.loading') }}
      </div>
      <ul v-else-if="recent.length" class="divide-y divide-neutral-200 dark:divide-neutral-800">
        <li v-for="item in recent" :key="item._id || item.id">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            @click="emit('open', item)"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-neutral-900 dark:text-neutral-100">{{ item.name }}</p>
              <p class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                {{ recentMeta(item) }}
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusClass(item.status)"
            >
              {{ formatStatus(item.status) }}
            </span>
          </button>
        </li>
      </ul>
      <div v-else class="px-4 py-8 text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('templates.dashboardRecentEmpty') }}
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  summary: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  canCreate: { type: Boolean, default: false },
  activeStatus: { type: String, default: '' }
});

const emit = defineEmits(['create', 'open', 'filter-status']);

const { t } = useI18n();

const stats = computed(() => [
  { key: 'total', label: t('templates.dashboardStatTotal'), value: props.summary?.total ?? 0, filter: '' },
  { key: 'draft', label: t('templates.dashboardStatDraft'), value: props.summary?.draft ?? 0, filter: 'draft' },
  { key: 'published', label: t('templates.dashboardStatPublished'), value: props.summary?.published ?? 0, filter: 'published' },
  { key: 'review', label: t('templates.dashboardStatReview'), value: props.summary?.review ?? 0, filter: 'review' },
  { key: 'archived', label: t('templates.dashboardStatArchived'), value: props.summary?.archived ?? 0, filter: 'archived' }
]);

const recent = computed(() => {
  const items = props.summary?.recent;
  return Array.isArray(items) ? items : [];
});

function formatStatus(value) {
  if (!value) return 'draft';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function recentMeta(item) {
  const parts = [];
  if (item.purpose) parts.push(String(item.purpose));
  if (item.moduleScope) parts.push(String(item.moduleScope));
  if (item.updatedAt) {
    const date = new Date(item.updatedAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
  }
  return parts.join(' · ') || '—';
}

function statusClass(status) {
  switch (status) {
    case 'published':
      return 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300';
    case 'draft':
      return 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300';
    case 'archived':
    case 'deprecated':
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    default:
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300';
  }
}
</script>
