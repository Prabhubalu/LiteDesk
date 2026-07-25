<template>
  <div class="relative z-20 h-full min-h-0 w-full">
    <!-- Desktop panel -->
    <aside
      class="flex h-full w-full min-h-0 flex-col border-r border-neutral-200/70 bg-white/90 dark:border-white/[0.08] dark:bg-neutral-950/80"
    >
      <div class="flex shrink-0 flex-col gap-2 px-3 py-2.5">
        <div class="flex items-center justify-between gap-1.5">
          <p class="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {{ headingLabel }}
          </p>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
              @click="onPrimaryNew"
            >
              <PlusIcon class="h-3.5 w-3.5" />
              {{ primaryNewLabel }}
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200/80 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:border-white/10 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
              :aria-label="t('astra.sidebarCollapse')"
              :title="t('astra.sidebarCollapse')"
              @click="$emit('collapse')"
            >
              <svg
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.25" stroke="currentColor" stroke-width="1.5" />
                <path d="M9.25 5v14" stroke="currentColor" stroke-width="1.5" />
                <path d="M5.75 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path d="M5.75 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path d="M5.75 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div
          class="flex rounded-lg bg-neutral-100/90 p-0.5 dark:bg-neutral-900"
          role="tablist"
          :aria-label="t('astra.sidebarFilterLabel')"
        >
          <button
            v-for="opt in filterOptions"
            :key="opt.id"
            type="button"
            role="tab"
            class="flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition"
            :class="filter === opt.id
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'"
            :aria-selected="filter === opt.id"
            @click="setFilter(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div
        ref="desktopScrollEl"
        class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
      >
        <p v-if="listLoading && !displayGroups.length" class="px-2 py-2 text-xs text-neutral-400">
          {{ t('astra.historyLoading') }}
        </p>
        <p v-else-if="!displayGroups.length" class="px-2 py-2 text-xs text-neutral-400">
          {{ emptyLabel }}
        </p>
        <div v-else class="space-y-2">
          <section v-for="group in displayGroups" :key="group.id">
            <p class="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {{ group.label }}
            </p>
            <ul class="space-y-px">
              <li v-for="item in group.items" :key="`${item.kind}-${item.id}`">
                <div
                  class="group flex items-center gap-0.5 rounded-lg px-1.5 py-1 transition"
                  :class="isActive(item)
                    ? 'bg-primary-50 dark:bg-primary-950/40'
                    : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-900/70'"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[13px] font-normal leading-5"
                    :class="isActive(item)
                      ? 'text-primary-800 dark:text-primary-200'
                      : 'text-neutral-700 dark:text-neutral-200'"
                    @click="onSelect(item)"
                  >
                    <Squares2X2Icon
                      v-if="item.kind === 'canvas'"
                      class="h-3.5 w-3.5 shrink-0 opacity-70"
                    />
                    <span class="truncate">{{ item.title || untitledFor(item.kind) }}</span>
                  </button>
                  <button
                    type="button"
                    class="shrink-0 rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    :aria-label="t('astra.historyDelete')"
                    @click.stop="onDelete(item)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            </ul>
          </section>
          <div
            v-if="filter !== 'canvases'"
            ref="desktopSentinelEl"
            class="h-1 w-full"
            aria-hidden="true"
          />
          <p v-if="loadingMore && filter !== 'canvases'" class="px-2 py-2 text-xs text-neutral-400">
            {{ t('astra.historyLoading') }}
          </p>
        </div>
      </div>

      <div
        v-if="showClearOlder"
        class="shrink-0 border-t border-neutral-200/70 px-2 py-1.5 dark:border-white/[0.08]"
      >
        <button
          type="button"
          class="w-full rounded-md px-2 py-1 text-left text-[11px] font-normal text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
          @click="$emit('clear-older')"
        >
          {{ t('astra.historyClearOlder') }}
        </button>
      </div>
    </aside>

    <Teleport to="body">
      <TransitionRoot :show="Boolean(mobileOpen)" as="template">
        <Dialog class="relative z-[80] md:hidden" @close="$emit('close-mobile')">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="ease-in duration-150"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-neutral-950/40 backdrop-blur-[2px]" />
          </TransitionChild>

          <div class="fixed inset-0 flex">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-200"
              enter-from="-translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-150"
              leave-from="translate-x-0"
              leave-to="-translate-x-full"
            >
              <DialogPanel class="flex h-full w-[18rem] max-w-[85vw] flex-col bg-white shadow-xl dark:bg-neutral-950">
                <div class="flex items-center justify-between gap-2 border-b border-neutral-200/70 px-3 py-2.5 dark:border-white/10">
                  <DialogTitle class="text-sm font-medium text-neutral-900 dark:text-white">
                    {{ headingLabel }}
                  </DialogTitle>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    @click="$emit('close-mobile')"
                  >
                    <XMarkIcon class="h-4 w-4" />
                  </button>
                </div>
                <div class="space-y-2 px-3 py-2">
                  <div
                    class="flex rounded-lg bg-neutral-100/90 p-0.5 dark:bg-neutral-900"
                    role="tablist"
                  >
                    <button
                      v-for="opt in filterOptions"
                      :key="`m-${opt.id}`"
                      type="button"
                      role="tab"
                      class="flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition"
                      :class="filter === opt.id
                        ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                        : 'text-neutral-500'"
                      :aria-selected="filter === opt.id"
                      @click="setFilter(opt.id)"
                    >
                      {{ opt.label }}
                    </button>
                  </div>
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600"
                    @click="onPrimaryNew(); $emit('close-mobile')"
                  >
                    <PlusIcon class="h-3.5 w-3.5" />
                    {{ primaryNewLabel }}
                  </button>
                </div>
                <div
                  ref="mobileScrollEl"
                  class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
                >
                  <p v-if="listLoading && !displayGroups.length" class="px-2 py-2 text-xs text-neutral-400">
                    {{ t('astra.historyLoading') }}
                  </p>
                  <p v-else-if="!displayGroups.length" class="px-2 py-2 text-xs text-neutral-400">
                    {{ emptyLabel }}
                  </p>
                  <div v-else class="space-y-2">
                    <section v-for="group in displayGroups" :key="`m-${group.id}`">
                      <p class="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        {{ group.label }}
                      </p>
                      <ul class="space-y-px">
                        <li v-for="item in group.items" :key="`m-${item.kind}-${item.id}`">
                          <button
                            type="button"
                            class="flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-[13px] font-normal leading-5"
                            :class="isActive(item)
                              ? 'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200'
                              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900'"
                            @click="onSelect(item); $emit('close-mobile')"
                          >
                            <Squares2X2Icon
                              v-if="item.kind === 'canvas'"
                              class="h-3.5 w-3.5 shrink-0 opacity-70"
                            />
                            <span class="truncate">{{ item.title || untitledFor(item.kind) }}</span>
                          </button>
                        </li>
                      </ul>
                    </section>
                    <div
                      v-if="filter !== 'canvases'"
                      ref="mobileSentinelEl"
                      class="h-1 w-full"
                      aria-hidden="true"
                    />
                    <p v-if="loadingMore && filter !== 'canvases'" class="px-2 py-2 text-xs text-neutral-400">
                      {{ t('astra.historyLoading') }}
                    </p>
                  </div>
                </div>
                <div
                  v-if="showClearOlder"
                  class="border-t border-neutral-200/70 px-2 py-1.5 dark:border-white/10"
                >
                  <button
                    type="button"
                    class="w-full rounded-md px-2 py-1 text-left text-[11px] font-normal text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    @click="$emit('clear-older')"
                  >
                    {{ t('astra.historyClearOlder') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </TransitionRoot>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { PlusIcon, Squares2X2Icon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { AstraConversationSummary } from '@/astra/composables/useAstraConversations';

export type SidebarFilter = 'all' | 'chats' | 'canvases';

export type SidebarCanvasItem = {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
};

type RowKind = 'chat' | 'canvas';
type SidebarRow = {
  id: string;
  kind: RowKind;
  title: string;
  updatedAt?: string;
  createdAt?: string;
};

type ConversationGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'older';

const props = defineProps<{
  items: AstraConversationSummary[];
  canvases?: SidebarCanvasItem[];
  filter?: SidebarFilter;
  activeId?: string | null;
  activeKind?: RowKind | null;
  loading?: boolean;
  canvasesLoading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  mobileOpen?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  'select-canvas': [id: string];
  delete: [id: string];
  'delete-canvas': [id: string];
  'new-chat': [];
  'new-canvas': [];
  'update:filter': [filter: SidebarFilter];
  collapse: [];
  'close-mobile': [];
  'clear-older': [];
  'load-more': [];
}>();

const { t } = useI18n();

const filter = computed<SidebarFilter>(() => props.filter || 'all');

const filterOptions = computed(() => [
  { id: 'all' as const, label: t('astra.sidebarFilterAll') },
  { id: 'chats' as const, label: t('astra.sidebarFilterChats') },
  { id: 'canvases' as const, label: t('astra.sidebarFilterCanvases') },
]);

const headingLabel = computed(() => {
  if (filter.value === 'canvases') return t('astra.sidebarCanvasesHeading');
  if (filter.value === 'chats') return t('astra.historyHeading');
  return t('astra.sidebarAllHeading');
});

const primaryNewLabel = computed(() =>
  filter.value === 'canvases' ? t('astra.newCanvas') : t('astra.newChat'),
);

const emptyLabel = computed(() => {
  if (filter.value === 'canvases') return t('astra.sidebarCanvasesEmpty');
  if (filter.value === 'chats') return t('astra.historyEmpty');
  return t('astra.sidebarAllEmpty');
});

const listLoading = computed(() => {
  if (filter.value === 'canvases') return Boolean(props.canvasesLoading);
  if (filter.value === 'chats') return Boolean(props.loading);
  return Boolean(props.loading || props.canvasesLoading);
});

function setFilter(next: SidebarFilter) {
  emit('update:filter', next);
}

function onPrimaryNew() {
  if (filter.value === 'canvases') emit('new-canvas');
  else emit('new-chat');
}

function onSelect(item: SidebarRow) {
  if (item.kind === 'canvas') emit('select-canvas', item.id);
  else emit('select', item.id);
}

function onDelete(item: SidebarRow) {
  if (item.kind === 'canvas') emit('delete-canvas', item.id);
  else emit('delete', item.id);
}

function isActive(item: SidebarRow) {
  if (!props.activeId || item.id !== props.activeId) return false;
  if (props.activeKind) return item.kind === props.activeKind;
  return true;
}

function untitledFor(kind: RowKind) {
  return kind === 'canvas' ? t('astra.sidebarCanvasUntitled') : t('astra.historyUntitled');
}

const desktopScrollEl = ref<HTMLElement | null>(null);
const desktopSentinelEl = ref<HTMLElement | null>(null);
const mobileScrollEl = ref<HTMLElement | null>(null);
const mobileSentinelEl = ref<HTMLElement | null>(null);

let desktopObserver: IntersectionObserver | null = null;
let mobileObserver: IntersectionObserver | null = null;

function requestLoadMore() {
  if (filter.value === 'canvases') return;
  if (!props.hasMore || props.loading || props.loadingMore) return;
  emit('load-more');
}

function bindObserver(
  root: HTMLElement | null,
  target: HTMLElement | null,
  current: IntersectionObserver | null,
): IntersectionObserver | null {
  current?.disconnect();
  if (!root || !target) return null;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) requestLoadMore();
    },
    { root, rootMargin: '80px', threshold: 0 },
  );
  observer.observe(target);
  return observer;
}

