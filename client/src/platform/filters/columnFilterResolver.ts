import type { FilterConfig } from '@/platform/filters/filterResolver';

export type ColumnFilterSource = {
  key: string;
  label?: string;
  dataType?: string;
  filterType?: FilterConfig['filterType'];
  options?: Array<{ value: string; label: string }>;
};

const TEXT_SEARCH_KEYS = new Set([
  'name',
  'title',
  'dealname',
  'deal_name',
  'organization',
  'organizationname',
  'organization_name',
  'contact',
  'contactname',
  'contact_name',
  'email',
  'phone',
  'firstname',
  'first_name',
  'lastname',
  'last_name',
  'description',
  'invoice_number',
  'invoicenumber',
  'sales_order_number',
  'salesordernumber',
  'quote_number',
  'quotenumber',
]);

function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const USER_FIELD_KEYS = new Set([
  'assignedto',
  'ownerid',
  'eventownerid',
  'caseownerid',
  'createdby',
]);

const PICKLIST_FIELD_KEYS = new Set([
  'stage',
  'status',
  'pipeline',
  'priority',
  'type',
  'documenttype',
  'salestype',
  'sales_type',
  'helpdeskrole',
  'helpdesk_role',
  'eventtype',
  'casetype',
  'channel',
  'fulfillmentstatus',
  'sourcetype',
  'itemtype',
  'category',
  'industry',
  'types',
  'tags',
  'formtype',
  'visibility',
  'executionstatus',
  'reviewstatus',
  'linkedtotype',
]);

const DATE_FIELD_KEYS = new Set([
  'duedate',
  'expectedclosedate',
  'expectedclose',
  'closedate',
  'startdatetime',
  'enddatetime',
  'validuntil',
  'issuedate',
  'createdat',
  'updatedat',
]);

export function inferFilterTypeFromColumn(column: ColumnFilterSource): FilterConfig['filterType'] {
  if (column.filterType) {
    return column.filterType;
  }

  const metadataType = String(column.dataType || '').toLowerCase();
  const keyNorm = normalizeKey(column.key);

  if (USER_FIELD_KEYS.has(keyNorm) || metadataType === 'user') {
    return 'user';
  }
  if (DATE_FIELD_KEYS.has(keyNorm) || keyNorm.endsWith('date') || keyNorm.endsWith('datetime')) {
    return 'date';
  }
  if (keyNorm === 'types' || keyNorm === 'tags') {
    return 'multi-select';
  }
  if (PICKLIST_FIELD_KEYS.has(keyNorm)) {
    return 'select';
  }
  if (keyNorm === 'folderid' || keyNorm === 'foldername') {
    return 'select';
  }
  if (TEXT_SEARCH_KEYS.has(keyNorm) || keyNorm.endsWith('name') || keyNorm.endsWith('title')) {
    return 'text';
  }
  if (['number', 'currency', 'decimal', 'percentage'].includes(metadataType)) {
    return 'number';
  }
  if (['date', 'datetime', 'date-time'].includes(metadataType)) {
    return 'date';
  }
  if (metadataType === 'boolean') {
    return 'boolean';
  }
  if (['entity', 'link', 'lookup'].includes(metadataType)) {
    if (column.options?.length) return 'select';
    if (keyNorm === 'organization') return 'entity';
    return 'text';
  }
  if (['status', 'select', 'picklist', 'priority'].includes(metadataType)) {
    return 'select';
  }
  if (['multi-select', 'tags', 'multiselect'].includes(metadataType)) {
    return 'multi-select';
  }
  if (metadataType === 'text' || metadataType === 'text-area' || metadataType === 'textarea') {
    return 'text';
  }
  return 'text';
}

export function resolveColumnFilterConfig(column: ColumnFilterSource): FilterConfig {
  const filterType = inferFilterTypeFromColumn(column);
  return {
    key: column.key,
    label: column.label || column.key,
    filterType,
    fieldPath: column.key,
    priority: 999,
    options: column.options ? [...column.options] : [],
  };
}

export function buildFilterConfigByKey(
  columns: ColumnFilterSource[]
): Record<string, FilterConfig> {
  const map: Record<string, FilterConfig> = {};
  for (const column of columns) {
    if (!column?.key) continue;
    const config = resolveColumnFilterConfig(column);
    if (column.options?.length) {
      map[column.key] = { ...config, options: [...column.options] };
    } else {
      map[column.key] = config;
    }
  }
  return map;
}

export function listFilterConfigsFromMap(map: Record<string, FilterConfig>): FilterConfig[] {
  return Object.values(map);
}

/** Minimal filter config when module field metadata has not loaded yet. */
export function inferFallbackFilterConfig(key: string): FilterConfig | null {
  const trimmed = String(key || '').trim();
  if (!trimmed) return null;
  const keyNorm = normalizeKey(trimmed);

  if (USER_FIELD_KEYS.has(keyNorm)) {
    return {
      key: trimmed,
      label: trimmed,
      filterType: 'user',
      fieldPath: trimmed,
      priority: 999,
      options: [],
    };
  }

  if (keyNorm === 'organization') {
    return {
      key: trimmed,
      label: trimmed,
      filterType: 'entity',
      fieldPath: trimmed,
      priority: 999,
      options: [],
    };
  }

  if (keyNorm === 'folderid' || keyNorm === 'foldername') {
    return {
      key: keyNorm === 'foldername' ? 'folderId' : trimmed,
      label: trimmed,
      filterType: 'select',
      fieldPath: 'folderId',
      priority: 999,
      options: [],
    };
  }

  return null;
}
