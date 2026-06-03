/**
 * Build registry list columns from ModuleDefinition fields (Customize View SSOT).
 */

import { isSystemField, isFieldVisibleInConfig } from '@/platform/fields/fieldCapabilityEngine';
import { getQuoteFieldMetadata } from '@/platform/fields/quoteFieldModel';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { getFieldDisplayLabel, formatKeyToLabel } from '@/utils/fieldDisplay';
import { shouldHideFieldWhenInventoryDisabled } from '@/utils/inventoryCapability';

/**
 * @param {string} fieldKey
 * @param {string} [fieldDataType]
 * @returns {import('@/types/module-list.types').ColumnDataType}
 */
export function inferListColumnDataType(fieldKey, fieldDataType) {
  const dt = String(fieldDataType || 'Text').trim();
  const key = String(fieldKey || '').toLowerCase();

  if (dt === 'Currency') return 'currency';
  if (dt === 'Number' || dt === 'Integer' || dt === 'Decimal') return 'number';
  if (dt === 'Date') return 'date';
  if (dt === 'Date-Time' || dt === 'DateTime') return 'datetime';
  if (dt === 'Checkbox' || dt === 'Boolean') return 'boolean';
  if (dt === 'Percentage') return 'percentage';
  if (dt === 'Lookup (Relationship)' || dt === 'Lookup') {
    if (
      key.endsWith('id') &&
      (key.includes('owner') || key.includes('assigned') || key.includes('user') || key.includes('contact'))
    ) {
      return 'user';
    }
    return 'text';
  }
  if (dt === 'Picklist' || dt === 'Multi-Picklist') {
    if (key === 'status' || key.endsWith('status')) return 'status';
    return 'text';
  }
  return 'text';
}

/**
 * @param {string} moduleKey
 * @param {{ key?: string, visibility?: { list?: boolean }, isSystem?: boolean }} field
 */
export function isFieldEligibleForListColumn(moduleKey, field, inventoryEnabled = true) {
  const key = String(field?.key || '').trim();
  if (!key || key.includes('.')) return false;
  if (shouldHideFieldWhenInventoryDisabled(moduleKey, key, inventoryEnabled)) return false;
  if (field?.isSystem === true) return false;
  if (isSystemField(moduleKey, { key })) return false;
  if (!isFieldVisibleInConfig(moduleKey, { key })) return false;
  if (field?.visibility?.list === false) return false;
  return true;
}

/**
 * @param {Array<Record<string, unknown>>} fields
 * @param {string} moduleKey
 * @returns {import('@/types/module-list.types').ListColumn[]}
 */
export function buildListColumnsFromModuleFields(fields, moduleKey, inventoryEnabled = true) {
  if (!Array.isArray(fields) || !moduleKey) return [];

  const columns = fields
    .filter((field) => isFieldEligibleForListColumn(moduleKey, field, inventoryEnabled))
    .map((field, index) => {
      const key = String(field.key);
      const dataType = inferListColumnDataType(key, field.dataType);
      const dt = String(field.dataType || '');
      const nonSortable =
        dt === 'Multi-Picklist' || dt === 'Text-Area' || dt === 'Rich Text' || dt === 'File';

      return {
        key,
        label: getFieldDisplayLabel(field),
        dataType,
        sortable: nonSortable ? false : true,
        filterable: field.filterable === true,
        order: Number.isFinite(Number(field.order)) ? Number(field.order) : index + 1
      };
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  mergeRegistryDefaultListColumns(columns, moduleKey, inventoryEnabled);

  return columns;
}

/**
 * Ensure registry defaultVisibleColumns exist (e.g. quote grandTotal excluded from schema API).
 * @param {import('@/types/module-list.types').ListColumn[]} columns
 * @param {string} moduleKey
 */
function mergeRegistryDefaultListColumns(columns, moduleKey, inventoryEnabled = true) {
  const listConfig = getModuleListConfig(moduleKey, { inventoryEnabled });
  const defaultKeys = listConfig?.defaultColumns?.defaultVisibleColumns || [];
  if (!defaultKeys.length) return;

  const existing = new Set(columns.map((c) => c.key));
  for (const key of defaultKeys) {
    if (existing.has(key)) continue;

    if (moduleKey === 'quotes') {
      const meta = getQuoteFieldMetadata(key);
      if (meta && meta.isVisibleInConfig === false) continue;
    }

    columns.push({
      key,
      label: formatKeyToLabel(key),
      dataType: inferListColumnDataType(key, guessDataTypeForRegistryColumn(moduleKey, key)),
      sortable: true,
      filterable: false,
      order: columns.length + 1
    });
    existing.add(key);
  }

  columns.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * @param {string} moduleKey
 * @param {string} key
 */
function guessDataTypeForRegistryColumn(moduleKey, key) {
  const k = String(key || '').toLowerCase();
  if (k.includes('total') || k === 'amount' || k === 'grandtotal') return 'Currency';
  if (k.endsWith('at') || k.includes('date')) return 'Date';
  if (k === 'status' || k === 'stage') return 'Picklist';
  if (moduleKey === 'quotes' && k === 'status') return 'Picklist';
  return 'Text';
}
