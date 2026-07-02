<template>
  <section class="email-policy-credits">
    <div
      v-if="loading"
      class="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
    >
      <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-indigo-600" />
      {{ t('states.loading') }}
    </div>

    <template v-else-if="policy">
      <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('settings.emailPolicyCreditsTitle') }}
      </h4>
      <p class="mb-4 text-xs text-gray-600 dark:text-gray-400">
        {{ t('settings.emailPolicyCreditsSubtitle') }}
      </p>

      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="item in summaryItems"
          :key="item.key"
          class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
        >
          <dt class="text-xs text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
          <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{{ item.value }}</dd>
        </div>
      </dl>

      <section
        v-if="policy.senderReputation != null"
        class="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <h5 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.emailPolicyReputationTitle') }}
        </h5>
        <p class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {{ policy.senderReputation }} / 100
        </p>
        <p
          v-if="policy.reputationDelta != null && policy.reputationDelta !== 0"
          class="mt-1 text-sm"
          :class="policy.reputationDelta > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'"
        >
          {{ policy.reputationDelta > 0 ? '▲' : '▼' }}
          {{ t('settings.emailPolicyReputationDelta', { delta: Math.abs(Number(policy.reputationDelta)) }) }}
        </p>
        <ul v-if="reputationFactors.length" class="mt-3 space-y-2">
          <li
            v-for="(factor, index) in reputationFactors"
            :key="`${factor.signal || factor.message}-${index}`"
            class="text-sm text-gray-700 dark:text-gray-200"
          >
            <span>{{ factor.impact === 'positive' ? '✓' : '✗' }}</span>
            {{ factor.message }}
          </li>
        </ul>
        <p
          v-if="showRecoveryBanner"
          class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
        >
          {{ t('settings.emailPolicyReputationRecoveryBanner', { remaining: reputationRemainingGainToday }) }}
        </p>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.emailPolicyReputationHint') }}
        </p>
      </section>

      <section
        v-if="hasGuidance"
        class="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <h5 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.emailPolicyGuidanceTitle') }}
        </h5>
        <p
          v-if="showHighPriorityAlert"
          class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200"
        >
          {{ t('settings.emailPolicyGuidanceHighPriorityAlert') }}
        </p>
        <ul v-if="guidanceReasons.length" class="mt-3 space-y-2">
          <li
            v-for="(reason, index) in guidanceReasons"
            :key="`${reason.signal || reason.message}-${index}`"
            class="text-sm text-gray-700 dark:text-gray-200"
          >
            <span>{{ guidanceReasonIcon(reason.status) }}</span>
            {{ reason.message }}
          </li>
        </ul>
        <div v-if="groupedRecommendations.length" class="mt-4 space-y-4">
          <div
            v-for="group in groupedRecommendations"
            :key="group.priority"
          >
            <h6 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ guidancePriorityLabel(group.priority) }}
            </h6>
            <ul class="mt-2 space-y-2">
              <li
                v-for="(item, index) in group.items"
                :key="`${item.category || item.message}-${index}`"
                class="text-sm text-gray-700 dark:text-gray-200"
              >
                {{ item.message }}
              </li>
            </ul>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.emailPolicyGuidanceHint') }}
        </p>
      </section>

      <section
        v-if="policy.effectiveHourlyRate != null"
        class="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        <h5 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.emailPolicyThroughputTitle') }}
        </h5>
        <p
          v-if="showInfraLoadBanner"
          class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
        >
          {{ t('settings.emailPolicyInfraLoadBanner') }}
        </p>
        <dl class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.emailPolicyMaxHourlyRate') }}</dt>
            <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatLimit(policy.maxHourlyRate) }}/hr
            </dd>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.emailPolicyEffectiveHourlyRate') }}</dt>
            <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
              {{ formatLimit(policy.effectiveHourlyRate) }}/hr
            </dd>
          </div>
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.emailPolicyWarmupStage') }}</dt>
            <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
              {{ policy.warmupStage || '—' }}
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.emailPolicyThroughputHint') }}
        </p>
      </section>

      <p
        v-if="policy.amdsSyncError"
        class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200"
      >
        {{ t('settings.emailPolicySyncError', { message: policy.amdsSyncError }) }}
      </p>

      <div v-if="canManage" class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          :disabled="syncing"
          @click="forceSync"
        >
          {{ syncing ? t('states.loading') : t('settings.emailPolicyForceSync') }}
        </button>
      </div>
    </template>

    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  canManage: { type: Boolean, default: false }
});

