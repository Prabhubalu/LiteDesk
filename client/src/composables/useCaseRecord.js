import { computed, ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { getAllowedCaseStatusTransitions, CASE_PRIORITIES } from '@/constants/caseLifecycle';

export function useCaseRecord(caseIdRef) {
  const notifications = useNotifications();
  const loading = ref(false);
  const error = ref(null);
  const caseRecord = ref(null);
  const sending = ref(false);
  const statusUpdating = ref(false);
  const neighbors = ref({ previousId: null, nextId: null });
  const emailThreads = ref([]);
  const emailThreadsLoading = ref(false);
  const users = ref([]);

  const allowedStatusTransitions = computed(() =>
    getAllowedCaseStatusTransitions(caseRecord.value?.status || '')
  );

  const isClosed = computed(() => caseRecord.value?.status === 'Closed');

  async function fetchCase() {
    const id = caseIdRef.value;
    if (!id) {
      error.value = 'Missing case id';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get(`/helpdesk/cases/${id}`, {
        params: { activityLimit: 500 }
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to load case');
      }
      caseRecord.value = res.data;
      await Promise.all([loadNeighbors(), loadEmailThreads()]);
    } catch (err) {
      error.value = err?.message || 'Failed to load case';
      caseRecord.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function loadNeighbors() {
    const id = caseIdRef.value;
    if (!id) {
      neighbors.value = { previousId: null, nextId: null };
      return;
    }
    try {
      const res = await apiClient.get('/modules/cases/records/' + id + '/neighbors');
      neighbors.value =
        res?.success && res.data ? res.data : { previousId: null, nextId: null };
    } catch {
      neighbors.value = { previousId: null, nextId: null };
    }
  }

  async function loadEmailThreads() {
    const id = caseIdRef.value;
    if (!id) {
      emailThreads.value = [];
      return;
    }
    emailThreadsLoading.value = true;
    try {
      const res = await apiClient.get('/communications/threads', {
        params: { moduleKey: 'cases', recordId: id, includeDone: true }
      });
      emailThreads.value =
        res?.success && Array.isArray(res?.data?.threads) ? res.data.threads : [];
    } catch {
      emailThreads.value = [];
    } finally {
      emailThreadsLoading.value = false;
    }
  }

  async function loadUsers() {
    try {
      const res = await apiClient.get('/users/list', { params: { limit: 500 } });
      const rows = res?.data ?? res;
      const list = Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
      users.value = list
        .map((u) => ({
          _id: u?._id || u?.id,
          name:
            [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() ||
            u?.username ||
            u?.email ||
            ''
        }))
        .filter((u) => Boolean(u._id));
    } catch {
      users.value = [];
    }
  }

  async function updateStatus(status, extra = {}) {
    const id = caseIdRef.value;
    if (!id || !status) return false;
    statusUpdating.value = true;
    try {
      const res = await apiClient.patch(`/helpdesk/cases/${id}/status`, {
        status,
        ...extra
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to update status');
      }
      caseRecord.value = res.data;
      notifications.success('Status updated');
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to update status');
      return false;
    } finally {
      statusUpdating.value = false;
    }
  }

  async function updateOwner(caseOwnerId) {
    const id = caseIdRef.value;
    if (!id || isClosed.value) return false;
    try {
      const res = await apiClient.put(`/helpdesk/cases/${id}`, {
        caseOwnerId: caseOwnerId || null
      });
      if (!res?.success) throw new Error(res?.message || 'Failed to update owner');
      caseRecord.value = res.data;
      notifications.success('Owner updated');
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to update owner');
      return false;
    }
  }

  async function updatePriority(priority) {
    const id = caseIdRef.value;
    if (!id || isClosed.value) return false;
    try {
      const res = await apiClient.put(`/helpdesk/cases/${id}`, { priority });
      if (!res?.success) throw new Error(res?.message || 'Failed to update priority');
      caseRecord.value = res.data;
      notifications.success('Priority updated');
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to update priority');
      return false;
    }
  }

  async function postActivity({ message, channel, internal = false, activityType = 'comment' }) {
    const id = caseIdRef.value;
    if (!id || !String(message || '').trim()) return false;
    sending.value = true;
    try {
      const res = await apiClient.post(`/helpdesk/cases/${id}/activities`, {
        activityType,
        message: String(message).trim(),
        channel: channel || caseRecord.value?.channel,
        internal: Boolean(internal)
      });
      if (!res?.success) throw new Error(res?.message || 'Failed to send message');
      caseRecord.value = res.data;
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to send message');
      return false;
    } finally {
      sending.value = false;
    }
  }

  async function reopenCase() {
    const id = caseIdRef.value;
    if (!id) return false;
    try {
      const res = await apiClient.post(`/helpdesk/cases/${id}/reopen`);
      if (!res?.success) throw new Error(res?.message || 'Failed to reopen case');
      caseRecord.value = res.data;
      notifications.success('Case reopened');
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to reopen case');
      return false;
    }
  }

  async function deleteCase() {
    const id = caseIdRef.value;
    if (!id) return false;
    try {
      const res = await apiClient.delete(`/helpdesk/cases/${id}`);
      if (res?.success === false) throw new Error(res?.message || 'Failed to delete case');
      notifications.success('Case moved to trash');
      return true;
    } catch (err) {
      notifications.error(err?.message || 'Failed to delete case');
      return false;
    }
  }

  watch(
    caseIdRef,
    () => {
      fetchCase();
      loadUsers();
    },
    { immediate: true }
  );

  const contactEmail = computed(() => {
    const c = caseRecord.value?.contactId;
    if (c && typeof c === 'object' && c.email) return String(c.email).trim();
    return String(caseRecord.value?.requesterEmail || '').trim();
  });

  return {
    loading,
    error,
    caseRecord,
    sending,
    statusUpdating,
    neighbors,
    emailThreads,
    emailThreadsLoading,
    users,
    contactEmail,
    allowedStatusTransitions,
    isClosed,
    priorities: CASE_PRIORITIES,
    fetchCase,
    loadEmailThreads,
    loadNeighbors,
    updateStatus,
    updatePriority,
    updateOwner,
    postActivity,
    reopenCase,
    deleteCase
  };
}
