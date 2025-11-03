<template>
  <CardWidget title="Related Deals" class="ld-card-group">
    <template #actions>
      <button
        @click="$emit('link-deals')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Link Deals"
      >
        <LinkIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        @click="$emit('create-deal')"
        class="rounded-md bg-white dark:bg-gray-800 px-2 py-1.5 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Add Deal"
      >
        <PlusIcon class="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
    </template>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
      </div>

      <!-- Deals List -->
      <div v-else-if="deals.length > 0" class="space-y-2">
      <div
        v-for="deal in deals"
        :key="deal._id"
        class="ld-record-card p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Left icon -->
          <div class="shrink-0 mt-0.5">
            <BriefcaseIcon class="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <!-- Content -->
          <div class="min-w-0 flex-1" @click="$emit('view-deal', deal._id)">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">{{ deal.name }}</h4>
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
                  <template v-if="getFieldValue(fieldDef, deal)">
                    {{ getFieldValue(fieldDef, deal) }}
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
                  <button @click="$emit('unlink-deal', deal._id)" :class="['w-full text-left px-4 py-2 text-sm', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Unlink</button>
                </MenuItem>
                <MenuItem v-slot="{ active }" v-if="canDelete">
                  <button @click="$emit('delete-deal', deal._id)" :class="['w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-700' : '']">Delete</button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8">
        <BriefcaseIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No deals yet</p>
        <button
          @click="$emit('create-deal')"
          class="mt-2 rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Create first deal
        </button>
      </div>
  </CardWidget>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { PlusIcon, BriefcaseIcon, LinkIcon } from '@heroicons/vue/24/outline';
import CardWidget from '@/components/common/CardWidget.vue';

const props = defineProps({
  contactId: {
    type: String,
    required: false
  },
  organizationId: {
    type: String,
    required: false
  },
  accountId: {
    type: String,
    required: false
  },
  limit: {
    type: Number,
    default: 5
  },
  moduleDefinition: {
    type: Object,
    required: false
  },
  canDelete: { type: Boolean, default: false }
});

defineEmits(['create-deal', 'view-deal', 'link-deals', 'unlink-deal', 'delete-deal']);

const deals = ref([]);
const loading = ref(false);

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

const fetchDeals = async () => {
  if (!props.contactId && !props.organizationId && !props.accountId) return;
  
  loading.value = true;
  try {
    const params = {
      limit: props.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    if (props.contactId) {
      params.contactId = props.contactId;
    } else if (props.accountId) {
      params.accountId = props.accountId;
    } else if (props.organizationId) {
      params.organizationId = props.organizationId;
    }
    
    const response = await apiClient.get('/deals', { params });
    
    if (response.success) {
      deals.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching related deals:', error);
    // Handle 500 errors gracefully - set empty array instead of showing error
    if (error.response?.status === 500 || error.status === 500) {
      console.warn('Server error fetching deals, showing empty list');
      deals.value = [];
    }
    // For other errors (403, etc.), also set empty array to prevent UI issues
    if (!deals.value) {
      deals.value = [];
    }
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getStageClass = (stage) => {
  const classes = {
    'Lead': 'px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs',
    'Qualified': 'px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs',
    'Proposal': 'px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-xs',
    'Negotiation': 'px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs',
    'Closed Won': 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs',
    'Closed Lost': 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs'
  };
  return classes[stage] || 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs';
};

const getStatusClass = (status) => {
  const classes = {
    'Active': 'px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs',
    'Won': 'px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs',
    'Lost': 'px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs',
    'Cancelled': 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs'
  };
  return classes[status] || 'px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs';
};

// Watch for prop changes
watch(() => [props.contactId, props.organizationId, props.accountId], () => {
  fetchDeals();
}, { immediate: true });

// Expose refresh method
defineExpose({
  refresh: fetchDeals
});
</script>

