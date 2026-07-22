<template>
  <div class="relative z-20 hidden h-full w-[17.5rem] shrink-0 md:flex">
    <!-- Desktop sidebar -->
    <aside
      class="flex h-full w-full flex-col border-r border-neutral-200/70 bg-white/80 backdrop-blur dark:border-white/[0.08] dark:bg-neutral-950/70"
    >
      <div class="flex items-center justify-between gap-2 px-3 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {{ t('astra.historyHeading') }}
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
          @click="$emit('new-chat')"
        >
          <PlusIcon class="h-3.5 w-3.5" />
          {{ t('astra.newChat') }}
        </button>
      </div>

      <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p v-if="loading" class="px-2 py-3 text-xs text-neutral-400">
          {{ t('astra.historyLoading') }}
        </p>
        <p v-else-if="!items.length" class="px-2 py-3 text-xs text-neutral-400">
          {{ t('astra.historyEmpty') }}
        </p>
        <ul v-else class="space-y-0.5">
          <li v-for="item in items" :key="item.id">
            <div
              class="group flex items-start gap-1 rounded-xl px-2 py-2 transition"
              :class="item.id === activeId
                ? 'bg-primary-50 dark:bg-primary-950/40'
                : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-900/70'"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="$emit('select', item.id)"
              >
                <span
                  class="block truncate text-sm font-medium"
                  :class="item.id === activeId
                    ? 'text-primary-800 dark:text-primary-200'
                    : 'text-neutral-800 dark:text-neutral-100'"
                >
                  {{ item.title || t('astra.historyUntitled') }}
                </span>
                <span class="mt-0.5 block truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                  {{ relativeLabel(item.updatedAt) }}
                </span>
              </button>
              <button
                type="button"
                class="mt-0.5 rounded-lg p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                :aria-label="t('astra.historyDelete')"
                @click.stop="$emit('delete', item.id)"
              >
                <TrashIcon class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </aside>

    <!-- Mobile drawer (teleported so it never steals flex space) -->
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
                <div class="flex items-center justify-between gap-2 border-b border-neutral-200/70 px-3 py-3 dark:border-white/10">
                  <DialogTitle class="text-sm font-semibold text-neutral-900 dark:text-white">
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
                <div class="flex items-center px-3 py-2">
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
                    @click="$emit('new-chat'); $emit('close-mobile')"
                  >
                    <PlusIcon class="h-3.5 w-3.5" />
                    {{ t('astra.newChat') }}
                  </button>
                </div>
                <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                  <p v-if="!items.length" class="px-2 py-3 text-xs text-neutral-400">
                    {{ t('astra.historyEmpty') }}
                  </p>
                  <ul v-else class="space-y-0.5">
                    <li v-for="item in items" :key="`m-${item.id}`">
                      <div
                        class="flex items-start gap-1 rounded-xl px-2 py-2"
                        :class="item.id === activeId ? 'bg-primary-50 dark:bg-primary-950/40' : ''"
                      >
                        <button
                          type="button"
                          class="min-w-0 flex-1 text-left"
                          @click="$emit('select', item.id); $emit('close-mobile')"
                        >
                          <span class="block truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                            {{ item.title || t('astra.historyUntitled') }}
                          </span>
                          <span class="mt-0.5 block text-[11px] text-neutral-400">
                            {{ relativeLabel(item.updatedAt) }}
                          </span>
                        </button>
                        <button
                          type="button"
                          class="rounded-lg p-1 text-neutral-300 hover:text-red-600"
                          @click.stop="$emit('delete', item.id)"
                        >
                          <TrashIcon class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  </ul>
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

defineProps<{
  items: AstraConversationSummary[];
  activeId?: string | null;
  loading?: boolean;
  mobileOpen?: boolean;
}>();

defineEmits<{
  select: [id: string];
  delete: [id: string];
  'new-chat': [];
  'close-mobile': [];
}>();

const { t, locale } = useI18n();

function relativeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale.value || undefined, { numeric: 'auto' });
    if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second');
    if (absSec < 3600) return rtf.format(Math.round(diffMs / 60000), 'minute');
    if (absSec < 86400) return rtf.format(Math.round(diffMs / 3600000), 'hour');
    if (absSec < 86400 * 30) return rtf.format(Math.round(diffMs / 86400000), 'day');
    return rtf.format(Math.round(diffMs / (86400000 * 30)), 'month');
  } catch {
    return date.toLocaleDateString();
  }
}
</script>
