<template>
  <div class="w-full max-w-4xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      <div class="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Approval Detail -->
    <div v-else-if="approval" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <button
          @click="router.back()"
          class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>{{ t('common.approvalDetailBackToApprovals') }}</button>
        <span
          :class="[
            'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
            approval.status === 'pending'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              : approval.status === 'approved'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : approval.status === 'rejected'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          ]"
        >
          {{ approval.status === 'pending' ? 'Pending' : approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Rejected' : approval.status }}
        </span>
      </div>

      <QuoteApprovalWorkspace
        v-if="isQuoteApproval"
        :approval="approval"
        :workspace="quoteWorkspace"
        :can-decide="canDecide"
        @refresh="loadApproval"
      />

      <template v-else>
      <!-- Context Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.approvalDetailContext') }}</h2>
        
        <div class="space-y-4">
          <!-- Entity Snapshot -->
          <div v-if="approval.entitySnapshot">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('common.approvalDetailEntity') }}</h3>
            <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div class="text-sm text-gray-900 dark:text-white">
                <div class="font-medium mb-1">{{ getEntityDisplay(approval) }}</div>
                <div v-if="approval.entitySnapshot.type === 'deal' && approval.entitySnapshot.stage" class="text-gray-600 dark:text-gray-400">
                  Stage: {{ approval.entitySnapshot.stage }}
                </div>
              </div>
            </div>
          </div>

          <!-- Why Approval Required -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('common.approvalDetailWhyApprovalIsRequired') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ getApprovalReason(approval) }}
            </p>
          </div>

          <!-- Process Name (subtle) -->
          <div v-if="approval.processId?.name" class="text-xs text-gray-500 dark:text-gray-400">
            Process: {{ approval.processId.name }}
          </div>
        </div>
      </div>

      <!-- Impact Preview -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.approvalDetailWhatWillHappen') }}</h2>
        
        <div class="grid md:grid-cols-2 gap-4">
          <!-- If Approved -->
          <div class="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <h3 class="text-sm font-semibold text-green-900 dark:text-green-200">{{ t('common.approvalDetailIfApproved') }}</h3>
            </div>
            <ul class="space-y-1 text-sm text-green-800 dark:text-green-300">
              <li v-for="(action, idx) in (approval.impactPreview?.ifApproved || ['Process will continue'])" :key="idx">
                • {{ action }}
              </li>
            </ul>
          </div>

          <!-- If Rejected -->
          <div class="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <h3 class="text-sm font-semibold text-red-900 dark:text-red-200">{{ t('common.approvalDetailIfRejected') }}</h3>
            </div>
            <ul class="space-y-1 text-sm text-red-800 dark:text-red-300">
              <li v-for="(action, idx) in (approval.impactPreview?.ifRejected || ['Action will be blocked'])" :key="idx">
                • {{ action }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Escalation Badge (if escalated) -->
      <div
        v-if="approval.status === 'pending' && approval.escalatedApprovers && approval.escalatedApprovers.length > 0"
        class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
      >
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">{{ t('common.approvalDetailEscalated') }}</h3>
            <p class="text-sm text-blue-800 dark:text-blue-300">{{ t('common.approvalDetailThisApprovalWasEscalatedDueTo') }}</p>
          </div>
        </div>
      </div>

      <!-- Decision Panel (Pending only) -->
      <div v-if="approval.status === 'pending' && canDecide" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.approvalDetailYourDecision') }}</h2>
        
        <div class="flex items-center gap-3">
          <button
            @click="handleApprove"
            :disabled="processing"
            class="px-6 py-3 text-base font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ processing ? 'Processing...' : 'Approve' }}
          </button>
          <button
            @click="showRejectModal = true"
            :disabled="processing"
            class="px-6 py-3 text-base font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >{{ t('forms.hubActionReject') }}</button>
        </div>
      </div>

      <!-- Read-only for resolved -->
      <div v-else-if="approval.status !== 'pending'" class="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('common.approvalDetailDecisionAlreadyMade') }}</h3>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <div v-if="approval.decidedBy">
            <span class="font-medium">{{ t('common.approvalDetailDecidedBy') }}</span>
            {{ getDeciderName(approval) }}
          </div>
          <div v-if="approval.decidedAt">
            <span class="font-medium">{{ t('common.approvalDetailDecidedAt') }}</span>
            {{ formatDate(approval.decidedAt) }}
          </div>
          <div v-if="approval.reason">
            <span class="font-medium">{{ t('common.approvalDetailReason2') }}</span>
            {{ approval.reason }}
          </div>
        </div>
      </div>

      <!-- Not Authorized -->
      <div v-else-if="!canDecide" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p class="text-sm text-yellow-800 dark:text-yellow-200">{{ t('common.approvalDetailYouAreNotAuthorizedToApprove') }}</p>
      </div>
      </template>
    </div>

    <!-- Reject Modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="showRejectModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('common.approvalDetailRejectApproval') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ t('common.approvalDetailRejectingWillBlockThisAction') }}</p>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('common.approvalDetailReason') }}<span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="rejectReason"
            rows="3"
            :placeholder="t('common.approvalDetailEnterRejectionReason')"
            class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-indigo-500"
          ></textarea>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button
            @click="showRejectModal = false; rejectReason = ''"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            @click="confirmReject"
            :disabled="!rejectReason.trim() || processing"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ processing ? 'Rejecting...' : 'Reject' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import QuoteApprovalWorkspace from '@/components/quotes/QuoteApprovalWorkspace.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { success: showSuccess, error: showError } = useNotifications();

const approval = ref(null);
const loading = ref(true);
const error = ref(null);
const showRejectModal = ref(false);
const rejectReason = ref('');
const processing = ref(false);
const quoteWorkspace = ref(null);

const isQuoteApproval = computed(() => String(approval.value?.entityType || approval.value?.entitySnapshot?.type || '') === 'quote');

const canDecide = computed(() => {
  if (!approval.value || !authStore.user) return false;
  if (approval.value.status !== 'pending') return false;
  const userId = authStore.user._id?.toString() || authStore.user._id;
  const approverIds = (approval.value.approvers || []).map(a => {
    const v = a && (a._id ? a._id : a);
    return v && v.toString ? v.toString() : String(v);
  });
  return approverIds.includes(userId);
});

const loadApproval = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get(`/approvals/${route.params.id}`);
    approval.value = response.data;
    if (String(approval.value?.entityType || approval.value?.entitySnapshot?.type || '') === 'quote' && approval.value?._id) {
      const workspaceRes = await apiClient.get(`/approvals/${approval.value._id}/quote-workspace`);
      quoteWorkspace.value = workspaceRes?.success ? workspaceRes.data : null;
    } else {
      quoteWorkspace.value = null;
    }
  } catch (err) {
    error.value = err.message || 'Failed to load approval';
    console.error('Error loading approval:', err);
  } finally {
    loading.value = false;
  }
};

