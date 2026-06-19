/**
 * Module-definition helpers for webform builder and fill flows.
 */

import {
  getGlobalSystemFieldKeys,
  normalizeFieldKeyForSystemMatch
} from '@/platform/fields/fieldCapabilityEngine';
import { getFieldMetadataFromRegistry, isModuleRegistered } from '@/platform/fields/FieldRegistry';
import { isGlobalSystemFieldKey } from '@/platform/fields/globalSystemFields';
import { normalizeFieldKeyForMetadataLookup } from '@/platform/fields/BaseFieldModel';
import {
  WEBFORM_EXCLUDED_FIELD_TYPES,
  defaultColumnWidthForFieldType,
  normalizeWebformFieldType
} from '@/constants/moduleFieldTypes';
import { applyCrmFieldBinding, picklistValuesFromModuleField } from '@/utils/webformCrmFieldUtils';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { createWebformFieldId } from '@/utils/webformFormatters';
import { defaultFieldVisibility } from '@/utils/webformConditionalLogic';
import { isWebformFieldVisible } from '@/utils/webformConditionalLogic';

const INTERNAL_FALLBACK_SYSTEM_KEYS = new Set([
  'id',
  'organizationid',
  'createdat',
  'updatedat',
  'createdby',
  'modifiedby',
  'createdtime',
  'modifiedtime',
  'audithistory',
  ...getGlobalSystemFieldKeys()
]);

/**
 * @param {string} moduleKey
 * @param {object} field
 * @returns {boolean}
 */
export function isWebformEligibleModuleField(moduleKey, field) {
  if (!field?.key) return false;

  const dataType = normalizeWebformFieldType(field.dataType || field.type || 'Text');
  if (WEBFORM_EXCLUDED_FIELD_TYPES.has(dataType)) return false;

  const mk = String(moduleKey || '').toLowerCase();
  const fieldKeyNorm = normalizeFieldKeyForSystemMatch(field.key);

  if (INTERNAL_FALLBACK_SYSTEM_KEYS.has(fieldKeyNorm)) return false;
  if (mk === 'events' && fieldKeyNorm === 'status') return false;
  if (isGlobalSystemFieldKey(field.key)) return false;

  if (isModuleRegistered(mk)) {
    const metadata = getFieldMetadataFromRegistry(mk, field.key);
    if (metadata) {
      if (metadata.isVisibleInConfig === false) return false;
      if (metadata.owner === 'system' && metadata.editable === false) return false;
    }
  }

  const norm = normalizeFieldKeyForMetadataLookup(field.key);
  if (norm === 'participations' || norm === 'activitylogs') return false;

  return true;
}

/**
 * @param {object} moduleField
 * @returns {string}
 */
export function webformTypeFromModuleField(moduleField) {
  const dataType = normalizeWebformFieldType(moduleField?.dataType || moduleField?.type || 'Text');
  return dataType;
}

/**
 * @param {object} moduleField
 * @param {object} [options]
 * @returns {object}
 */
export function createWebformFieldFromModuleField(moduleField, options = {}) {
  const type = webformTypeFromModuleField(moduleField);
  const field = {
    fieldId: options.fieldId || createWebformFieldId(),
    label: String(moduleField.label || moduleField.key || '').trim() || moduleField.key,
    type,
    required: moduleField.required === true,
    helpText: String(moduleField.helpText || '').trim(),
    placeholder: String(moduleField.placeholder || '').trim(),
    options: picklistValuesFromModuleField(moduleField),
    crmFieldKey: String(moduleField.key || '').trim(),
    columnWidth: defaultColumnWidthForFieldType(type),
    order: Number.isFinite(Number(options.order)) ? Number(options.order) : 0,
    stepId: String(options.stepId || '').trim(),
    visibility: defaultFieldVisibility()
  };

  applyCrmFieldBinding(field, {
    key: moduleField.key,
    label: moduleField.label,
    dataType: moduleField.dataType || moduleField.type,
    options: moduleField.options
  });

  return field;
}

/**
 * Sync module metadata onto an existing webform field.
 * @param {object} webformField
 * @param {object} moduleField
 */
export function applyModuleFieldToWebformField(webformField, moduleField) {
  if (!webformField || !moduleField) return;

  webformField.crmFieldKey = String(moduleField.key || webformField.crmFieldKey || '').trim();
  if (!webformField.label) {
    webformField.label = String(moduleField.label || moduleField.key || '').trim();
  }

  const type = webformTypeFromModuleField(moduleField);
  webformField.type = type;

  applyCrmFieldBinding(webformField, {
    key: moduleField.key,
    label: moduleField.label,
    dataType: moduleField.dataType || moduleField.type,
    options: moduleField.options
  });
}

/**
 * @param {string} moduleKey
 * @param {object[]} moduleFields
 * @param {object} [options]
 * @returns {object[]}
 */
