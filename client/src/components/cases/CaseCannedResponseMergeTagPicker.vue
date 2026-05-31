<template>
  <div
    class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40"
    :class="fillHeight ? 'h-full' : ''"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskExecMergeTagTitle') }}</p>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecMergeTagSubtitle') }}</p>
      </div>
      <span
        v-if="targetLabel"
        class="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
      >
        {{ targetLabel }}
      </span>
    </div>

    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <input
        v-model.trim="query"
        type="search"
        :placeholder="t('settings.helpdeskExecMergeTagSearchPh')"
        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </div>

    <div
      class="space-y-4 overflow-y-auto px-4 py-3"
      :class="fillHeight ? 'min-h-0 flex-1' : 'max-h-64'"
    >
      <div v-if="!filteredGroups.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.helpdeskExecMergeTagNoResults') }}
      </div>

      <section v-for="group in filteredGroups" :key="group.id">
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {{ t(group.labelKey) }}
        </p>
        <ul class="space-y-1">
          <li v-for="tag in group.tags" :key="tag.token">
            <button
              type="button"
              class="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white dark:hover:bg-gray-800"
              @click="$emit('select', tag.token)"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ t(tag.labelKey) }}</span>
                <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t(tag.descriptionKey) }}</span>
              </span>
              <code class="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] text-indigo-700 dark:bg-gray-950 dark:text-indigo-300">
                {{ formatTag(tag.token) }}
              </code>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS,
  formatCaseCannedResponseMergeTag
} from '@/constants/caseCannedResponseMergeTags';

defineProps({
  targetLabel: { type: String, default: '' },
  fillHeight: { type: Boolean, default: false }
});

defineEmits(['select']);

const { t } = useI18n();
const query = ref('');

function formatTag(token) {
  return formatCaseCannedResponseMergeTag(token);
}

function matchesQuery(tag) {
  const q = query.value.toLowerCase();
  if (!q) return true;
  const haystack = [
    tag.token,
    t(tag.labelKey),
    t(tag.descriptionKey),
    formatTag(tag.token)
  ].join(' ').toLowerCase();
  return haystack.includes(q);
}

const filteredGroups = computed(() =>
  CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS
    .map((group) => ({
      ...group,
      tags: group.tags.filter(matchesQuery)
    }))
    .filter((group) => group.tags.length > 0)
);
</script>
