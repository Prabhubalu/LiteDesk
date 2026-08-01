<template>
  <section class="mb-5">
    <div
      class="overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-gray-700/50 dark:bg-gray-900/95"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100/80 px-4 py-3 dark:border-gray-800/80">
        <div class="min-w-0">
          <h2 class="text-sm font-medium tracking-tight text-gray-900 dark:text-white">
            {{ t('marketing.campaignsTenantStatsTitle') }}
          </h2>
          <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ t('marketing.campaignsTenantStatsSubtitle') }}
          </p>
        </div>
        <span
          v-if="policy?.warmupStage"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800/80 dark:text-gray-300"
        >
          <BoltIcon class="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
          <span>{{ t('settings.emailPolicyWarmupStage') }}</span>
          <span class="font-medium text-gray-900 dark:text-white">{{ warmupStageLabel }}</span>
        </span>
      </div>

      <div v-if="loading" class="grid divide-y divide-gray-100 dark:divide-gray-800 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <div
          v-for="index in 4"
          :key="index"
          class="animate-pulse px-4 py-4"
        >
          <div class="h-2.5 w-16 rounded bg-gray-100 dark:bg-gray-800" />
          <div class="mt-3 h-7 w-24 rounded bg-gray-100 dark:bg-gray-800" />
          <div class="mt-2 h-2 w-20 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>

      <template v-else-if="policy">
        <div class="grid divide-y divide-gray-100 dark:divide-gray-800 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div class="px-4 py-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ t('marketing.campaignsMaxSendableRecipients') }}
            </p>
            <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
              {{ maxSendableLabel }}
            </p>
            <p
              v-if="limitingFactorLabel"
              class="mt-1.5 text-xs"
              :class="capacityBlocked ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ limitingFactorLabel }}
            </p>
          </div>

          <div class="px-4 py-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ t('settings.emailPolicyCreditsTitle') }}
            </p>
            <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
              {{ creditsRemainingLabel }}
            </p>
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.emailPolicyCreditsReserved') }}:
              <span
                class="font-medium tabular-nums"
                :class="creditsReserved > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'"
              >
                {{ creditsReservedLabel }}
              </span>
            </p>
          </div>

          <div class="px-4 py-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ t('settings.emailPolicyReputationTitle') }}
            </p>
            <div class="mt-1.5 flex items-baseline gap-2">
              <p class="text-2xl font-semibold tabular-nums tracking-tight" :class="reputationScoreClassValue">
                {{ reputationScoreLabel }}
              </p>
              <p
                v-if="reputationDelta != null && reputationDelta !== 0"
                class="text-xs font-medium tabular-nums"
                :class="reputationDelta > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'"
              >
                {{ reputationDelta > 0 ? '+' : '−' }}{{ formatNumber(Math.abs(Number(reputationDelta))) }}
              </p>
            </div>
            <div
              v-if="reputationScore != null"
              class="mt-2.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
              role="progressbar"
              :aria-valuenow="reputationScore"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full transition-all duration-700 ease-out"
                :class="reputationBarClass"
                :style="{ width: `${Math.min(100, Math.max(0, reputationScore))}%` }"
              />
            </div>
            <p
              v-if="reputationBlocked"
              class="mt-1.5 text-[11px] text-red-600 dark:text-red-400"
            >
              {{ t('marketing.campaignsReputationBlocked') }}
            </p>
          </div>

          <div class="px-4 py-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ t('settings.emailPolicyThroughputTitle') }}
            </p>
            <p
              class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight"
              :class="throughputThrottled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'"
            >
              {{ effectiveRateLabel }}
            </p>
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.emailPolicyMaxHourlyRate') }}
              <span class="font-medium tabular-nums text-gray-700 dark:text-gray-300">{{ maxRateLabel }}</span>
              <span class="mx-1 text-gray-300 dark:text-gray-600">·</span>
              {{ t('settings.emailPolicyMaxCampaignSize') }}
              <span class="font-medium tabular-nums text-gray-700 dark:text-gray-300">{{ maxCampaignSizeLabel }}</span>
            </p>
          </div>
        </div>

        <div
          v-if="policy.amdsSyncError"
          class="border-t border-gray-100/80 px-4 py-2.5 dark:border-gray-800/80"
        >
          <p class="text-xs text-red-600 dark:text-red-400">
            {{ t('settings.emailPolicySyncError', { message: policy.amdsSyncError }) }}
          </p>
        </div>
      </template>

      <div v-else-if="error" class="px-4 py-4">
        <p class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { BoltIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { formatNumber } from '@/utils/localeFormat';
import {
  reputationScoreClass,
  reputationScoreTone
} from '@/utils/reputationScoreTone';

const { t } = useI18n();

const loading = ref(false);
const error = ref('');
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const policy = ref(null);

function formatLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return t('settings.emailPolicyUnlimited');
  return formatNumber(num);
}

