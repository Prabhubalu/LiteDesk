import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

/**
 * Approve / reject pending ApprovalInstance rows (Platform Home, inbox, etc.).
 */
export function useApprovalDecision() {
  const processingId = ref(null);
  const processingAction = ref(null);
  const { success: showSuccess, error: showError } = useNotifications();

  async function approve(approvalId, { onSuccess, successMessage } = {}) {
    if (!approvalId || processingId.value) return false;
    processingId.value = approvalId;
    processingAction.value = 'approve';
    try {
      const response = await apiClient.post(`/approvals/${approvalId}/approve`);
      if (response.success) {
        showSuccess(successMessage || 'Approval granted. Process will continue.');
        await onSuccess?.();
        return true;
      }
      showError(response.message || 'Failed to approve');
      return false;
    } catch (err) {
      showError(err.message || 'Failed to approve');
      return false;
    } finally {
      processingId.value = null;
      processingAction.value = null;
    }
  }

  async function reject(approvalId, reason, { onSuccess, successMessage } = {}) {
    const trimmed = String(reason || '').trim();
    if (!approvalId || !trimmed || processingId.value) return false;
    processingId.value = approvalId;
    processingAction.value = 'reject';
    try {
      const response = await apiClient.post(`/approvals/${approvalId}/reject`, { reason: trimmed });
      if (response.success) {
        showSuccess(successMessage || 'Approval rejected. Action has been blocked.');
        await onSuccess?.();
        return true;
      }
      showError(response.message || 'Failed to reject');
      return false;
    } catch (err) {
      showError(err.message || 'Failed to reject');
      return false;
    } finally {
      processingId.value = null;
      processingAction.value = null;
    }
  }

  function isProcessing(approvalId, action) {
    return processingId.value === approvalId && processingAction.value === action;
  }

  return {
    processingId,
    processingAction,
    approve,
    reject,
    isProcessing
  };
}
