/**
 * CRM module field helpers for webform builder bindings.
 */

import { normalizeWebformFieldType, fieldTypeNeedsOptions } from '@/constants/moduleFieldTypes';

const PICKLIST_CRM_TYPES = new Set(['Picklist', 'Multi-Picklist']);

function normalizePicklistOption(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt.trim();
  if (typeof opt === 'object' && opt.enabled !== false) {
    return String(opt.value ?? opt.label ?? '').trim();
  }
  return '';
}

export function picklistValuesFromModuleField(field) {
  if (!field?.options || !Array.isArray(field.options)) return [];
  return [...new Set(field.options.map(normalizePicklistOption).filter(Boolean))];
}

export function isCrmPicklistField(field) {
  return PICKLIST_CRM_TYPES.has(String(field?.dataType || ''));
}

export function resolveWebformTypeForCrmField(crmField, currentType) {
  const crmType = String(crmField?.dataType || '');
  const normalized = normalizeWebformFieldType(currentType);

  if (crmType === 'Email') return 'Email';
  if (crmType === 'Phone') return 'Phone';
  if (crmType === 'Multi-Picklist') return 'Multi-Picklist';
  if (crmType === 'Picklist') {
    if (normalized === 'Radio Button') return 'Radio Button';
    return 'Picklist';
  }
  return normalized;
}

/**
 * Apply CRM field metadata to a webform field (options, compatible type).
 * @param {object} webformField - Mutable draft field
 * @param {object|null} crmField - Module field definition from /modules API
 * @returns {boolean} Whether binding changed options or type
 */
export function applyCrmFieldBinding(webformField, crmField) {
  if (!webformField || !crmField) return false;

  let changed = false;
  const nextType = resolveWebformTypeForCrmField(crmField, webformField.type);
  if (nextType && normalizeWebformFieldType(webformField.type) !== nextType) {
    webformField.type = nextType;
    changed = true;
  }

  if (isCrmPicklistField(crmField) && fieldTypeNeedsOptions(webformField.type)) {
    const options = picklistValuesFromModuleField(crmField);
    if (options.length) {
      webformField.options = options;
      changed = true;
    }
  }

  return changed;
}
