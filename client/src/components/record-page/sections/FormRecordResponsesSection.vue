<template>
  <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('common.summaryFormResponses') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('common.summaryFormResponsesHint') }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
        @click="context.viewAllFormResponses?.()"
      >
        {{ t('common.summaryViewAllResponses') }} →
      </button>
    </div>

    <div v-if="loading" class="p-12 text-center">
      <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-500" />
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('common.summaryLoadingResponses') }}</p>
    </div>

    <div v-else-if="responses.length > 0" class="overflow-x-auto">
      <table class="w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">{{ t('common.summaryColSubmitted') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">{{ t('common.summaryColSubmittedBy') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">{{ t('common.summaryColStatus') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">{{ t('common.summaryColScore') }}</th>
            <th class="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell sm:px-6">{{ t('common.summaryColKpis') }}</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">{{ t('common.summaryColActions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <tr
            v-for="item in responses"
            :key="item._id"
            class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            @click="context.viewFormResponseDetail?.(item)"
          >
            <td class="whitespace-nowrap px-4 py-4 sm:px-6">
              <DateCell :value="item.submittedAt" format="short" />
            </td>
            <td class="whitespace-nowrap px-4 py-4 sm:px-6">
              <div v-if="item.submittedBy" class="flex items-center gap-2">
                <Avatar
                  :user="{
                    firstName: item.submittedBy.firstName,
                    lastName: item.submittedBy.lastName,
                    email: item.submittedBy.email,
                    avatar: item.submittedBy.avatar
                  }"
                  size="sm"
                />
                <span class="text-sm text-gray-900 dark:text-white">
                  {{ item.submittedBy.firstName }} {{ item.submittedBy.lastName }}
                </span>
              </div>
              <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.summaryAnonymous') }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-4 sm:px-6">
              <BadgeCell
                :value="item.status"
                :variant-map="responseStatusVariantMap"
              />
            </td>
            <td class="whitespace-nowrap px-4 py-4 sm:px-6">
              <span v-if="item.sectionScores && typeof item.sectionScores === 'object'" class="text-sm font-medium text-gray-900 dark:text-white">
                {{ calculateOverallScore(item.sectionScores) }}%
              </span>
              <span v-else class="text-sm text-gray-500 dark:text-gray-400">—</span>
            </td>
            <td class="hidden whitespace-nowrap px-4 py-4 md:table-cell sm:px-6">
              <div v-if="item.kpis" class="space-y-0.5 text-xs">
                <div v-if="item.kpis.compliancePercentage !== undefined" class="text-gray-700 dark:text-gray-300">
                  {{ t('forms.reportCompliance') }}: {{ item.kpis.compliancePercentage }}%
                </div>
                <div v-if="item.kpis.avgRating !== undefined" class="text-gray-700 dark:text-gray-300">
                  {{ t('forms.reportRating') }}: {{ item.kpis.avgRating }}/5
                </div>
              </div>
              <span v-else class="text-sm text-gray-500 dark:text-gray-400">—</span>
            </td>
            <td class="whitespace-nowrap px-4 py-4 text-right text-sm font-medium sm:px-6">
              <button
                type="button"
                class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                @click.stop="context.viewFormResponseDetail?.(item)"
              >
                {{ t('common.viewRecord') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="pagination.totalPages > 1"
        class="flex justify-end gap-2 border-t border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6"
      >
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            :disabled="pagination.currentPage <= 1"
            @click="goPrevious"
          >
            {{ t('actions.previous') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            :disabled="pagination.currentPage >= pagination.totalPages"
            @click="goNext"
          >
            {{ t('actions.next') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="p-12 text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.summaryNoResponses') }}</h3>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('common.summaryNoResponsesHint') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const loading = computed(() => props.context?.formResponsesLoading === true);
const responses = computed(() => (Array.isArray(props.context?.formResponses) ? props.context.formResponses : []));
const pagination = computed(() => props.context?.formResponsesPagination || { currentPage: 1, totalPages: 1 });

const responseStatusVariantMap = {
  New: 'default',
  'Pending Corrective Action': 'warning',
  'Needs Auditor Review': 'info',
  Approved: 'success',
  Rejected: 'danger',
  Closed: 'default'
};

function calculateOverallScore(sectionScores) {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;
  const scores = Object.values(sectionScores).filter((s) => typeof s === 'number');
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((acc, score) => acc + score, 0) / scores.length);
}

function goPrevious() {
  if (pagination.value.currentPage <= 1) return;
  props.context?.fetchFormResponses?.(pagination.value.currentPage - 1);
}

function goNext() {
  if (pagination.value.currentPage >= pagination.value.totalPages) return;
  props.context?.fetchFormResponses?.(pagination.value.currentPage + 1);
}
</script>
