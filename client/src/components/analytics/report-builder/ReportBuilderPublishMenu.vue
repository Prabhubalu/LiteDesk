<template>
  <div class="inline-flex rounded-lg shadow-sm">
    <button
      type="button"
      :class="[rbBtnPrimary, 'rounded-r-none !px-2.5 !py-1.5 !text-xs']"
      :disabled="disabled"
      @click="$emit('publish')"
    >
      {{ t('analytics.builderPublishReport') }}
    </button>
    <Menu as="div" class="relative -ml-px">
      <MenuButton
        type="button"
        :class="[
          rbBtnPrimary,
          'rounded-l-none border-l border-indigo-400/40 !px-1.5 !py-1.5 disabled:opacity-50',
        ]"
        :disabled="disabled"
      >
        <span class="sr-only">{{ t('analytics.builderPublishOptions') }}</span>
        <ChevronDownIcon class="h-4 w-4" aria-hidden="true" />
      </MenuButton>
      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <MenuItems
          class="absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-lg border border-zinc-200 bg-white py-1 shadow-lg focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              :class="[
                active ? 'bg-zinc-100 dark:bg-zinc-800' : '',
                'block w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200',
              ]"
              @click="$emit('publish-with-schedule')"
            >
              {{ t('analytics.builderPublishWithSchedule') }}
            </button>
          </MenuItem>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { rbBtnPrimary } from '@/components/analytics/report-builder/reportBuilderUi';

defineProps<{
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'publish'): void;
  (e: 'publish-with-schedule'): void;
}>();

const { t } = useI18n();
</script>
