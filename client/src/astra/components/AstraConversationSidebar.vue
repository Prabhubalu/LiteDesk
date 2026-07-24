<template>
  <div class="relative z-20 hidden h-full min-h-0 w-full md:flex md:flex-col">
    <aside
      class="flex h-full w-full min-h-0 flex-col border-r border-neutral-200/70 bg-white/90 dark:border-white/[0.08] dark:bg-neutral-950/80"
    >
      <div class="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <p class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {{ t('astra.historyHeading') }}
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
          @click="$emit('new-chat')"
        >
          <PlusIcon class="h-3.5 w-3.5" />
          {{ t('astra.newChat') }}
        </button>
      </div>

      <div
        ref="desktopScrollEl"
        class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
      >
        <p v-if="loading && !items.length" class="px-2 py-2 text-xs text-neutral-400">
          {{ t('astra.historyLoading') }}
        </p>
        <p v-else-if="!items.length" class="px-2 py-2 text-xs text-neutral-400">
          {{ t('astra.historyEmpty') }}
        </p>
        <div v-else class="space-y-2">
          <section v-for="group in groups" :key="group.id">
            <p class="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {{ group.label }}
            </p>
            <ul class="space-y-px">
              <li v-for="item in group.items" :key="item.id">
                <div
                  class="group flex items-center gap-0.5 rounded-lg px-1.5 py-1 transition"
                  :class="item.id === activeId
                    ? 'bg-primary-50 dark:bg-primary-950/40'
                    : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-900/70'"
                >
                  <button
                    type="button"
                    class="min-w-0 flex-1 truncate text-left text-[13px] font-normal leading-5"
                    :class="item.id === activeId
                      ? 'text-primary-800 dark:text-primary-200'
                      : 'text-neutral-700 dark:text-neutral-200'"
                    @click="$emit('select', item.id)"
                  >
                    {{ item.title || t('astra.historyUntitled') }}
                  </button>
                  <button
                    type="button"
                    class="shrink-0 rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    :aria-label="t('astra.historyDelete')"
                    @click.stop="$emit('delete', item.id)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            </ul>
          </section>
          <div ref="desktopSentinelEl" class="h-1 w-full" aria-hidden="true" />
          <p v-if="loadingMore" class="px-2 py-2 text-xs text-neutral-400">
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
                    {{ t('astra.historyHeading') }}
                  </DialogTitle>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    @click="$emit('close-mobile')"
                  >
                    <XMarkIcon class="h-4 w-4" />
                  </button>
                </div>
                <div class="px-3 py-2">
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600 dark:bg-primary-500 dark:hover:bg-primary-600"
                    @click="$emit('new-chat'); $emit('close-mobile')"
                  >
                    <PlusIcon class="h-3.5 w-3.5" />
                    {{ t('astra.newChat') }}
                  </button>
                </div>
                <div
                  ref="mobileScrollEl"
                  class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
                >
                  <p v-if="loading && !items.length" class="px-2 py-2 text-xs text-neutral-400">
                    {{ t('astra.historyLoading') }}
                  </p>
                  <p v-else-if="!items.length" class="px-2 py-2 text-xs text-neutral-400">
                    {{ t('astra.historyEmpty') }}
                  </p>
                  <div v-else class="space-y-2">
                    <section v-for="group in groups" :key="`m-${group.id}`">
                      <p class="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        {{ group.label }}
                      </p>
                      <ul class="space-y-px">
                        <li v-for="item in group.items" :key="`m-${item.id}`">
                          <button
                            type="button"
                            class="block w-full truncate rounded-lg px-2 py-1 text-left text-[13px] font-normal leading-5"
                            :class="item.id === activeId
                              ? 'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200'
                              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900'"
                            @click="$emit('select', item.id); $emit('close-mobile')"
                          >
                            {{ item.title || t('astra.historyUntitled') }}
                          </button>
                        </li>
                      </ul>
                    </section>
                    <div ref="mobileSentinelEl" class="h-1 w-full" aria-hidden="true" />
                    <p v-if="loadingMore" class="px-2 py-2 text-xs text-neutral-400">
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
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { AstraConversationSummary } from '@/astra/composables/useAstraConversations';

type ConversationGroupId = 'today' | 'yesterday' | 'week' | 'month' | 'older';

const props = defineProps<{
  items: AstraConversationSummary[];
  activeId?: string | null;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  mobileOpen?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  delete: [id: string];
  'new-chat': [];
  'close-mobile': [];
  'clear-older': [];
  'load-more': [];
}>();

const { t } = useI18n();

const desktopScrollEl = ref<HTMLElement | null>(null);
const desktopSentinelEl = ref<HTMLElement | null>(null);
const mobileScrollEl = ref<HTMLElement | null>(null);
const mobileSentinelEl = ref<HTMLElement | null>(null);

let desktopObserver: IntersectionObserver | null = null;
let mobileObserver: IntersectionObserver | null = null;

function requestLoadMore() {
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
  () => [props.items.length, props.hasMore, props.mobileOpen, props.loadingMore] as const,
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

const groups = computed(() => {
  const buckets: Record<ConversationGroupId, AstraConversationSummary[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
    older: [],
  };
  for (const item of props.items || []) {
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
  groups.value.some((g) => g.id !== 'today' && g.items.length > 0),
);
</script>
