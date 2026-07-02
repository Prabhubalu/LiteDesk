<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.campaignsAbResultsTitle') }}
        </h2>
        <p v-if="results?.status" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsAbResultsStatus', { status: formatStatus(results.status) }) }}
        </p>
      </div>
      <button
        v-if="canSend && results?.status === 'testing'"
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        :disabled="selecting"
        @click="handleSelectWinner"
      >
        {{ t('marketing.campaignsAbSelectWinner') }}
      </button>
    </div>

    <div v-if="loading" class="px-5 py-10 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="results?.variants?.length" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.campaignsAbColVariant') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.campaignsFieldSubject') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.dashboardColRecipients') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.dashboardColOpenRate') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.dashboardColClickRate') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          <tr
            v-for="variant in results.variants"
            :key="variant.key"
            :class="variant.key === results.winnerVariantKey ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''"
          >
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ variant.label || variant.key }}
              <span
                v-if="variant.key === results.winnerVariantKey"
                class="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-400"
              >
                {{ t('marketing.campaignsAbWinnerBadge') }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ variant.subject || '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ variant.stats.totalRecipients }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatRate(variant.stats.openRate) }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatRate(variant.stats.clickRate) }}</td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="results.heldBackCount > 0 && results.status === 'testing'"
        class="px-5 py-3 text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('marketing.campaignsAbHeldBackHint', { count: results.heldBackCount }) }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  campaignId: {
    type: String,
    required: true
  },
  canSend: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const notifications = useNotifications();
const { fetchCampaignAbResults, selectCampaignAbWinner } = useMarketingCampaigns();

const loading = ref(false);
const selecting = ref(false);
const results = ref(null);

function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(1)}%`;
}

function formatStatus(status) {
  const map = {
    none: t('marketing.campaignsAbStatusNone'),
    testing: t('marketing.campaignsAbStatusTesting'),
    winner_selected: t('marketing.campaignsAbStatusWinnerSelected'),
    completed: t('marketing.campaignsAbStatusCompleted')
  };
  return map[status] || status;
}

async function loadResults() {
  if (!props.campaignId) return;
  loading.value = true;
  try {
    results.value = await fetchCampaignAbResults(props.campaignId);
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    loading.value = false;
  }
}

async function handleSelectWinner() {
  selecting.value = true;
  try {
    await selectCampaignAbWinner(props.campaignId);
    notifications.success(t('marketing.campaignsAbSelectWinnerSuccess'));
    await loadResults();
    emit('updated');
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    selecting.value = false;
  }
}

watch(() => props.campaignId, loadResults);
onMounted(loadResults);
</script>
