<template>
  <CardWidget :key="refreshKey" title="Related Organizations" class="ld-card-group">
    <template #actions>
      <button
        @click="$emit('link-organizations')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Link Organization"
      >
        <LinkIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>
      <!-- Organization Details -->
      <div v-if="organization" class="space-y-3">
      <div class="ld-record-card p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div class="flex items-start gap-3">
          <!-- Left avatar -->
          <div class="shrink-0 mt-0.5">
            <Avatar :record="organization" size="md" />
          </div>
          <!-- Content -->
          <div class="min-w-0 flex-1" @click="$emit('view-organization', organization._id)">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">{{ organization.name }}</h4>
            <!-- Key Fields -->
            <div v-if="keyFields.length > 0" class="flex flex-wrap gap-x-4 gap-y-1">
              <div
                v-for="fieldDef in keyFields"
                :key="fieldDef.key"
                class="flex flex-col"
              >
                <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ fieldDef.label }}
                </div>
                <div class="text-xs text-gray-900 dark:text-white">
                  <template v-if="getFieldValue(fieldDef, organization)">
                    {{ getFieldValue(fieldDef, organization) }}
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500 italic">Empty</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Actions -->
          <Menu as="div" class="relative shrink-0 ld-record-more">
            <MenuButton class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <EllipsisVerticalIcon class="w-5 h-5" />
            </MenuButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute right-0 mt-2 w-40 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10">
                <MenuItem v-slot="{ active }">
                  <button @click="$emit('unlink-organization', organization._id)" :class="['w-full text-left px-4 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Unlink</button>
                </MenuItem>
                <MenuItem v-slot="{ active }" v-if="canDelete">
                  <button @click="$emit('delete-organization', organization._id)" :class="['w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-700' : '']">
                    <span class="inline-flex items-center gap-2"><TrashIcon class="w-4 h-4" /> Delete</span>
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
      </div>
      
      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <BuildingOfficeIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No organization linked</p>
      </div>
  </CardWidget>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { EllipsisVerticalIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { PlusIcon, BuildingOfficeIcon, LinkIcon } from '@heroicons/vue/24/outline';
import CardWidget from '@/components/common/CardWidget.vue';
import Avatar from '@/components/common/Avatar.vue';

const props = defineProps({
  organization: {
    type: Object,
    default: null
  },
  canDelete: { type: Boolean, default: false },
  moduleDefinition: {
    type: Object,
    required: false
  }
});

defineEmits(['view-organization', 'link-organization', 'unlink-organization', 'link-organizations', 'delete-organization']);

// Expose a refresh hook so parent can force a rerender after external mutations
const refreshKey = ref(0);
defineExpose({
  refresh: () => {
    refreshKey.value += 1;
  }
});

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const formatWebsite = (website) => {
  if (!website) return '';
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }
  return `https://${website}`;
};
</script>

