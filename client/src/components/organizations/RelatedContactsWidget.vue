<template>
  <CardWidget title="Related Contacts" class="ld-card-group">
    <template #actions>
      <button
        @click="$emit('link-contacts')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Link Contacts"
      >
        <LinkIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        @click="$emit('create-contact')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Add Contact"
      >
        <PlusIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
      </div>

      <!-- Contacts List -->
      <div v-else-if="contacts.length > 0" class="space-y-2">
      <div
        v-for="contact in contacts"
        :key="contact._id"
        class="ld-record-card p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Avatar on left -->
          <Avatar :user="{ firstName: contact.first_name, lastName: contact.last_name, avatar: contact.avatar }" size="md" />
          <!-- Content -->
          <div class="min-w-0 flex-1" @click="$emit('view-contact', contact._id)">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">{{ (contact.first_name || '') + ' ' + (contact.last_name || '') }}</h4>
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
                  <template v-if="getFieldValue(fieldDef, contact)">
                    {{ getFieldValue(fieldDef, contact) }}
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500 italic">Empty</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Actions on right -->
          <Menu as="div" class="relative shrink-0 ld-record-more">
            <MenuButton class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <EllipsisVerticalIcon class="w-5 h-5" />
            </MenuButton>
            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute right-0 mt-2 w-40 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 z-10">
                <MenuItem v-slot="{ active }">
                  <button @click="$emit('unlink-contacts', contact._id)" :class="['w-full text-left px-4 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Unlink</button>
                </MenuItem>
                <MenuItem v-slot="{ active }" v-if="canDelete">
                  <button @click="$emit('delete-contact', contact._id)" :class="['w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-700' : '']">
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
        <UsersIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No contacts found</p>
        <button
          @click="$emit('create-contact')"
          class="mt-2 rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Add contact
        </button>
      </div>
  </CardWidget>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { EllipsisVerticalIcon, TrashIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { PlusIcon, UsersIcon, LinkIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import CardWidget from '@/components/common/CardWidget.vue';

const props = defineProps({
  organizationId: {
    type: String,
    required: false
  },
  canDelete: { type: Boolean, default: false },
  limit: {
    type: Number,
    default: 5
  },
  moduleDefinition: {
    type: Object,
    required: false
  }
});

defineEmits(['view-contact', 'create-contact', 'link-contacts']);

const contacts = ref([]);
const loading = ref(false);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const fetchContacts = async () => {
  if (!props.organizationId) return;
  
  loading.value = true;
  try {
    const data = await apiClient.get('/people', {
      params: {
        organization: props.organizationId,
        limit: props.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    });
    if (data.success) {
      contacts.value = data.data || [];
    } else {
      contacts.value = data || [];
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
    contacts.value = [];
  } finally {
    loading.value = false;
  }
};

// Watch for prop changes (works better with dynamic mounting)
watch(() => props.organizationId, () => {
  fetchContacts();
}, { immediate: true });

// Also try onMounted as fallback
onMounted(() => {
  if (props.organizationId && contacts.value.length === 0) {
    fetchContacts();
  }
});

// Expose refresh method
defineExpose({
  refresh: fetchContacts
});
</script>

