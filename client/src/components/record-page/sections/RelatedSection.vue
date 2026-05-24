<template>
  <section class="space-y-3">
    <h3 v-if="showHeader" class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h3>

    <div
      v-if="!groups.length"
      class="flex flex-col items-center justify-center py-8 text-center"
    >
      <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <LinkIcon class="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ t('records.relatedEmpty') }}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('records.relatedEmptyHint') }}</p>
    </div>

    <div v-else class="space-y-5">
      <details
        v-for="group in groups"
        :key="group.key"
        class="group/related-module"
        open
      >
        <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
          <div class="flex items-center gap-2">
            <ChevronRightIcon class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 group-open/related-module:rotate-90" />
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ group.label }}</h3>
            <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {{ (group.items || []).length }}
            </span>
          </div>
        </summary>

        <div class="mt-2 space-y-2">
          <div
            v-for="item in group.items || []"
            :key="item.id"
            class="group/related-card flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openItem(item, group)"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.title || t('records.relatedUntitled') }}</p>
              <p v-if="item.meta" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.meta }}</p>
            </button>
            <div v-if="showUnlinkMenu(item, group)" class="flex items-center gap-1.5 shrink-0">
              <Menu as="div" class="relative">
                <MenuButton
                  class="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 opacity-0 transition-opacity duration-150 group-hover/related-card:opacity-100 focus:opacity-100"
                  :aria-label="t('records.relatedActionsAria')"
                  @click.stop
                >
                  <EllipsisVerticalIcon class="h-4 w-4" />
                </MenuButton>
                <transition
                  enter-active-class="transition ease-out duration-100"
                  enter-from-class="transform opacity-0 scale-95"
                  enter-to-class="transform opacity-100 scale-100"
                  leave-active-class="transition ease-in duration-75"
                  leave-from-class="transform opacity-100 scale-100"
                  leave-to-class="transform opacity-0 scale-95"
                >
                  <MenuItems
                    class="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
                  >
                    <MenuItem v-slot="{ active }">
                      <button
                        type="button"
                        :class="[
                          'w-full px-3 py-2 text-left text-sm transition-colors duration-150',
                          active ? 'bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                        ]"
                        @click.stop="handleUnlink(item, group)"
                      >
                        {{ t('records.relatedUnlink') }}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronRightIcon, LinkIcon, EllipsisVerticalIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const groups = computed(() => {
  const value = props.adapter?.getRelatedGroups?.(props.record, props.context);
  return Array.isArray(value) ? value : [];
});

const showHeader = computed(() => props.context?.hideHeader !== true);

function showUnlinkMenu(item, group) {
  return typeof props.adapter?.canUnlinkRelated === 'function' &&
    props.adapter.canUnlinkRelated(item, group, props.record, props.context) &&
    typeof props.adapter?.onUnlinkRelated === 'function';
}

function handleUnlink(item, group) {
  if (typeof props.adapter?.onUnlinkRelated === 'function') {
    props.adapter.onUnlinkRelated(item, group, props.record, props.context);
  }
}

const openItem = (item, group) => {
  if (typeof item?.onOpen === 'function') {
    item.onOpen(item, group, props.record, props.context);
    return;
  }
  props.adapter?.openRelatedItem?.(item, group, props.record, props.context);
};
</script>