export function buildMandatoryWebformFields(moduleKey, moduleFields, options = {}) {
  const eligible = (Array.isArray(moduleFields) ? moduleFields : [])
    .filter((field) => isWebformEligibleModuleField(moduleKey, field));

  const emptyFormData = {};
  const pseudoWebformFields = eligible.map((field, index) => ({
    crmFieldKey: field.key,
    fieldId: `mandatory_${index}`
  }));
  const depContextFields = buildWebformDependencyContextFields(pseudoWebformFields, moduleFields);
  const mandatory = eligible.filter((field) => {
    const depState = getFieldDependencyState(field, emptyFormData, depContextFields, { moduleKey });
    return depState.required === true && depState.visible !== false;
  });

  const stepId = String(options.stepId || '').trim();
  return mandatory.map((moduleField, index) =>
    createWebformFieldFromModuleField(moduleField, {
      order: index,
      stepId
    })
  );
}

/**
 * @param {string} moduleKey
 * @param {object[]} moduleFields
 * @param {Set<string>} usedCrmKeys
 * @returns {object[]}
 */
export function moduleFieldsForWebformPalette(moduleKey, moduleFields, usedCrmKeys = new Set()) {
  return (Array.isArray(moduleFields) ? moduleFields : [])
    .filter((field) => isWebformEligibleModuleField(moduleKey, field))
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      dataType: webformTypeFromModuleField(field),
      required: field.required === true,
      onCanvas: usedCrmKeys.has(String(field.key || '').toLowerCase())
    }));
}

/**
 * @param {object[]|null|undefined} moduleFields
 * @returns {Map<string, object>}
 */
function moduleFieldByKeyMap(moduleFields) {
  const map = new Map();
  for (const field of Array.isArray(moduleFields) ? moduleFields : []) {
    const key = String(field?.key || '').trim().toLowerCase();
    if (key) map.set(key, field);
  }
  return map;
}

/**
 * @param {object} moduleField
 * @returns {object}
 */
export function moduleFieldToDependencyContextRow(moduleField) {
  return {
    key: String(moduleField?.key || '').trim(),
    label: moduleField?.label,
    required: moduleField?.required === true,
    dependencies: Array.isArray(moduleField?.dependencies) ? moduleField.dependencies : [],
    dataType: moduleField?.dataType || moduleField?.type,
    options: moduleField?.options,
    lookupSettings: moduleField?.lookupSettings || null,
    readonly: moduleField?.readonly === true
  };
}

/**
 * Expand seed CRM keys to include transitive dependency controller fields.
 * @param {object[]} moduleFields
 * @param {Iterable<string>} seedKeys
 * @returns {Set<string>}
 */
export function collectDependencyControllerKeys(moduleFields, seedKeys) {
  const keys = new Set(seedKeys);
  const byKey = moduleFieldByKeyMap(moduleFields);

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const key of [...keys]) {
      const field = byKey.get(key);
      if (!field) continue;
      const deps = Array.isArray(field.dependencies) ? field.dependencies : [];
      for (const dep of deps) {
        const conditions = Array.isArray(dep?.conditions) ? dep.conditions : [];
        const candidates = conditions.length
          ? conditions.map((row) => row?.fieldKey || row?.field || row?.sourceFieldKey)
          : [dep?.fieldKey || dep?.field || dep?.sourceFieldKey];
        for (const raw of candidates) {
          const controllerKey = String(raw || '').trim().toLowerCase();
          if (!controllerKey || keys.has(controllerKey)) continue;
          keys.add(controllerKey);
          expanded = true;
        }
      }
    }
  }

  return keys;
}

/**
 * Bound webform CRM fields plus module dependency controllers (picklists, lookups, virtual fields).
 * @param {object[]} webformFields
 * @param {object[]|null} [moduleFields]
 * @returns {object[]}
 */
export function buildWebformDependencyContextFields(webformFields, moduleFields = null) {
  const bound = buildModuleLikeFieldsFromWebform(webformFields, moduleFields);
  const rows = Array.isArray(moduleFields) ? moduleFields : [];
  if (!rows.length) return bound;

  const boundKeys = new Set(bound.map((field) => String(field.key || '').trim().toLowerCase()));
  const seedKeys = bound.map((field) => String(field.key || '').trim().toLowerCase()).filter(Boolean);
  const controllerKeys = collectDependencyControllerKeys(rows, seedKeys);
  const moduleMap = moduleFieldByKeyMap(rows);
  const result = [...bound];

  for (const key of controllerKeys) {
    if (boundKeys.has(key)) continue;
    const moduleField = moduleMap.get(key);
    if (!moduleField) continue;
    result.push(moduleFieldToDependencyContextRow(moduleField));
    boundKeys.add(key);
  }

  return result;
}

/**
 * Module fields from webform payload or explicit override.
 * @param {object|null|undefined} webform
 * @param {object[]|null|undefined} [overrideModuleFields]
 * @returns {object[]|null}
 */
export function resolveWebformModuleFields(webform, overrideModuleFields = null) {
  if (Array.isArray(overrideModuleFields)) return overrideModuleFields;
  if (Array.isArray(webform?.moduleFields)) return webform.moduleFields;
  return null;
}

