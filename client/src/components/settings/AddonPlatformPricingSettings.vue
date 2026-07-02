<template>
  <SettingsScrollPanel>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            :title="t('settings.addonsBackToHub')"
            @click="emit('back')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsPlatformPricing') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsPlatformPricingDesc') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="row in pricingRows"
        :key="row.addonKey"
        class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ addonTitle(row.addonKey) }}</h3>
          <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ row.billingType }}</span>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-400">{{ t('settings.addonsPricingTrialDays') }}</span>
            <input
              v-model.number="draft[row.addonKey].trialDays"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label class="block text-sm md:col-span-2">
            <span class="mb-1 block text-gray-600 dark:text-gray-400">{{ t('settings.addonsPricingDefaultPlan') }}</span>
            <select
              v-model="draft[row.addonKey].defaultPlan"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="BASIC">BASIC</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </label>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th class="py-2 pr-4">{{ t('settings.addonsPricingPlan') }}</th>
                <th class="py-2 pr-4">{{ t('settings.addonsPricingAgentLimit') }}</th>
                <th class="py-2 pr-4">{{ t('settings.addonsPricingPerAgentCents') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="planKey in planKeys" :key="planKey" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 pr-4 font-medium text-gray-900 dark:text-white">{{ planKey }}</td>
                <td class="py-2 pr-4">
                  <input
                    v-model="draft[row.addonKey].plans[planKey].agentLimit"
                    type="number"
                    min="0"
                    :placeholder="t('settings.addonsUnlimited')"
                    class="w-full max-w-[8rem] rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                  />
                </td>
                <td class="py-2 pr-4">
                  <input
                    v-model.number="draft[row.addonKey].plans[planKey].pricePerAgentCents"
                    type="number"
                    min="0"
                    class="w-full max-w-[10rem] rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="savingKey === row.addonKey"
            @click="savePricing(row.addonKey)"
          >
            {{ savingKey === row.addonKey ? t('states.saving') : t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['back']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const error = ref('');
const pricingRows = ref([]);
const savingKey = ref('');
const draft = reactive({});
const planKeys = ['BASIC', 'PRO', 'ENTERPRISE'];

function addonTitle(addonKey) {
  if (addonKey === 'live_chat') return t('settings.addonsLiveChatName');
  if (addonKey === 'email_credits') return t('settings.addonsEmailCreditsTitle');
  return addonKey;
}

function initDraft(row) {
  draft[row.addonKey] = {
    billingType: row.billingType,
    defaultPlan: row.defaultPlan,
    trialDays: row.trialDays,
    plans: {
      BASIC: { ...row.plans?.BASIC },
      PRO: { ...row.plans?.PRO },
      ENTERPRISE: { ...row.plans?.ENTERPRISE },
    },
  };
}

async function loadPricing() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/admin/addon-pricing', { method: 'GET' });
    pricingRows.value = Array.isArray(res?.pricing) ? res.pricing : [];
    for (const row of pricingRows.value) {
      initDraft(row);
    }
  } catch (err) {
    error.value = err?.message || t('settings.addonsPricingLoadFailed');
    pricingRows.value = [];
  } finally {
    loading.value = false;
  }
}

async function savePricing(addonKey) {
  savingKey.value = addonKey;
  try {
    const payload = draft[addonKey];
    const normalizePlan = (plan) => ({
      agentLimit: plan.agentLimit === '' || plan.agentLimit === undefined ? null : Number(plan.agentLimit),
      pricePerAgentCents: plan.pricePerAgentCents === '' || plan.pricePerAgentCents === undefined
        ? null
        : Number(plan.pricePerAgentCents),
      currency: plan.currency || 'USD',
    });

    await apiClient.put(`/admin/addon-pricing/${addonKey}`, {
        billingType: payload.billingType,
        defaultPlan: payload.defaultPlan,
        trialDays: payload.trialDays,
        plans: {
          BASIC: normalizePlan(payload.plans.BASIC),
          PRO: normalizePlan(payload.plans.PRO),
          ENTERPRISE: normalizePlan(payload.plans.ENTERPRISE),
        },
    });
    notifications.success(t('settings.addonsPricingSaveSuccess'));
    await loadPricing();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsPricingSaveFailed'));
  } finally {
    savingKey.value = '';
  }
}

onMounted(loadPricing);
</script>
