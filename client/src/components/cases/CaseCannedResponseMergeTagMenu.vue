<template>
  <Menu as="div" class="relative inline-flex">
    <MenuButton
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      :disabled="disabled"
    >
      <CodeBracketIcon class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
      {{ t('settings.helpdeskExecMergeTagInsert') }}
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
        class="absolute right-0 z-50 mt-1 max-h-72 w-80 origin-top-right overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <template v-for="(group, groupIndex) in CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS" :key="group.id">
          <p
            class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
            :class="groupIndex > 0 ? 'mt-1 border-t border-gray-100 pt-2 dark:border-gray-800' : ''"
          >
            {{ t(group.labelKey) }}
          </p>
          <MenuItem v-for="tag in group.tags" :key="tag.token" v-slot="{ active }">
            <button
              type="button"
              :class="[
                'flex w-full items-start gap-2 px-3 py-2 text-left',
                active ? 'bg-gray-100 dark:bg-gray-800' : ''
              ]"
              @click="$emit('select', tag.token)"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ t(tag.labelKey) }}</span>
                <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t(tag.descriptionKey) }}</span>
              </span>
              <code class="shrink-0 text-[11px] text-indigo-700 dark:text-indigo-300">{{ formatTag(tag.token) }}</code>
            </button>
          </MenuItem>
        </template>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { CodeBracketIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import {
  CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS,
  formatCaseCannedResponseMergeTag
} from '@/constants/caseCannedResponseMergeTags';

defineProps({
  disabled: { type: Boolean, default: false }
});

defineEmits(['select']);

const { t } = useI18n();

function formatTag(token) {
  return formatCaseCannedResponseMergeTag(token);
}
</script>
