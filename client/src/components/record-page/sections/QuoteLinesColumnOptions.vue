<template>
  <Popover v-slot="{ open }" class="relative">
    <PopoverButton
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      :class="open ? 'bg-gray-50 dark:bg-gray-700/50 ring-1 ring-indigo-500/30' : ''"
    >
      <ViewColumnsIcon class="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      {{ t('records.linesColumns') }}
      <ChevronDownIcon class="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
    </PopoverButton>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-0.5"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-0.5"
    >
      <PopoverPanel
        class="absolute right-0 z-50 mt-1.5 w-72 origin-top-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
      >
        <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
          <p class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('records.linesColumnsTitle') }}</p>
          <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{{ t('records.linesColumnsHint') }}</p>
        </div>

        <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
            {{ t('records.linesColumnsAlwaysOn') }}
          </p>
          <ul class="flex flex-wrap gap-1">
            <li
              v-for="col in coreColumns"
              :key="col.id"
              class="inline-flex items-center rounded bg-gray-100 dark:bg-gray-700/80 px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300"
            >
              {{ t(col.labelKey) }}
            </li>
          </ul>
        </div>

        <div class="p-2 space-y-0.5">
          <p class="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ t('records.linesColumnsOptional') }}
          </p>
          <label
            v-for="col in optionalColumns"
            :key="col.id"
            class="flex items-start gap-2.5 rounded-md px-2 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <input
              type="checkbox"
              class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
              :checked="prefs[col.id] === true"
              @change="setColumn(col.id, $event.target.checked)"
            />
            <span class="min-w-0">
              <span class="block text-xs font-medium text-gray-900 dark:text-white">{{ t(col.labelKey) }}</span>
              <span class="block text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{{ t(col.descriptionKey) }}</span>
            </span>
          </label>
        </div>

        <div class="px-2 py-2 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            class="w-full rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            @click="resetToDefaults"
          >
            {{ t('records.linesColumnsReset') }}
          </button>
        </div>
      </PopoverPanel>
    </transition>
  </Popover>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { ChevronDownIcon, ViewColumnsIcon } from '@heroicons/vue/24/outline';
import { useQuoteLinesColumnPrefs } from '@/composables/useQuoteLinesColumnPrefs';

const { t } = useI18n();
const {
  prefs,
  coreColumns,
  optionalColumns,
  setColumn,
  resetToDefaults
} = useQuoteLinesColumnPrefs();
</script>