/**
 * @param {object[]} webformFields
 * @param {object[]|null} [moduleFields]
 * @returns {object[]}
 */
export function buildModuleLikeFieldsFromWebform(webformFields, moduleFields = null) {
  const moduleMap = moduleFields ? moduleFieldByKeyMap(moduleFields) : null;

  return (Array.isArray(webformFields) ? webformFields : [])
    .filter((field) => String(field.crmFieldKey || '').trim())
    .map((field) => {
      const crmKey = String(field.crmFieldKey || '').trim();
      const moduleField = moduleMap?.get(crmKey.toLowerCase());

      if (moduleField) {
        return moduleFieldToDependencyContextRow({
          ...moduleField,
          label: moduleField.label || field.label,
          options: moduleField.options ?? field.options
        });
      }

      return moduleFieldToDependencyContextRow({
        key: crmKey,
        label: field.label,
        required: field.required === true,
        dependencies: field.dependencies,
        dataType: field.type,
        options: field.options
      });
    });
}

/**
 * @param {object[]} webformFields
 * @param {Record<string, unknown>} values
 * @returns {Record<string, unknown>}
 */
export function webformValuesToCrmFormData(webformFields, values) {
  const formData = {};
  for (const field of Array.isArray(webformFields) ? webformFields : []) {
    const key = String(field.crmFieldKey || '').trim();
    if (!key) continue;
    formData[key] = values?.[field.fieldId];
  }
  return formData;
}

/**
 * @param {object} webformField
 * @param {object[]} webformFields
 * @param {Record<string, unknown>} values
 * @param {string} moduleKey
 * @returns {{ visible: boolean, required: boolean, readonly: boolean, allowedOptions: string[]|null }}
 */
export function getWebformFieldDependencyState(
  webformField,
  webformFields,
  values,
  moduleKey,
  moduleFields = null
) {
  const crmKey = String(webformField?.crmFieldKey || '').trim();
  if (!crmKey) {
    return {
      visible: true,
      required: webformField?.required === true,
      readonly: false,
      allowedOptions: null,
      setValue: null
    };
  }

  const depContextFields = buildWebformDependencyContextFields(webformFields, moduleFields);
  const moduleField = depContextFields.find(
    (row) => String(row.key || '').toLowerCase() === crmKey.toLowerCase()
  );

  if (!moduleField) {
    return {
      visible: true,
      required: webformField?.required === true,
      readonly: false,
      allowedOptions: null,
      setValue: null
    };
  }

  const formData = webformValuesToCrmFormData(webformFields, values);
  const state = getFieldDependencyState(moduleField, formData, depContextFields, { moduleKey });
  return {
    visible: state.visible !== false,
    required: state.required === true,
    readonly: state.readonly === true,
    allowedOptions: Array.isArray(state.allowedOptions) ? state.allowedOptions : null,
    setValue: state.setValue ?? null
  };
}

/**
 * @param {object} field
 * @param {object[]} allFields
 * @param {Record<string, unknown>} values
 * @param {string} moduleKey
 * @returns {boolean}
 */
export function isWebformFieldVisibleWithDependencies(
  field,
  allFields,
  values,
  moduleKey,
  moduleFields = null
) {
  const depState = getWebformFieldDependencyState(field, allFields, values, moduleKey, moduleFields);
  if (!depState.visible) return false;

  // CRM-bound fields use module-definition dependencies only (not webform "Show when").
  if (String(field?.crmFieldKey || '').trim()) return true;

  return isWebformFieldVisible(field, allFields, values);
}

/**
 * @param {object[]} fields
 * @param {Record<string, unknown>} values
 * @param {string} moduleKey
 * @param {object[]|null} [moduleFields]
 * @returns {object[]}
 */
export function filterVisibleWebformFieldsWithDependencies(fields, values, moduleKey, moduleFields = null) {
  const rows = Array.isArray(fields) ? fields : [];
  return rows.filter((field) =>
    isWebformFieldVisibleWithDependencies(field, rows, values, moduleKey, moduleFields)
  );
}

/**
 * @param {string} moduleKey
 * @param {object} moduleField
 * @param {object[]} moduleFields
 * @returns {boolean}
 */
export function isBaseMandatoryModuleField(moduleKey, moduleField, moduleFields) {
  if (!moduleField) return false;
  const eligible = (Array.isArray(moduleFields) ? moduleFields : [])
    .filter((field) => isWebformEligibleModuleField(moduleKey, field));
  const pseudoWebformFields = eligible.map((field, index) => ({
    crmFieldKey: field.key,
    fieldId: `mandatory_${index}`
  }));
  const depContextFields = buildWebformDependencyContextFields(pseudoWebformFields, moduleFields);
  const depState = getFieldDependencyState(moduleField, {}, depContextFields, { moduleKey });
  return moduleField.required === true && depState.visible !== false;
}
