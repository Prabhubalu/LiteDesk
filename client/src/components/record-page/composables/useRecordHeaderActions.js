import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatExportDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

export const useRecordHeaderActions = ({
  recordRef,
  closeRoute,
  router,
  duplicate,
  toggleFollow,
  exportConfig,
  deleteRecord,
  onCopySuccess
}) => {
  const { t } = useI18n();
  const isFollowing = ref(false);
  const showDeleteModal = ref(false);
  const deleting = ref(false);

  const getRecord = () => {
    if (!recordRef) return null;
    if (typeof recordRef === 'function') return recordRef();
    if (typeof recordRef === 'object' && 'value' in recordRef) return recordRef.value;
    return recordRef;
  };

  const handleClose = () => {
    if (!closeRoute) return;
    router?.push?.(closeRoute);
  };

  const handleToggleFollow = async () => {
    const record = getRecord();
    if (!record) return;
    try {
      if (typeof toggleFollow === 'function') {
        const next = await toggleFollow(record, isFollowing.value);
        if (typeof next === 'boolean') {
          isFollowing.value = next;
          return;
        }
      }
      isFollowing.value = !isFollowing.value;
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (typeof onCopySuccess === 'function') {
        onCopySuccess();
      } else {
        alert(t('records.useRecordHeaderActionsToastUrlCopiedToClipboard'));
      }
    } catch (err) {
      console.error('Error copying URL:', err);
    }
  };

  const handleDuplicate = async () => {
    const record = getRecord();
    if (!record || typeof duplicate !== 'function') return;
    try {
      await duplicate(record);
    } catch (err) {
      console.error('Error duplicating record:', err);
    }
  };

  const handleExport = () => {
    const record = getRecord();
    if (!record || typeof exportConfig !== 'function') return;

    try {
      const config = exportConfig(record, {
        escapeCsvValue,
        formatExportDate
      });
      if (!config) return;

      const headers = Array.isArray(config.headers) ? config.headers : [];
      const rowValues = Array.isArray(config.row) ? config.row : [];
      const row = rowValues.map(escapeCsvValue);
      const csv = `${headers.join(',')}\n${row.join(',')}\n`;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = config.filename || `record_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting record:', err);
      alert(t('records.useRecordHeaderActionsToastErrorExportingRecordPleaseTry'));
    }
  };

  const handleDelete = () => {
    if (!getRecord()) return;
    showDeleteModal.value = true;
  };

  const confirmDeleteRecord = async () => {
    const record = getRecord();
    if (!record || typeof deleteRecord !== 'function') return;
    deleting.value = true;
    try {
      await deleteRecord(record);
      showDeleteModal.value = false;
    } catch (err) {
      console.error('Error deleting record:', err);
      alert(t('records.useRecordHeaderActionsToastErrorDeletingRecordPleaseTry'));
    } finally {
      deleting.value = false;
    }
  };

  return {
    isFollowing,
    showDeleteModal,
    deleting,
    handleClose,
    handleToggleFollow,
    handleCopyUrl,
    handleDuplicate,
    handleExport,
    handleDelete,
    confirmDeleteRecord
  };
};
