<template>
  <div v-if="visible" class="space-y-2">
    <div
      class="rounded-lg border px-3 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      :class="bannerClass"
    >
      <div class="min-w-0">
        <div class="font-medium">{{ bannerTitle }}</div>
        <div v-if="bannerDetail" class="text-xs mt-0.5 opacity-90">{{ bannerDetail }}</div>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <div
      v-if="processApprovals.length"
      class="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-900/20 px-3 py-2.5 text-sm"
    >
      <div class="font-medium text-indigo-900 dark:text-indigo-100">
        {{ t('records.quoteProcessApprovalTitle') }}
      </div>
      <ul class="mt-2 space-y-2">
        <li
          v-for="approval in processApprovals"
          :key="approval._id"
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div class="min-w-0 text-indigo-800 dark:text-indigo-200">
            <span class="font-medium">{{ approval.processId?.name || t('records.quoteProcessApprovalUnnamed') }}</span>
            <span v-if="approverNames(approval)" class="text-xs block opacity-90 mt-0.5">
              {{ t('records.quoteProcessApprovalApprovers', { names: approverNames(approval) }) }}
            </span>
          </div>
          <router-link
            :to="`/approvals/${approval._id}`"
            class="inline-flex items-center justify-center shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {{ t('records.quoteProcessApprovalOpen') }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isCommerciallyLockedStatus } from '@/constants/quoteLifecycle';
import { daysUntilQuoteValidityEnds, isQuoteValidityExpired } from '@/utils/quoteValidity';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t } = useI18n();

const processApprovals = ref([]);

const quoteStatus = computed(() => String(props.record?.status || '').trim());
const approvalLocked = computed(() => props.record?.approvalLocked === true);
const commerciallyLocked = computed(() => isCommerciallyLockedStatus(quoteStatus.value));

const isExpired = computed(() => quoteStatus.value === 'Expired');

const isExpiringSoon = computed(() => {
  if (!props.record?.validUntil || isExpired.value) return false;
  if (['Sent', 'Viewed', 'Approved'].includes(quoteStatus.value)) {
    const days = daysUntilQuoteValidityEnds(props.record);
    return days != null && days > 0 && days <= 7;
  }
  return false;
});

const validityPastDue = computed(() => {
  if (!props.record?.validUntil || isExpired.value) return false;
  return isQuoteValidityExpired(props.record);
});

const visible = computed(() => (
  commerciallyLocked.value ||
  quoteStatus.value === 'Pending Approval' ||
  quoteStatus.value === 'Draft' ||
  approvalLocked.value ||
  isExpired.value ||
  isExpiringSoon.value ||
  validityPastDue.value ||
  processApprovals.value.length > 0
));

const bannerClass = computed(() => {
  if (isExpired.value || validityPastDue.value) {
    return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100';
  }
  if (isExpiringSoon.value) {
    return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-100';
  }
  if (commerciallyLocked.value) {
    return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100';
  }
  if (quoteStatus.value === 'Pending Approval') {
    return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200';
  }
  return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200';
});

const bannerTitle = computed(() => {
  if (isExpired.value) {
    return t('records.quoteBannerExpiredTitle');
  }
  if (validityPastDue.value) {
    return t('records.quoteBannerValidityPastTitle');
  }
  if (isExpiringSoon.value) {
    return t('records.quoteBannerExpiringSoonTitle');
  }
  if (commerciallyLocked.value) {
    return t('records.quoteBannerLockedTitle');
  }
  if (quoteStatus.value === 'Pending Approval') {
    return t('records.quoteBannerPendingApproval');
  }
  if (approvalLocked.value) {
    return t('records.quoteBannerApprovalLocked');
  }
  if (quoteStatus.value === 'Draft') {
    return t('records.quoteBannerDraft');
  }
  return '';
});

const bannerDetail = computed(() => {
  if (isExpired.value) {
    return t('records.quoteBannerExpiredDetail');
  }
  if (validityPastDue.value) {
    return t('records.quoteBannerValidityPastDetail');
  }
  if (isExpiringSoon.value) {
    const days = daysUntilQuoteValidityEnds(props.record);
    return t('records.quoteBannerExpiringSoonDetail', { days });
  }
  if (commerciallyLocked.value) {
    return t('records.quoteBannerLockedDetail');
  }
  if (quoteStatus.value === 'Pending Approval' && processApprovals.value.length) {
    return t('records.quoteProcessApprovalBannerDetail');
  }
  if (quoteStatus.value === 'Draft') {
    return t('records.quoteBannerDraftDetail');
  }
  return '';
});

function approverNames(approval) {
  const list = (approval.approvers || [])
    .map((u) => {
      if (!u || typeof u !== 'object') return '';
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return name || u.email || '';
    })
    .filter(Boolean);
  return list.join(', ');
}

async function loadProcessApprovals() {
  const id = props.record?._id;
  if (!id) {
    processApprovals.value = [];
    return;
  }
  try {
    const res = await apiClient.get(`/quotes/${id}/process-approvals`);
    processApprovals.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    processApprovals.value = [];
  }
}

watch(
  () => props.record?._id,
  () => {
    loadProcessApprovals();
  },
  { immediate: true }
);

defineExpose({ refreshProcessApprovals: loadProcessApprovals });
</script>
