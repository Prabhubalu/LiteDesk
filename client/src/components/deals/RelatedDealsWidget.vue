<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Related Deals</h3>
      <button
        @click="$emit('create-deal')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Add Deal"
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

    <!-- Deals List -->
    <div v-else-if="deals.length > 0" class="space-y-2">
      <div
        v-for="deal in deals"
        :key="deal._id"
        @click="$emit('view-deal', deal._id)"
        class="p-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ deal.name }}</h4>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-lg font-bold text-green-600 dark:text-green-400">
                ${{ deal.amount?.toLocaleString() || 0 }}
              </span>
              <span :class="getStageClass(deal.stage)">{{ deal.stage }}</span>
            </div>
            <div class="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatDate(deal.expectedCloseDate || deal.createdAt) }}
              </span>
              <span v-if="deal.probability" class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {{ deal.probability }}%
              </span>
              <span :class="getStatusClass(deal.status)">{{ deal.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No deals yet</p>
      <button
        @click="$emit('create-deal')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Create first deal
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  contactId: {
    type: String,
    required: false
  },
  organizationId: {
    type: String,
    required: false
  },
  limit: {
    type: Number,
    default: 5
  }
});

defineEmits(['create-deal', 'view-deal']);

const deals = ref([]);
const loading = ref(false);

const fetchDeals = async () => {
  if (!props.contactId && !props.organizationId) return;
  
  loading.value = true;
  try {
    const params = {
      limit: props.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    if (props.contactId) {
      params.contactId = props.contactId;
    } else if (props.organizationId) {
      params.organizationId = props.organizationId;
    }
    
    const response = await apiClient.get('/deals', { params });
    
    if (response.success) {
      deals.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching related deals:', error);
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
watch(() => [props.contactId, props.organizationId], () => {
  fetchDeals();
}, { immediate: true });

// Expose refresh method
defineExpose({
  refresh: fetchDeals
});
</script>

