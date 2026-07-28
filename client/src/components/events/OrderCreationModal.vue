<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="close">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('events.orderCreationModalCreateOrder') }}</h2>
            <button @click="close" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
          <!-- Organization -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.profileMetaOrg') }}<span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.targetOrgId"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">{{ t('events.orderCreationModalSelectOrganization') }}</option>
              <option v-for="org in organizations" :key="org._id" :value="org._id">
                {{ org.name }}
              </option>
            </select>
          </div>

          <!-- Order Items -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('events.orderCreationModalOrderItems') }}<span class="text-red-500">*</span>
            </label>
            <div class="space-y-3">
              <div
                v-for="(item, index) in form.items"
                :key="index"
                class="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div class="flex-1 grid grid-cols-3 gap-3">
                  <input
                    v-model="item.name"
                    type="text"
                    :placeholder="t('events.orderCreationModalItemName')"
                    required
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    required
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    v-model.number="item.unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    :placeholder="t('events.orderCreationModalUnitPrice')"
                    required
                    class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <button
                  type="button"
                  @click="removeItem(index)"
                  class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                @click="addItem"
                class="w-full px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700"
              >
                + Add Item
              </button>
            </div>
          </div>

          <!-- Order Summary -->
          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('events.orderCreationModalSubtotal') }}</span>
              <span class="text-lg font-bold text-gray-900 dark:text-white">
                {{ currency }} {{ subtotal.toFixed(2) }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('events.orderCreationModalTotal') }}</span>
              <span class="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {{ currency }} {{ total.toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('forms.fieldNotes') }}</label>
            <textarea
              v-model="form.notes"
              rows="3"
              :placeholder="t('events.orderCreationModalAdditionalNotes')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              @click="close"
              class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >{{ t('performance.cancelWizard') }}</button>
            <button
              type="submit"
              :disabled="saving || form.items.length === 0"
              class="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ saving ? 'Creating...' : 'Create Order' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import apiClient from '@/utils/apiClient';
import { resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';

import { useNotifications } from '@/composables/useNotifications';
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  event: {
    type: Object,
    required: true
  },
  orgIndex: {
    type: Number,
    default: null
  }
});

const { t } = useI18n();
const notifications = useNotifications();

const authStore = useAuthStore();

const emit = defineEmits(['close', 'created']);

const saving = ref(false);
const organizations = ref([]);
const currency = ref(resolveOrgCurrencyCode(authStore.organization));

const form = ref({
  targetOrgId: '',
  items: [
    { name: '', quantity: 1, unitPrice: 0 }
  ],
  notes: ''
});

const subtotal = computed(() => {
  return form.value.items.reduce((sum, item) => {
    return sum + ((item.quantity || 0) * (item.unitPrice || 0));
  }, 0);
});

const total = computed(() => {
  return subtotal.value; // Can add tax, discount, etc.
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currency.value = resolveOrgCurrencyCode(authStore.organization);
    fetchOrganizations();
    resetForm();
    
    // Pre-select org if multi-org route
    if (props.event.isMultiOrg && props.orgIndex !== null && props.orgIndex !== undefined) {
      const org = props.event.orgList?.[props.orgIndex];
      if (org) {
        form.value.targetOrgId = org.organizationId?._id || org.organizationId || '';
      }
    } else if (props.event.relatedToId) {
      form.value.targetOrgId = props.event.relatedToId?._id || props.event.relatedToId || '';
    }
  }
});

const fetchOrganizations = async () => {
  try {
    const response = await apiClient.get('/organization');
    if (response.success) {
      organizations.value = response.data || [];
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
  }
};

const addItem = () => {
  form.value.items.push({ name: '', quantity: 1, unitPrice: 0 });
};

const removeItem = (index) => {
  if (form.value.items.length > 1) {
    form.value.items.splice(index, 1);
  }
};

const resetForm = () => {
  form.value = {
    targetOrgId: '',
    items: [
      { name: '', quantity: 1, unitPrice: 0 }
    ],
    notes: ''
  };
};

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    const orderData = {
      items: form.value.items.filter(item => item.name && item.quantity > 0 && item.unitPrice > 0),
      subtotal: subtotal.value,
      total: total.value,
      currency: currency.value,
      notes: form.value.notes
    };

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/orders`, {
      orderData: orderData,
      orgIndex: props.orgIndex
    });

    if (response.success) {
      emit('created', response.data);
      close();
    } else {
      notifications.error(response.message || t('events.orderCreationModalToastFailedToCreateOrder'));
    }
  } catch (error) {
    console.error('Error creating order:', error);
    notifications.error(t('events.orderCreationModalToastFailedToCreateOrder2') + (error.message || 'Unknown error'));
  } finally {
    saving.value = false;
  }
};

const close = () => {
  emit('close');
  setTimeout(resetForm, 300);
};
</script>

