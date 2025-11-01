<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Related Contacts</h3>
      <button
        @click="$emit('create-contact')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Add Contact"
      >
        <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
    </div>

    <!-- Contacts List -->
    <div v-else-if="contacts.length > 0" class="space-y-2">
      <div
        v-for="contact in contacts"
        :key="contact._id"
        @click="$emit('view-contact', contact._id)"
        class="p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ contact.name }}</h4>
            <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="contact.email" class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {{ contact.email }}
              </span>
              <span v-if="contact.phone" class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {{ contact.phone }}
              </span>
            </div>
            <div v-if="contact.title" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ contact.title }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No contacts found</p>
      <button
        @click="$emit('create-contact')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Add contact
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  organizationId: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    default: 5
  }
});

defineEmits(['view-contact', 'create-contact']);

const contacts = ref([]);
const loading = ref(false);

const fetchContacts = async () => {
  loading.value = true;
  try {
    const data = await apiClient.get('/contacts', {
      params: {
        organizationId: props.organizationId,
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

onMounted(() => {
  if (props.organizationId) {
    fetchContacts();
  }
});
</script>