const minReputation = computed(() => Number(policy.value?.marketingMinSenderReputation) || 40);

const reputationScore = computed(() => {
  const score = policy.value?.senderReputation;
  return score != null ? Number(score) : null;
});

const reputationDelta = computed(() => {
  const delta = policy.value?.reputationDelta;
  return delta != null ? Number(delta) : null;
});

const reputationBlocked = computed(() => {
  return reputationScore.value != null && reputationScore.value < minReputation.value;
});

const reputationScoreClassValue = computed(() => reputationScoreClass(reputationScore.value));

const reputationTone = computed(() => reputationScoreTone(reputationScore.value));

const reputationBarClass = computed(() => {
  if (reputationTone.value === 'success') return 'bg-emerald-500/90 dark:bg-emerald-400';
  if (reputationTone.value === 'warning') return 'bg-amber-500/90 dark:bg-amber-400';
  if (reputationTone.value === 'danger') return 'bg-red-500/90 dark:bg-red-400';
  return 'bg-gray-400';
});

const maxSendableLabel = computed(() =>
  formatNumber(Number(policy.value?.maxSendableRecipients ?? 0))
);

const capacityBlocked = computed(() => {
  const factor = policy.value?.sendCapacityLimitingFactor;
  return factor === 'reputation' || factor === 'suspended';
});

const limitingFactorLabel = computed(() => {
  const factor = policy.value?.sendCapacityLimitingFactor;
  if (factor === 'maxCampaignSize') {
    return t('marketing.campaignsMaxSendableLimitedByCampaignSize');
  }
  if (factor === 'credits') {
    return t('marketing.campaignsMaxSendableLimitedByCredits');
  }
  if (factor === 'dailySendLimit') {
    return t('marketing.campaignsMaxSendableLimitedByDaily');
  }
  if (factor === 'throughputDaily') {
    return t('marketing.campaignsMaxSendableLimitedByThroughput', {
      count: formatNumber(Number(policy.value?.throughputDaily || 0))
    });
  }
  if (factor === 'reputation') {
    return t('marketing.campaignsMaxSendableLimitedByReputation');
  }
  if (factor === 'suspended') {
    return t('marketing.campaignsMaxSendableSuspended');
  }
  return '';
});

const creditsRemaining = computed(() => Number(policy.value?.creditsRemaining || 0));
const creditsReserved = computed(() => Number(policy.value?.creditsReserved || 0));

const creditsRemainingLabel = computed(() => formatNumber(creditsRemaining.value));
const creditsReservedLabel = computed(() => formatNumber(creditsReserved.value));

const reputationScoreLabel = computed(() =>
  reputationScore.value != null ? formatNumber(reputationScore.value) : '—'
);

const effectiveRateLabel = computed(() => {
  const effective = policy.value?.effectiveHourlyRate;
  if (effective != null) return `${formatLimit(effective)}/hr`;
  return `${formatLimit(policy.value?.maxHourlyRate)}/hr`;
});

const maxRateLabel = computed(() => `${formatLimit(policy.value?.maxHourlyRate)}/hr`);
const maxCampaignSizeLabel = computed(() => formatLimit(policy.value?.maxCampaignSize));

const throughputThrottled = computed(() => {
  const effective = Number(policy.value?.effectiveHourlyRate);
  const max = Number(policy.value?.maxHourlyRate);
  if (!Number.isFinite(effective) || !Number.isFinite(max) || max <= 0) return false;
  return effective < max * 0.9 || Boolean(policy.value?.warmupStage);
});

const warmupStageLabel = computed(() => {
  const stage = String(policy.value?.warmupStage || '');
  const match = stage.match(/^day_(\d+)$/i);
  if (match) return `Day ${match[1]}`;
  return stage.replace(/_/g, ' ');
});

async function loadPolicy() {
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient.get('/marketing/campaigns/send-policy', { cache: 'no-store' });
    policy.value = response?.data || null;
  } catch (err) {
    policy.value = null;
    error.value = err?.message || t('marketing.campaignsTenantStatsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadPolicy();
});

defineExpose({ reload: loadPolicy });
</script>
