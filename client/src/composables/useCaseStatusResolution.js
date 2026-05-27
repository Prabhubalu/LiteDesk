import { ref, unref } from 'vue';

export const CASE_STATUS_RESOLUTION_KEY = Symbol('caseStatusResolution');

function needsResolutionSummary(caseRecord, status) {
  if (status !== 'Resolved' && status !== 'Closed') return false;
  const rec = unref(caseRecord);
  return !String(rec?.resolutionSummary || '').trim();
}

/**
 * Modal flow for resolving/closing a case when resolutionSummary is required.
 */
export function useCaseStatusResolution({ caseRecord, updateStatus, notifications, t }) {
  const showResolutionDialog = ref(false);
  const resolutionSummaryInput = ref('');
  const pendingStatus = ref(null);
  const resolving = ref(false);

  function closeResolutionDialog() {
    showResolutionDialog.value = false;
    pendingStatus.value = null;
    resolutionSummaryInput.value = '';
  }

  function openResolutionDialog(status) {
    pendingStatus.value = status;
    resolutionSummaryInput.value = String(unref(caseRecord)?.resolutionSummary || '').trim();
    showResolutionDialog.value = true;
  }

  /**
   * @returns {Promise<'applied'|'pending'|'unchanged'>}
   */
  async function changeStatus(status) {
    const current = unref(caseRecord)?.status;
    if (!status || status === current) return 'unchanged';

    if (needsResolutionSummary(caseRecord, status)) {
      openResolutionDialog(status);
      return 'pending';
    }

    const ok = await updateStatus(status, {});
    return ok ? 'applied' : 'unchanged';
  }

  async function confirmResolution() {
    const summary = String(resolutionSummaryInput.value || '').trim();
    if (!summary) {
      notifications.warning(t('cases.recordResolutionRequired'));
      return false;
    }
    const status = pendingStatus.value;
    if (!status) return false;

    resolving.value = true;
    try {
      const ok = await updateStatus(status, { resolutionSummary: summary });
      if (ok) closeResolutionDialog();
      return ok;
    } finally {
      resolving.value = false;
    }
  }

  return {
    showResolutionDialog,
    resolutionSummaryInput,
    pendingStatus,
    resolving,
    changeStatus,
    confirmResolution,
    closeResolutionDialog,
    needsResolutionSummary: (status) => needsResolutionSummary(caseRecord, status)
  };
}