const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(false);
const syncing = ref(false);
const error = ref('');
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const policy = ref(null);

function formatLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return t('settings.emailPolicyUnlimited');
  return num.toLocaleString();
}

const summaryItems = computed(() => {
  if (!policy.value) return [];
  return [
    {
      key: 'creditsRemaining',
      label: t('settings.emailPolicyCreditsRemaining'),
      value: Number(policy.value.creditsRemaining || 0).toLocaleString()
    },
    {
      key: 'creditsReserved',
      label: t('settings.emailPolicyCreditsReserved'),
      value: Number(policy.value.creditsReserved || 0).toLocaleString()
    },
    {
      key: 'monthlyCredits',
      label: t('settings.emailPolicyMonthlyCredits'),
      value: Number(policy.value.monthlyCredits || 0).toLocaleString()
    },
    {
      key: 'dailySendLimit',
      label: t('settings.emailPolicyDailySendLimit'),
      value: formatLimit(policy.value.dailySendLimit)
    },
    {
      key: 'maxHourlyRate',
      label: t('settings.emailPolicyMaxHourlyRate'),
      value: `${formatLimit(policy.value.maxHourlyRate)}/hr`
    },
    {
      key: 'maxCampaignSize',
      label: t('settings.emailPolicyMaxCampaignSize'),
      value: formatLimit(policy.value.maxCampaignSize)
    }
  ];
});

const reputationFactors = computed(() =>
  Array.isArray(policy.value?.reputationFactors) ? policy.value.reputationFactors : []
);

const guidanceReasons = computed(() =>
  Array.isArray(policy.value?.reputationGuidanceReasons) ? policy.value.reputationGuidanceReasons : []
);

const guidanceRecommendations = computed(() =>
  Array.isArray(policy.value?.reputationGuidanceRecommendations)
    ? policy.value.reputationGuidanceRecommendations
    : []
);

const hasGuidance = computed(
  () => guidanceReasons.value.length > 0 || guidanceRecommendations.value.length > 0
);

const showHighPriorityAlert = computed(() => {
  const score = Number(policy.value?.senderReputation);
  if (!Number.isFinite(score) || score >= 40) return false;
  return guidanceRecommendations.value.some((item) => item?.priority === 'high');
});

const reputationRemainingGainToday = computed(() => {
  const value = Number(policy.value?.reputationRemainingGainToday);
  return Number.isFinite(value) ? value : null;
});

const showRecoveryBanner = computed(() => {
  const remaining = reputationRemainingGainToday.value;
  return remaining != null && remaining < 3;
});

const showInfraLoadBanner = computed(() => {
  const multiplier = Number(policy.value?.infraMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 && multiplier < 1;
});

const groupedRecommendations = computed(() => {
  const priorityOrder = ['high', 'medium', 'low'];
  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const buckets = { high: [], medium: [], low: [] };

  for (const item of guidanceRecommendations.value) {
    const priority = String(item?.priority || 'medium');
    if (buckets[priority]) {
      buckets[priority].push(item);
    } else {
      buckets.medium.push(item);
    }
  }

  return priorityOrder
    .filter((priority) => buckets[priority].length > 0)
    .map((priority) => ({ priority, items: buckets[priority] }));
});

function guidanceReasonIcon(status) {
  if (status === 'passed') return '✓';
  if (status === 'warning') return '⚠';
  if (status === 'failed') return '✗';
  return '•';
}

function guidancePriorityLabel(priority) {
  if (priority === 'high') return t('settings.emailPolicyGuidancePriorityHigh');
  if (priority === 'low') return t('settings.emailPolicyGuidancePriorityLow');
  return t('settings.emailPolicyGuidancePriorityMedium');
}

async function loadPolicy() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiClient('/settings/email-policy', { method: 'GET' });
    policy.value = data?.data || null;
  } catch (err) {
    policy.value = null;
    error.value = err?.message || t('settings.emailPolicyLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function forceSync() {
  syncing.value = true;
  try {
    const data = await apiClient('/settings/email-policy/sync', { method: 'GET' });
    policy.value = data?.data || policy.value;
    notifications.success(t('settings.emailPolicySyncSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('settings.emailPolicySyncFailed'));
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  void loadPolicy();
});

defineExpose({ reload: loadPolicy });
</script>
