import {
  invalidateRecordContext,
  mergeLinkedRecordsIntoContext
} from '@/composables/useRecordContext';
import { resolveDocumentRelationshipKey } from '@/constants/documentAttachments';

function normalizeDocumentRecord(doc) {
  const id = String(doc?._id ?? doc?.id ?? doc?.recordId ?? '');
  if (!id) return null;
  return {
    recordId: id,
    id,
    moduleKey: 'documents',
    appKey: 'PLATFORM',
    label: doc.title || doc.documentNumber || id.slice(-8),
    title: doc.title,
    documentNumber: doc.documentNumber,
    status: doc.status,
    documentType: doc.documentType
  };
}

function removeDocumentsFromContext(contextRef, relationshipKey, documentIds = []) {
  const ctx = contextRef?.value;
  if (!ctx?.relationships?.length || !documentIds.length) return;

  const relKey = String(relationshipKey).toLowerCase();
  const removeSet = new Set(documentIds.map((id) => String(id)));
  const nextRelationships = ctx.relationships.map((entry) => {
    if (String(entry?.relationshipKey || '').toLowerCase() !== relKey) return entry;
    if (!Array.isArray(entry.records)) return entry;
    return {
      ...entry,
      records: entry.records.filter((rec) => {
        const id = String(rec?.recordId ?? rec?.id ?? rec?._id ?? '');
        return id && !removeSet.has(id);
      })
    };
  });

  if (contextRef?.value != null) {
    contextRef.value = { ...ctx, relationships: nextRelationships };
  }
}

/**
 * After attaching/detaching documents on a record, sync Related Records immediately.
 */
export async function refreshRelatedRecordsAfterDocumentChange({
  moduleKey,
  recordId,
  appKey,
  contextRef,
  loadRecordContext,
  documents = [],
  detachedDocumentIds = [],
  onContextRevision
}) {
  const relationshipKey = resolveDocumentRelationshipKey(moduleKey);
  if (!relationshipKey || !recordId) return;

  invalidateRecordContext(appKey, moduleKey, recordId);

  if (detachedDocumentIds.length > 0 && contextRef) {
    removeDocumentsFromContext(contextRef, relationshipKey, detachedDocumentIds);
    if (typeof onContextRevision === 'function') onContextRevision();
  }

  const optimisticRecords = documents
    .map(normalizeDocumentRecord)
    .filter(Boolean);

  if (optimisticRecords.length > 0 && contextRef) {
    mergeLinkedRecordsIntoContext(contextRef, relationshipKey, optimisticRecords, {
      moduleKey: 'documents',
      appKey: 'PLATFORM',
      direction: 'SOURCE',
      label: 'Related Documents',
      onUpdated: onContextRevision
    });
  }

  if (typeof loadRecordContext === 'function') {
    await loadRecordContext(true);
  }

  // Server context can lag behind the documents panel; keep optimistic links visible.
  if (optimisticRecords.length > 0 && contextRef) {
    const relKey = String(relationshipKey).toLowerCase();
    const rel = contextRef.value?.relationships?.find(
      (entry) => String(entry?.relationshipKey || '').toLowerCase() === relKey
    );
    const linkedCount = Array.isArray(rel?.records) ? rel.records.length : 0;
    if (linkedCount === 0) {
      mergeLinkedRecordsIntoContext(contextRef, relationshipKey, optimisticRecords, {
        moduleKey: 'documents',
        appKey: 'PLATFORM',
        direction: 'SOURCE',
        label: 'Related Documents',
        onUpdated: onContextRevision
      });
    }
  }
}
