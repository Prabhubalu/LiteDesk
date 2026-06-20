import { extractIdFromFormValue } from '@/utils/orgContactFormPairing';
import { resolveLookupFieldRelationship } from '@/utils/lookupFieldRelationship';
import {
  invalidateRecordContext,
  syncLookupRelationshipInContext
} from '@/composables/useRecordContext';

function labelFromLookupValue(rawValue) {
  if (rawValue == null || rawValue === '') return '';
  if (typeof rawValue === 'object') {
    return String(
      rawValue.name
      || rawValue.label
      || rawValue.title
      || rawValue.fullName
      || ''
    ).trim();
  }
  return '';
}

function findLabelInList(linkedId, list) {
  if (!linkedId || !Array.isArray(list)) return '';
  const id = String(linkedId);
  const match = list.find((row) => String(row?._id ?? row?.id ?? '') === id);
  if (!match) return '';
  return String(match.name || match.label || match.title || match.fullName || '').trim();
}

/**
 * After saving a lookup key field, sync Related Records immediately and refresh context.
 */
export async function refreshRelatedRecordsAfterLookupFieldSave({
  moduleKey,
  fieldKey,
  value,
  moduleDefinition,
  recordContextRef,
  contextRevisionRef,
  appKey,
  recordId,
  loadRecordContext,
  lookupLists = {}
}) {
  const rel = resolveLookupFieldRelationship(moduleKey, fieldKey, moduleDefinition);
  if (!rel || !recordId) return false;

  const linkedId = extractIdFromFormValue(value);
  let label = labelFromLookupValue(value);

  if (!label && linkedId) {
    const target = String(rel.targetModuleKey || '').toLowerCase();
    if (target === 'organizations') {
      label = findLabelInList(linkedId, lookupLists.organizations);
    } else if (target === 'people') {
      label = findLabelInList(linkedId, lookupLists.people);
    } else if (target === 'deals') {
      label = findLabelInList(linkedId, lookupLists.deals);
    }
  }

  const linkedRecord = linkedId
    ? {
        recordId: String(linkedId),
        id: String(linkedId),
        moduleKey: rel.targetModuleKey,
        appKey: rel.appKey || appKey || 'SALES',
        ...(label ? { label, name: label } : {})
      }
    : null;

  syncLookupRelationshipInContext(recordContextRef, rel.relationshipKey, linkedRecord, {
    moduleKey: rel.targetModuleKey,
    appKey: rel.appKey || appKey || 'SALES',
    direction: 'SOURCE',
    onUpdated: () => {
      if (contextRevisionRef) contextRevisionRef.value += 1;
    }
  });

  invalidateRecordContext(appKey, moduleKey, recordId);
  if (typeof loadRecordContext === 'function') {
    await loadRecordContext(true);
  }
  return true;
}
