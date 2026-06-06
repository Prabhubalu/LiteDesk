<template>
  <Menu as="div" class="relative">
    <MenuButton
      class="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {{ t('common.filterBuilderSavedFilters') }}
      <ChevronDownIcon class="h-3.5 w-3.5 text-gray-400" />
    </MenuButton>
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <MenuItems
        class="absolute right-0 z-[70] mt-1 w-56 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
      >
        <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <button
            type="button"
            class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            @click="openSaveDialog"
          >
            {{ t('common.filterBuilderSaveCurrent') }}
          </button>
        </div>
        <div v-if="presets.length === 0" class="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('common.filterBuilderNoSavedFilters') }}
        </div>
        <MenuItem
          v-for="preset in presets"
          :key="preset.id"
          v-slot="{ active }"
        >
          <div
            :class="[
              'flex items-center justify-between gap-2 px-3 py-2 text-sm',
              active ? 'bg-gray-100 dark:bg-gray-700' : '',
            ]"
          >
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-gray-900 dark:text-gray-100"
              @click="$emit('apply-preset', preset.id)"
            >
              {{ preset.name }}
            </button>
            <button
              type="button"
              class="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              :aria-label="t('common.filterBuilderDeletePreset', { name: preset.name })"
              @click.stop="$emit('delete-preset', preset.id)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </MenuItem>
      </MenuItems>
    </Transition>
  </Menu>

  <div
    v-if="showSaveDialog"
    class="fixed inset-0 z-[10060] flex items-center justify-center bg-black/30 p-4"
    @click.self="showSaveDialog = false"
  >
    <div class="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('common.filterBuilderSavePresetTitle') }}
      </h4>
      <input
        v-model="presetName"
        type="text"
        :placeholder="t('common.filterBuilderSavePresetPlaceholder')"
        class="mt-3 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        @keydown.enter.prevent="confirmSave"
      />
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400"
          @click="showSaveDialog = false"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="confirmSave"
        >
          {{ t('actions.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronDownIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { Transition } from 'vue';
import type { SavedFilterPreset } from '@/composables/useSavedFilterPresets';

defineProps<{
  presets: SavedFilterPreset[];
}>();

const emit = defineEmits<{
  (e: 'apply-preset', id: string): void;
  (e: 'delete-preset', id: string): void;
  (e: 'save-preset', name: string): void;
}>();

const { t } = useI18n();
const showSaveDialog = ref(false);
const presetName = ref('');

function openSaveDialog() {
  presetName.value = '';
  showSaveDialog.value = true;
}

function confirmSave() {
  const name = presetName.value.trim();
  if (!name) return;
  emit('save-preset', name);
  showSaveDialog.value = false;
}
</script>
