<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.campaignsApprovalsTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.campaignsApprovalsDescription') }}
        </p>
      </div>
      <router-link
        :to="{ name: 'marketing-campaigns' }"
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {{ t('marketing.dashboardActionCampaigns') }}
      </router-link>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <div
      v-else-if="!campaigns.length"
      class="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700"
    >
      <p class="text-base font-medium text-gray-900 dark:text-white">
        {{ t('marketing.campaignsApprovalsEmptyTitle') }}
      </p>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {{ t('marketing.campaignsApprovalsEmptyMessage') }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.campaignsColName') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.campaignsColSubject') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {{ t('marketing.campaignsColUpdated') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          <tr
            v-for="campaign in campaigns"
            :key="campaign._id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
            @click="openCampaign(campaign._id)"
          >
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ campaign.name }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              {{ campaign.subject || '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(campaign.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { captureMarketingModuleVisited } from '@/config/posthogMarketing';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const router = useRouter();
const loading = ref(true);
const campaigns = ref([]);
const { fetchPendingApprovals } = useMarketingCampaigns();

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatUserDateTime(date) || '—';
}

function openCampaign(id) {
  router.push({ name: 'marketing-campaign-detail', params: { id } });
}

async function loadPage() {
  loading.value = true;
  try {
    const response = await fetchPendingApprovals();
    campaigns.value = Array.isArray(response?.data) ? response.data : [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  captureMarketingModuleVisited('campaign-approvals', { route: '/marketing/campaigns/approvals' });
  void loadPage();
});
</script>
