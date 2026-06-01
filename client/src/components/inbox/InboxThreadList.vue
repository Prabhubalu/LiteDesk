<template>
  <div
    class="inbox-thread-list flex min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-gray-950"
    :class="paneClass"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2 border-b border-[#EBEBEB] px-4 py-3 dark:border-gray-800">
      <h1 class="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#37352F] dark:text-white">
        {{ title }}
      </h1>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] transition hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('inbox.inboxSurfaceReloadThreadList2')"
        :aria-label="t('inbox.inboxSurfaceReloadThreadList')"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#EBEBEB] px-3 py-2 dark:border-gray-800">
      <label
        class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/5"
        :title="t('inbox.inboxSurfaceSelectAllInView')"
      >
        <input
          ref="selectAllCheckboxRef"
          type="checkbox"
          class="h-3.5 w-3.5 rounded border-gray-300 text-[#2383E2] focus:ring-[#2383E2] dark:border-gray-600 dark:bg-gray-900"
          :checked="allVisibleSelected"
          :aria-label="t('inbox.inboxSurfaceSelectAllInView')"
          @change="onSelectAllChange"
        >
      </label>
      <button
        v-for="chip in filterChips"
        :key="chip.id"
        type="button"
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition"
        :class="chip.active
          ? 'bg-[#2383E2]/10 font-medium text-[#2383E2] dark:bg-blue-500/15 dark:text-blue-300'
          : 'text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5'"
        @click="emit('filter-chip', chip.id)"
      >
        <span v-if="chip.dot" class="h-1.5 w-1.5 rounded-full bg-[#2383E2]" aria-hidden="true" />
        {{ chip.label }}
        <ChevronDownIcon v-if="chip.dropdown" class="h-3 w-3 opacity-60" aria-hidden="true" />
      </button>
    </div>

    <!-- Bulk actions -->
    <div
      v-if="selectedCount > 0"
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/80 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/30"
    >
      <span class="text-xs font-medium text-blue-900 dark:text-blue-100">
        {{ selectedCount }} {{ t('inbox.inboxSidebarSelected') }}
      </span>
      <button
        type="button"
        class="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        @click="emit('bulk-done', true)"
      >
        {{ t('inbox.inboxSurfaceMarkDone') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
        @click="emit('bulk-done', false)"
      >
        {{ t('inbox.inboxSurfaceReopen') }}
      </button>
      <button
        type="button"
        class="ml-auto text-xs font-medium text-blue-700 underline dark:text-blue-300"
        @click="emit('clear-selection')"
      >
        {{ t('settings.modFieldsClear') }}
      </button>
    </div>

    <slot name="banners" />

    <!-- List -->
    <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="h-7 w-7 animate-spin rounded-full border-2 border-[#EBEBEB] border-t-[#2383E2] dark:border-gray-700 dark:border-t-blue-400" />
      </div>
      <div v-else-if="error" class="px-4 py-8 text-center text-sm text-amber-800 dark:text-amber-200">
        {{ error }}
      </div>
      <div v-else-if="!groups.length" class="px-4 py-20 text-center">
        <p class="text-sm font-medium text-[#37352F] dark:text-white">
          {{ t('inbox.inboxSurfaceNoConversationsInThisView') }}
        </p>
      </div>
      <div v-else role="list">
        <template v-for="group in groups" :key="group.key">
          <div
            v-if="group.label"
            class="sticky top-0 z-10 bg-white/95 px-4 py-2 text-[11px] font-medium text-[#9B9A97] backdrop-blur-sm dark:bg-gray-950/95 dark:text-gray-500"
          >
            {{ group.label }}
          </div>
          <div
            v-for="row in group.rows"
            :key="row.threadId"
            role="button"
            tabindex="0"
            class="group relative flex w-full cursor-pointer items-center gap-3 border-b border-[#F1F1EF] px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2383E2] dark:border-gray-800/80"
            :class="rowClasses(row)"
            @click="emit('open-thread', row.raw)"
            @keydown.enter="emit('open-thread', row.raw)"
            @keydown.space.prevent="emit('open-thread', row.raw)"
          >
            <span
              class="relative flex w-5 shrink-0 items-center justify-center"
              @click.stop
            >
              <span
                v-if="row.unread"
                class="h-2 w-2 rounded-full bg-[#2383E2] transition-opacity"
                :class="selectionActive || isRowSelected(row) ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'"
                aria-hidden="true"
              />
              <input
                type="checkbox"
                class="absolute h-3.5 w-3.5 rounded border-gray-300 text-[#2383E2] transition-opacity focus:ring-[#2383E2] dark:border-gray-600 dark:bg-gray-900"
                :class="selectionActive || isRowSelected(row) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                :checked="isRowSelected(row)"
                :aria-label="row.sender"
                @change="onRowSelectChange(row, ($event.target as HTMLInputElement).checked)"
              >
            </span>

            <span
              class="w-[140px] shrink-0 truncate text-[13px] sm:w-[160px]"
              :class="row.unread ? 'font-semibold text-[#37352F] dark:text-white' : 'font-normal text-[#37352F] dark:text-gray-200'"
            >
              {{ row.sender }}
            </span>

            <span class="min-w-0 flex-1 truncate text-[13px]">
              <span
                :class="row.unread ? 'font-semibold text-[#37352F] dark:text-white' : 'font-normal text-[#37352F] dark:text-gray-200'"
              >
                {{ row.subject || '(no subject)' }}
              </span>
              <span class="font-normal text-[#9B9A97] dark:text-gray-500">
                {{ row.snippet ? ` — ${row.snippet}` : '' }}
              </span>
            </span>

            <div
              class="absolute right-14 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-white/95 px-1 py-0.5 shadow-sm ring-1 ring-black/5 group-hover:flex dark:bg-gray-900/95 dark:ring-white/10"
              @click.stop
            >
              <button
                type="button"
                class="rounded p-1 text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
                :title="row.done ? t('inbox.inboxSurfaceReopen') : t('inbox.inboxSurfaceMarkDone')"
                @click="emit('row-archive', row.raw)"
              >
                <ArchiveBoxIcon class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
                :title="t('inbox.inboxSidebarDelete')"
                @click="emit('row-delete', row.raw)"
              >
                <TrashIcon class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
                :title="row.unread ? t('inbox.inboxSidebarMarkRead') : t('inbox.inboxSidebarMarkUnread')"
                @click="emit('row-toggle-read', row.raw)"
              >
                <EnvelopeOpenIcon class="h-3.5 w-3.5" />
              </button>
            </div>

            <time
              class="w-14 shrink-0 text-right text-[11px] tabular-nums text-[#9B9A97] group-hover:opacity-0 dark:text-gray-500"
              :datetime="row.lastActivityAt"
            >
              {{ row.formattedDate }}
            </time>
          </div>
        </template>
      </div>

      <div v-if="hasMore && !loading" class="border-t border-[#EBEBEB] px-4 py-3 text-center dark:border-gray-800">
        <button
          type="button"
          class="rounded-md px-4 py-1.5 text-[13px] font-medium text-[#787774] transition hover:bg-black/[0.04] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5"
          :disabled="loadingMore"
          @click="emit('load-more')"
        >
          {{ loadingMore ? t('states.loading') : t('inbox.inboxSidebarLoadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  EnvelopeOpenIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';

export interface ThreadListRow {
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  unread: boolean;
  done?: boolean;
  lastActivityAt?: string;
  formattedDate: string;
  raw: Record<string, unknown>;
}

export interface ThreadListGroup {
  key: string;
  label: string;
  rows: ThreadListRow[];
}

export interface FilterChip {
  id: string;
  label: string;
  active?: boolean;
  dot?: boolean;
  dropdown?: boolean;
}

const props = withDefaults(defineProps<{
  paneClass?: string;
  title: string;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  groups: ThreadListGroup[];
  filterChips: FilterChip[];
  selectedCount?: number;
  selectedThreadIds?: string[];
  allVisibleSelected?: boolean;
  someVisibleSelected?: boolean;
  hasMore?: boolean;
  activeThreadId?: string | null;
}>(), {
  selectedCount: 0,
  selectedThreadIds: () => [],
  allVisibleSelected: false,
  someVisibleSelected: false
});

const emit = defineEmits<{
  refresh: [];
  'filter-chip': [id: string];
  'open-thread': [row: Record<string, unknown>];
  'row-archive': [row: Record<string, unknown>];
  'row-delete': [row: Record<string, unknown>];
  'row-toggle-read': [row: Record<string, unknown>];
  'toggle-row-select': [threadId: string, checked: boolean];
  'toggle-select-all': [checked: boolean];
  'bulk-done': [done: boolean];
  'clear-selection': [];
  'load-more': [];
}>();

const { t } = useI18n();

const selectAllCheckboxRef = ref<HTMLInputElement | null>(null);
const selectionActive = computed(() => props.selectedCount > 0);

watch(
  () => [props.allVisibleSelected, props.someVisibleSelected],
  () => {
    const el = selectAllCheckboxRef.value;
    if (el) {
      el.indeterminate = Boolean(props.someVisibleSelected && !props.allVisibleSelected);
    }
  },
  { immediate: true }
);

function isRowSelected(row: ThreadListRow) {
  return props.selectedThreadIds.includes(String(row.threadId));
}

function onSelectAllChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  emit('toggle-select-all', checked);
}

function onRowSelectChange(row: ThreadListRow, checked: boolean) {
  emit('toggle-row-select', String(row.threadId), checked);
}

function rowClasses(row: ThreadListRow) {
  if (isRowSelected(row)) {
    return 'bg-[#2383E2]/10 dark:bg-blue-950/30';
  }
  const isActive = props.activeThreadId && String(props.activeThreadId) === String(row.threadId);
  if (isActive) {
    return 'bg-[#F1F1EF] dark:bg-gray-800/80';
  }
  return 'hover:bg-[#F7F7F5] dark:hover:bg-gray-900/60';
}
</script>
