import { useRecordPresence } from '@/composables/useRecordPresence';

/** @deprecated Use useRecordPresence(() => 'documents', getRecordId, getActivityType) */
export function useDocumentPresence(getDocumentId, getActivityType = () => 'viewing') {
  return useRecordPresence(() => 'documents', getDocumentId, getActivityType);
}
