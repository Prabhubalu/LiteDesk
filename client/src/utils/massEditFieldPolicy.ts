import { canEditField } from '@/platform/fields/fieldCapabilityEngine';

const NON_MASS_EDIT_DATA_TYPES = new Set([
  'text-area',
  'rich text',
  'image',
  'file',
  'auto-number',
  'formula',
  'rollup summary',
]);

const MODULE_DENIED_KEYS: Record<string, Set<string>> = {
  deals: new Set(['stage', 'pipeline', 'stageorder', 'status', 'playbookstate']),
  events: new Set(['status', 'eventstatus', 'executionstate', 'relatedrecordtype', 'relatedrecordid']),
  tasks: new Set(['relatedto', 'relatedtotype', 'relatedtoid', 'status']),
  cases: new Set(['status', 'casenumber', 'slacycle', 'currentslacycle']),
  people: new Set(['participations']),
  organizations: new Set(['istenant']),
  quotes: new Set(['status', 'approvalstatus', 'revisionnumber']),
};

export const BULK_UPDATE_API_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'items',
  'cases',
  'quotes',
]);

function normalizeKey(key: string): string {
  return String(key || '').trim().toLowerCase();
}

const TAGS_FIELD = { key: 'tags', label: 'Tags', dataType: 'Multi-Picklist', order: -20 };

export function isMassEditableField(moduleKey: string, field: { key?: string; dataType?: string }): boolean {
  const key = normalizeKey(field.key || '');
  if (!key) return false;
  if (key === 'tags') return supportsMassEdit(moduleKey);

  const mk = normalizeKey(moduleKey);
  if (MODULE_DENIED_KEYS[mk]?.has(key)) return false;

  const dataType = String(field.dataType || '').trim().toLowerCase();
  if (NON_MASS_EDIT_DATA_TYPES.has(dataType)) return false;
  if (dataType.includes('rich')) return false;

  return canEditField(moduleKey, field);
}

export function getMassEditableFields(
  moduleKey: string,
  fields: Array<{ key?: string; dataType?: string; label?: string; order?: number }>
) {
  const editable = (fields || []).filter((field) => isMassEditableField(moduleKey, field));
  if (supportsMassEdit(moduleKey) && !editable.some((f) => normalizeKey(f.key || '') === 'tags')) {
    editable.push(TAGS_FIELD);
  }
  return editable
    .sort((a, b) => {
      const orderA = Number(a.order ?? 9999);
      const orderB = Number(b.order ?? 9999);
      if (orderA !== orderB) return orderA - orderB;
      return String(a.label || a.key || '').localeCompare(String(b.label || b.key || ''));
    });
}

export function supportsMassEdit(moduleKey: string): boolean {
  return BULK_UPDATE_API_MODULES.has(normalizeKey(moduleKey));
}
