/**
 * Build registry list columns from ModuleDefinition fields (Customize View SSOT).
 */

import {
  isSystemField,
  isFieldVisibleInConfig,
} from '@/platform/fields/fieldCapabilityEngine';
import {
  getFilterableSystemFieldDef,
  isFilterableSystemFieldKey,
} from '@/platform/fields/filterableSystemFields';
import { getFieldMetadataMap, normalizeModuleKeyForRegistry } from '@/platform/fields/FieldRegistry';
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
 * Infrastructure / internal fields excluded from Customize View field picker.
 * Config-visible system fields (e.g. createdAt, createdBy) remain eligible.
 * @param {string} moduleKey
 * @param {string} fieldKey
 */
export function isFieldExcludedFromListCustomize(moduleKey, fieldKey, inventoryEnabled = true) {
  const key = String(fieldKey || '').trim();
  if (!key || key.includes('.')) return true;
  if (shouldHideFieldWhenInventoryDisabled(moduleKey, key, inventoryEnabled)) return true;
  // Metadata isVisibleInConfig is authoritative — global system keys like `source` may still be list-configurable.
  return !isFieldVisibleInConfig(moduleKey, { key });
}

/**
 * @param {string} moduleKey
 * @param {{ key?: string, visibility?: { list?: boolean }, isSystem?: boolean }} field
 */
export function isFieldEligibleForListColumn(moduleKey, field, inventoryEnabled = true) {
  const key = String(field?.key || '').trim();
  if (!key || key.includes('.')) return false;
  if (isFieldExcludedFromListCustomize(moduleKey, key, inventoryEnabled)) return false;
  if (field?.visibility?.list === false) return false;
  return true;
}

/**
 * Module filter picker: user-facing module fields + allowlisted audit system fields.
 * @param {string} moduleKey
 * @param {{ key?: string, isSystem?: boolean }} field
 */
export function isFieldEligibleForModuleFilter(moduleKey, field, inventoryEnabled = true) {
  const key = String(field?.key || '').trim();
  if (!key || key.includes('.')) return false;
  if (shouldHideFieldWhenInventoryDisabled(moduleKey, key, inventoryEnabled)) return false;

  const isSystem = field?.isSystem === true || isSystemField(moduleKey, { key });
  if (isSystem && !isFilterableSystemFieldKey(key)) return false;
  if (!isFieldVisibleInConfig(moduleKey, { key })) return false;
  return true;
}

/**
 * @param {string} key
 * @param {string} [fieldDataType]
 * @param {{ filterType?: string, dataType?: string } | null} [systemDef]
 */
function resolveFilterFieldTyping(key, fieldDataType, systemDef = null) {
  const def = systemDef || getFilterableSystemFieldDef(key);
  if (def) {
    return {
      dataType: def.dataType,
      filterType: def.filterType,
    };
  }
  return {
    dataType: inferListColumnDataType(key, fieldDataType),
    filterType: undefined,
  };
}

/**
 * Audit/system fields omitted from module create/edit API but filterable platform-wide.
 * @param {import('@/types/module-list.types').ListColumn[]} filterFields
 * @param {string} moduleKey
 */
function mergeRegistryFilterableSystemFields(filterFields, moduleKey, inventoryEnabled = true) {
  const registryKey = normalizeModuleKeyForRegistry(moduleKey);
  if (!registryKey) return filterFields;

  const metadataMap = getFieldMetadataMap(registryKey);
  if (!metadataMap) return filterFields;

  const merged = [...filterFields];
  const existing = new Set(filterFields.map((field) => field.key));

  for (const key of Object.keys(metadataMap)) {
    if (existing.has(key)) continue;
    if (!isFilterableSystemFieldKey(key)) continue;
    if (shouldHideFieldWhenInventoryDisabled(moduleKey, key, inventoryEnabled)) continue;
    if (!isFieldVisibleInConfig(moduleKey, { key })) continue;

    const meta = metadataMap[key];
    if (meta?.isVisibleInConfig === false) continue;

    const def = getFilterableSystemFieldDef(key);
    const typing = resolveFilterFieldTyping(key, undefined, def);
    merged.push({
      key,
      label: getFieldDisplayLabel({ key }, moduleKey) || formatKeyToLabel(key),
      dataType: typing.dataType,
      filterType: typing.filterType,
      order: def?.order ?? merged.length + 1,
    });
    existing.add(key);
  }

  return merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * @param {Array<Record<string, unknown>>} fields
 * @param {string} moduleKey
 * @returns {import('@/types/module-list.types').ListColumn[]}
 */
export function buildFilterFieldsFromModuleFields(fields, moduleKey, inventoryEnabled = true) {
  if (!Array.isArray(fields) || !moduleKey) return [];

  const filterFields = fields
    .filter((field) => isFieldEligibleForModuleFilter(moduleKey, field, inventoryEnabled))
    .map((field, index) => {
      const key = String(field.key);
      const typing = resolveFilterFieldTyping(key, field.dataType);
      return {
        key,
        label: getFieldDisplayLabel(field, moduleKey),
        dataType: typing.dataType,
        filterType: typing.filterType,
        options: Array.isArray(field.options) ? field.options : undefined,
        order: Number.isFinite(Number(field.order)) ? Number(field.order) : index + 1,
      };
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return mergeRegistryFilterableSystemFields(filterFields, moduleKey, inventoryEnabled);
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
        label: getFieldDisplayLabel(field, moduleKey),
        dataType,
        sortable: nonSortable ? false : true,
        filterable: field.filterable === true,
        order: Number.isFinite(Number(field.order)) ? Number(field.order) : index + 1
      };
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  mergeRegistryDefaultListColumns(columns, moduleKey, inventoryEnabled);
  return mergeRegistryListCustomizeFields(columns, moduleKey, inventoryEnabled);
}

/**
 * Audit/system fields omitted from the module API (create/edit exclusion) but list-configurable.
 * @param {import('@/types/module-list.types').ListColumn[]} columns
 * @param {string} moduleKey
 */
function mergeRegistryListCustomizeFields(columns, moduleKey, inventoryEnabled = true) {
  const registryKey = normalizeModuleKeyForRegistry(moduleKey);
  if (!registryKey) return columns;

  const metadataMap = getFieldMetadataMap(registryKey);
  if (!metadataMap) return columns;

  const merged = [...columns];
  const existing = new Set(columns.map((column) => column.key));

  for (const key of Object.keys(metadataMap)) {
    if (existing.has(key)) continue;
    if (isFieldExcludedFromListCustomize(moduleKey, key, inventoryEnabled)) continue;
    if (!isSystemField(moduleKey, { key })) continue;

    merged.push({
      key,
      label: getFieldDisplayLabel({ key }, moduleKey) || formatKeyToLabel(key),
      dataType: inferListColumnDataType(key, guessDataTypeForRegistryColumn(moduleKey, key)),
      sortable: true,
      filterable: false,
      order: merged.length + 1,
    });
    existing.add(key);
  }

  return merged;
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
      label: getFieldDisplayLabel({ key }, moduleKey) || formatKeyToLabel(key),
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
