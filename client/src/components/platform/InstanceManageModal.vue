<template>
  <div
    v-if="instance"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
    @click="handleBackdropClick"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      @click.stop
    >
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('platform.instanceManagementManageInstance') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ instance.instanceName }} · {{ instance.subdomain }}</p>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
          @click="emit('close')"
        >
          <span class="text-gray-600 dark:text-gray-400 text-xl font-bold">×</span>
        </button>
      </div>

      <form class="p-6 space-y-8" @submit.prevent="handleSave">
        <section>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('platform.instanceManagementInstanceStatus') }}</h3>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {{ t('platform.instanceManagementStatus2') }}
          </label>
          <select
            v-model="form.status"
            class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="provisioning">{{ t('platform.instanceManagementProvisioning') }}</option>
            <option value="active">{{ t('settings.settingsBhStatusActive') }}</option>
            <option value="suspended">{{ t('settings.settingsAppMgmtStatusSuspended') }}</option>
            <option value="terminated">{{ t('platform.instanceManagementTerminated') }}</option>
            <option value="failed">{{ t('process.execFailed') }}</option>
          </select>
        </section>

        <section>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('platform.instanceManagementSubscription') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ t('platform.instanceManagementTier') }}
              </label>
              <select
                v-model="form.subscriptionTier"
                class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="trial">{{ t('settings.settingsSubsPlanTrial') }}</option>
                <option value="paid">{{ t('platform.instanceManagementTierPaid') }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ t('platform.instanceManagementStatus') }}
              </label>
              <select
                v-model="form.subscriptionStatus"
                class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="trial">{{ t('settings.settingsSubsPlanTrial') }}</option>
                <option value="active">{{ t('settings.settingsBhStatusActive') }}</option>
                <option value="past_due">{{ t('platform.instanceManagementPastDue') }}</option>
                <option value="canceled">{{ t('platform.instanceManagementCanceled') }}</option>
                <option value="suspended">{{ t('settings.settingsAppMgmtStatusSuspended') }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ t('platform.instanceManagementMrr') }}
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">$</span>
                <input
                  v-model.number="form.mrr"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full pl-7 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ t('platform.instanceManagementTrialEnd') }}
              </label>
              <input
                v-model="form.trialEndDate"
                type="date"
                class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('platform.instanceManagementTrialEndHint') }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="authStore.isOwner" class="rounded-lg border border-red-200 dark:border-red-900/50 p-4">
          <h3 class="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">{{ t('platform.instanceManagementDangerZone') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('platform.instanceManagementTerminateDescription') }}</p>
          <button
            type="button"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
            :disabled="terminating || instance.status === 'terminated'"
            @click="showTerminateConfirm = true"
          >
            {{ t('platform.instanceManagementTerminateInstance') }}
          </button>
        </section>

        <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            :disabled="saving"
            @click="emit('close')"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            :disabled="saving || !hasChanges"
          >
            {{ saving ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </form>
    </div>

    <DeleteConfirmationModal
      :show="showTerminateConfirm"
      :record-name="instance.instanceName"
      record-type="instance"
      :deleting="terminating"
      @close="showTerminateConfirm = false"
      @confirm="handleTerminate"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';

import { useNotifications } from '@/composables/useNotifications';
const props = defineProps({
  instance: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const { t } = useI18n();
const notifications = useNotifications();

const authStore = useAuthStore();

const saving = ref(false);
const terminating = ref(false);
const showTerminateConfirm = ref(false);

const form = reactive({
  status: '',
  subscriptionTier: '',
  subscriptionStatus: '',
  mrr: 0,
  trialEndDate: ''
});

const original = reactive({
  status: '',
  subscriptionTier: '',
  subscriptionStatus: '',
  mrr: 0,
  trialEndDate: ''
});

const toDateInputValue = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const syncForm = (instance) => {
  if (!instance) return;

  form.status = instance.status || 'provisioning';
  form.subscriptionTier = instance.subscription?.tier || 'trial';
  form.subscriptionStatus = instance.subscription?.status || 'trial';
  form.mrr = instance.subscription?.mrr ?? 0;
  form.trialEndDate = toDateInputValue(instance.subscription?.trialEndDate);

  original.status = form.status;
  original.subscriptionTier = form.subscriptionTier;
  original.subscriptionStatus = form.subscriptionStatus;
  original.mrr = form.mrr;
  original.trialEndDate = form.trialEndDate;
};

watch(
  () => props.instance,
  (instance) => {
    syncForm(instance);
    showTerminateConfirm.value = false;
  },
  { immediate: true }
);

const hasChanges = computed(() => (
  form.status !== original.status
  || form.subscriptionTier !== original.subscriptionTier
  || form.subscriptionStatus !== original.subscriptionStatus
  || form.mrr !== original.mrr
  || form.trialEndDate !== original.trialEndDate
));

const buildTrialEndDatePayload = () => {
  if (!form.trialEndDate) return null;
  const parsed = new Date(`${form.trialEndDate}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const handleBackdropClick = () => {
  if (!saving.value && !terminating.value) {
    emit('close');
  }
};

const updateLocalInstance = (updatedInstance) => {
  syncForm(updatedInstance);
  emit('saved', updatedInstance);
};

const handleSave = async () => {
  if (!props.instance || !hasChanges.value) return;

  saving.value = true;
  try {
    let latestInstance = props.instance;

    if (form.status !== original.status) {
      const statusResponse = await apiClient.patch(`/instances/${props.instance._id}/status`, {
        status: form.status
      });

      if (!statusResponse.success) {
        throw new Error(statusResponse.message || t('platform.instanceManagementSaveFailed'));
      }

      latestInstance = statusResponse.data;
    }

    const subscriptionChanged = (
      form.subscriptionTier !== original.subscriptionTier
      || form.subscriptionStatus !== original.subscriptionStatus
      || form.mrr !== original.mrr
      || form.trialEndDate !== original.trialEndDate
    );

    if (subscriptionChanged) {
      const subscriptionResponse = await apiClient.patch(`/instances/${props.instance._id}/subscription`, {
        tier: form.subscriptionTier,
        status: form.subscriptionStatus,
        mrr: form.mrr,
        trialEndDate: buildTrialEndDatePayload()
      });

      if (!subscriptionResponse.success) {
        throw new Error(subscriptionResponse.message || t('platform.instanceManagementSaveFailed'));
      }

      latestInstance = subscriptionResponse.data;
    }

    updateLocalInstance(latestInstance);
  } catch (error) {
    console.error('Error saving instance:', error);
    notifications.error(error.message || t('platform.instanceManagementSaveFailed'));
  } finally {
    saving.value = false;
  }
};

const handleTerminate = async () => {
  if (!props.instance) return;

  terminating.value = true;
  try {
    const response = await apiClient(`/instances/${props.instance._id}`, {
      method: 'DELETE'
    });

    if (!response.success) {
      throw new Error(response.message || t('platform.instanceManagementTerminateFailed'));
    }

    showTerminateConfirm.value = false;
    updateLocalInstance(response.data);
    emit('close');
  } catch (error) {
    console.error('Error terminating instance:', error);
    notifications.error(error.message || t('platform.instanceManagementTerminateFailed'));
  } finally {
    terminating.value = false;
  }
};
</script>
