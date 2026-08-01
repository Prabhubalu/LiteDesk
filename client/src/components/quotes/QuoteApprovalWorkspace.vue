<template>
  <div class="space-y-5">
    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Quote approval</div>
          <h1 class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {{ workspace?.quote?.quoteNumber || 'Quote' }} · Rev {{ workspace?.quote?.revisionNumber || '-' }}
          </h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {{ workspace?.quote?.quoteTitle || workspace?.quote?.status || 'Approval workspace' }}
          </p>
        </div>
        <div class="text-right">
          <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatCurrencyValue(workspace?.quote?.grandTotal, { currencyCode: workspace?.quote?.currency || undefined }) ?? '—' }}</div>
          <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ workspace?.quote?.status }}</div>
        </div>
      </div>
    </section>

    <QuoteRevisionComparePanel :compare="workspace?.compare" :show-diffs="false" />

    <QuotePdfPreviewPane
      :quote-id="workspace?.quote?.quoteId"
      :preview="workspace?.pdfPreview"
      @generated="$emit('refresh')"
    />

    <QuoteApprovalHistory :rows="workspace?.approvalHistory || []" />

    <section v-if="approval?.status === 'pending' && canDecide" class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">Your decision</h2>
      <label class="mt-3 block">
        <span class="text-sm text-gray-600 dark:text-gray-300">Approval comment (optional)</span>
        <textarea
          v-model="approveComment"
          rows="2"
          class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        ></textarea>
      </label>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          :disabled="processing"
          @click="approve"
        >
          Approve
        </button>
        <button
          type="button"
          class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          :disabled="processing"
          @click="showReject = true"
        >
          Reject
        </button>
      </div>
    </section>

    <section v-else-if="approval?.status !== 'pending'" class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
      This approval is {{ approval?.status }}.
    </section>

    <section v-else class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      You are not assigned to decide this approval.
    </section>

    <div v-if="showReject" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showReject = false">
      <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reject quote approval</h3>
        <label class="mt-4 block">
          <span class="text-sm text-gray-600 dark:text-gray-300">Reason</span>
          <textarea
            v-model="rejectReason"
            rows="3"
            class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          ></textarea>
        </label>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="px-3 py-2 text-sm text-gray-600 dark:text-gray-300" @click="showReject = false">Cancel</button>
          <button
            type="button"
            class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="processing || !rejectReason.trim()"
            @click="reject"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import QuoteRevisionComparePanel from './QuoteRevisionComparePanel.vue';
import QuoteApprovalHistory from './QuoteApprovalHistory.vue';
import QuotePdfPreviewPane from './QuotePdfPreviewPane.vue';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  approval: { type: Object, default: null },
  workspace: { type: Object, default: null },
  canDecide: { type: Boolean, default: false }
});

const emit = defineEmits(['refresh']);
const notifications = useNotifications();
const processing = ref(false);
const approveComment = ref('');
const rejectReason = ref('');
const showReject = ref(false);

async function approve() {
  if (!props.approval?._id || processing.value || !props.canDecide) return;
  processing.value = true;
  try {
    const res = await apiClient.post(`/approvals/${props.approval._id}/approve`, {
      comment: approveComment.value.trim() || null
    });
    if (!res?.success) {
      notifications.error(res?.message || 'Failed to approve');
      return;
    }
    notifications.success('Approval granted. Process will continue.');
    emit('refresh');
  } catch (err) {
    notifications.error(err?.message || 'Failed to approve');
  } finally {
    processing.value = false;
  }
}

async function reject() {
  if (!props.approval?._id || processing.value || !props.canDecide || !rejectReason.value.trim()) return;
  processing.value = true;
  try {
    const res = await apiClient.post(`/approvals/${props.approval._id}/reject`, {
      reason: rejectReason.value.trim()
    });
    if (!res?.success) {
      notifications.error(res?.message || 'Failed to reject');
      return;
    }
    notifications.success('Approval rejected. Action has been blocked.');
    showReject.value = false;
    rejectReason.value = '';
    emit('refresh');
  } catch (err) {
    notifications.error(err?.message || 'Failed to reject');
  } finally {
    processing.value = false;
  }
}

</script>
