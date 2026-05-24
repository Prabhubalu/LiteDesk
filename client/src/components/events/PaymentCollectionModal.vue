<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="close">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        <!-- Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('events.paymentCollectionModalCollectPayment') }}</h2>
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
              <option value="">{{ t('events.paymentCollectionModalSelectOrganization') }}</option>
              <option v-for="org in organizations" :key="org._id" :value="org._id">
                {{ org.name }}
              </option>
            </select>
          </div>

          <!-- Amount -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('settings.assignRulesCondFieldAmount') }}<span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
              <input
                v-model.number="form.amount"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
                class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Payment Method -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.paymentCollectionModalPaymentMethod') }}<span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.paymentMethod"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">{{ t('events.paymentCollectionModalSelectMethod') }}</option>
              <option value="Cash">{{ t('events.paymentCollectionModalCash') }}</option>
              <option value="Card">{{ t('events.paymentCollectionModalCard') }}</option>
              <option value="Check">{{ t('events.paymentCollectionModalCheck') }}</option>
              <option value="Bank Transfer">{{ t('events.paymentCollectionModalBankTransfer') }}</option>
              <option value="Other">{{ t('settings.settingsBhTzGroupOther') }}</option>
            </select>
          </div>

          <!-- Reference Number -->
          <div v-if="form.paymentMethod && form.paymentMethod !== 'Cash'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('events.paymentCollectionModalReferenceNumber') }}</label>
            <input
              v-model="form.referenceNumber"
              type="text"
              :placeholder="t('events.paymentCollectionModalTransactionCheckNumber')"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('forms.fieldNotes') }}</label>
            <textarea
              v-model="form.notes"
              rows="3"
              :placeholder="t('events.paymentCollectionModalPaymentNotes')"
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
              :disabled="saving"
              class="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ saving ? 'Processing...' : 'Collect Payment' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';

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

const emit = defineEmits(['close', 'collected']);

const saving = ref(false);
const organizations = ref([]);

const form = ref({
  targetOrgId: '',
  amount: 0,
  paymentMethod: '',
  referenceNumber: '',
  notes: ''
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
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

const resetForm = () => {
  form.value = {
    targetOrgId: '',
    amount: 0,
    paymentMethod: '',
    referenceNumber: '',
    notes: ''
  };
};

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    const orderData = {
      type: 'PAYMENT',
      amount: form.value.amount,
      paymentMethod: form.value.paymentMethod,
      referenceNumber: form.value.referenceNumber,
      notes: form.value.notes
    };

    const response = await apiClient.post(`/events/${props.event.eventId || props.event._id}/orders`, {
      orderData: orderData,
      orgIndex: props.orgIndex
    });

    if (response.success) {
      emit('collected', response.data);
      close();
    } else {
      alert(response.message || t('events.paymentCollectionModalToastFailedToCollectPayment'));
    }
  } catch (error) {
    console.error('Error collecting payment:', error);
    alert(t('events.paymentCollectionModalToastFailedToCollectPayment2') + (error.message || 'Unknown error'));
  } finally {
    saving.value = false;
  }
};

const close = () => {
  emit('close');
  setTimeout(resetForm, 300);
};
</script>