function refreshObservers() {
  desktopObserver = bindObserver(desktopScrollEl.value, desktopSentinelEl.value, desktopObserver);
  mobileObserver = bindObserver(mobileScrollEl.value, mobileSentinelEl.value, mobileObserver);
}

watch(
  () => [props.items.length, props.canvases?.length, props.hasMore, props.mobileOpen, props.loadingMore, filter.value] as const,
  () => {
    requestAnimationFrame(refreshObservers);
  },
  { flush: 'post' },
);

onBeforeUnmount(() => {
  desktopObserver?.disconnect();
  mobileObserver?.disconnect();
});

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupIdForDate(value?: string | null): ConversationGroupId {
  if (!value) return 'older';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'older';
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(new Date(ts));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'week';
  if (diffDays < 30) return 'month';
  return 'older';
}

const unifiedRows = computed((): SidebarRow[] => {
  const rows: SidebarRow[] = [];
  const f = filter.value;
  if (f === 'all' || f === 'chats') {
    for (const item of props.items || []) {
      rows.push({
        id: item.id,
        kind: 'chat',
        title: item.title || '',
        updatedAt: item.updatedAt ?? undefined,
        createdAt: item.createdAt ?? undefined,
      });
    }
  }
  if (f === 'all' || f === 'canvases') {
    for (const c of props.canvases || []) {
      rows.push({
        id: c.id,
        kind: 'canvas',
        title: c.title || '',
        updatedAt: c.updatedAt ?? undefined,
        createdAt: c.createdAt ?? undefined,
      });
    }
  }
  rows.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return rows;
});

const displayGroups = computed(() => {
  const buckets: Record<ConversationGroupId, SidebarRow[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  };
  for (const item of unifiedRows.value) {
    buckets[groupIdForDate(item.updatedAt || item.createdAt)].push(item);
  }
  const order: Array<{ id: ConversationGroupId; label: string }> = [
    { id: 'today', label: t('astra.historyGroupToday') },
    { id: 'yesterday', label: t('astra.historyGroupYesterday') },
    { id: 'week', label: t('astra.historyGroupWeek') },
    { id: 'month', label: t('astra.historyGroupMonth') },
    { id: 'older', label: t('astra.historyGroupOlder') },
  ];
  return order
    .map((entry) => ({ ...entry, items: buckets[entry.id] }))
    .filter((group) => group.items.length > 0);
});

const showClearOlder = computed(() =>
  filter.value !== 'canvases'
  && displayGroups.value.some((g) => g.id !== 'today' && g.items.some((i) => i.kind === 'chat')),
);
</script>
