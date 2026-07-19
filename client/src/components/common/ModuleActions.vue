<template>
  <div class="flex flex-nowrap items-center gap-2">
    <!-- Create Button -->
    <PermissionButton
      v-if="showCreate"
      :module="module"
      action="create"
      variant="primary"
      size="compact"
      icon-only-mobile
      icon="plus"
      icon-class="w-4 h-4"
      :title="createLabel"
      @click="$emit('create')"
    >
      <span class="hidden sm:inline">{{ createLabel }}</span>
    </PermissionButton>

    <!-- More Actions (Import/Export) Dropdown -->
    <Menu v-if="hasImportOrExport" as="div" class="relative">
      <MenuButton
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none"
        :aria-label="t('common.moreActions')"
      >
        <EllipsisVerticalIcon class="w-4 h-4" />
      </MenuButton>
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems class="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none">
          <div class="py-1">
            <MenuItem v-if="showImport && canImport" v-slot="{ active }">
              <button
                @click="$emit('import')"
                :class="[
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                ]"
              >
                <ArrowDownTrayIcon class="w-4 h-4" />
                {{ t('common.importData') }}
              </button>
            </MenuItem>
            <MenuItem v-if="showExport && canExport" v-slot="{ active }">
              <button
                @click="$emit('export')"
                :class="[
                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                  'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                ]"
              >
                <ArrowUpTrayIcon class="w-4 h-4" />
                {{ t('common.exportData') }}
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { EllipsisVerticalIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/vue/24/outline';
import PermissionButton from './PermissionButton.vue';
import { useAuthStore } from '@/stores/authRegistry';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  module: {
    type: String,
    required: true
  },
  createLabel: {
    type: String,
    default: 'New'
  },
  showCreate: {
    type: Boolean,
    default: true
  },
  showImport: {
    type: Boolean,
    default: true
  },
  showExport: {
    type: Boolean,
    default: true
  }
});

defineEmits(['create', 'import', 'export']);

const authStore = useAuthStore();
const canImport = computed(() => authStore.can(props.module, 'create'));
const canExport = computed(() => authStore.can(props.module, 'exportData'));
const hasImportOrExport = computed(() => {
  return (props.showImport && canImport.value) || (props.showExport && canExport.value);
});
</script>