const getEntityDisplay = (approval) => {
  if (approval.entitySnapshot) {
    const snap = approval.entitySnapshot;
    if (snap.type === 'deal') {
      return `${snap.name || 'Deal'} – ${formatCurrency(snap.value)}`;
    } else if (snap.type === 'people') {
      return snap.name || snap.email || 'Person';
    } else if (snap.type === 'organization') {
      return snap.name || 'Organization';
    } else if (snap.type === 'quote') {
      const total = snap.grandTotal != null ? formatCurrency(snap.grandTotal, snap.currency) : '';
      const rev = snap.revisionNumber ? ` · Rev ${snap.revisionNumber}` : '';
      return `${snap.quoteNumber || snap.name || 'Quote'}${rev}${total ? ` — ${total}` : ''}`;
    }
  }
  return `${approval.entityType || 'Record'} (${approval.entityId || 'Unknown'})`;
};

const formatCurrency = (value, currency) => {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const code = String(currency || '').trim();
  try {
    return new Intl.NumberFormat(undefined, {
      style: code ? 'currency' : 'decimal',
      currency: code || undefined,
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `${n.toLocaleString()}${code ? ` ${code}` : ''}`;
  }
};

const getApprovalReason = (approval) => {
  if (approval.entitySnapshot?.type === 'deal' && approval.entitySnapshot.value) {
    const value = Number(approval.entitySnapshot.value);
    if (value > 1000000) {
      return `This deal requires approval because value (${formatCurrency(value)}) exceeds ₹10L`;
    }
  }
  return 'This action requires approval before it can proceed.';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};

const getDeciderName = (approval) => {
  if (approval.decidedBy) {
    if (typeof approval.decidedBy === 'object' && approval.decidedBy.firstName) {
      return `${approval.decidedBy.firstName} ${approval.decidedBy.lastName || ''}`.trim() || approval.decidedBy.email;
    }
  }
  return 'Unknown';
};

const handleApprove = async () => {
  if (processing.value || !canDecide.value) return;
  processing.value = true;
  try {
    const response = await apiClient.post(`/approvals/${approval.value._id}/approve`);
    if (response.success) {
      showSuccess('Approval granted. Process will continue.');
      await loadApproval();
    } else {
      showError(response.message || 'Failed to approve');
    }
  } catch (err) {
    showError(err.message || 'Failed to approve');
  } finally {
    processing.value = false;
  }
};

const confirmReject = async () => {
  if (!rejectReason.value.trim() || processing.value || !canDecide.value) return;
  processing.value = true;
  try {
    const response = await apiClient.post(`/approvals/${approval.value._id}/reject`, {
      reason: rejectReason.value.trim()
    });
    if (response.success) {
      showSuccess('Approval rejected. Action has been blocked.');
      showRejectModal.value = false;
      rejectReason.value = '';
      await loadApproval();
    } else {
      showError(response.message || 'Failed to reject');
    }
  } catch (err) {
    showError(err.message || 'Failed to reject');
  } finally {
    processing.value = false;
  }
};

onMounted(() => {
  loadApproval();
});
</script>
