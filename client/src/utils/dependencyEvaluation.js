import { getFormFieldValue } from '@/utils/getFieldValue';

function findFieldByKey(allFields, fieldKey) {
  if (!fieldKey || !Array.isArray(allFields)) return null;
  const k = String(fieldKey).toLowerCase();
  return allFields.find((f) => f && String(f.key || '').toLowerCase() === k) || null;
}

function resolveDependencyFieldKey(fieldKey, context = {}) {
  const raw = String(fieldKey || '').trim();
  if (!raw) return raw;
  // People legacy compatibility: historical dependency rules may still reference `type`.
  // Canonical key is `sales_type` (virtual field mapped to participations.SALES.role).
  if ((context?.moduleKey || '').toLowerCase() === 'people' && raw.toLowerCase() === 'type') {
    return 'sales_type';
  }
  return raw;
}

function normalizeDependencyValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => normalizeDependencyValue(v));
  if (typeof value === 'object') {
    if (value._id !== undefined && value._id !== null && value._id !== '') return value._id;
    if (value.id !== undefined && value.id !== null && value.id !== '') return value.id;
    if (value.value !== undefined && value.value !== null && value.value !== '') return value.value;
    if (value.key !== undefined && value.key !== null && value.key !== '') return value.key;
    if (value.label !== undefined && value.label !== null && value.label !== '') return value.label;
    return '';
  }
  return value;
}

function toComparableString(value) {
  const normalized = normalizeDependencyValue(value);
  return String(normalized ?? '').trim();
}

function hasDependencyValue(value) {
  const normalized = normalizeDependencyValue(value);
  if (Array.isArray(normalized)) return normalized.length > 0;
  return normalized !== null && normalized !== undefined && String(normalized).trim() !== '';
}

function extractId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (value._id !== undefined && value._id !== null && value._id !== '') return value._id;
    if (value.id !== undefined && value.id !== null && value.id !== '') return value.id;
    return null;
  }
  const str = String(value).trim();
  return str === '' ? null : value;
}

/**
 * Evaluates if a dependency condition is met based on form data
 * @param {Object} dependency - The dependency rule
 * @param {Object} formData - Current form data
 * @param {Array} allFields - All field definitions for lookups
 * @returns {boolean} - True if condition is met
 */
export function evaluateDependencyCondition(condition, formData, allFields = [], context = {}) {
  if (!condition) return false;
  const rawConditionFieldKey = condition.fieldKey || condition.field || condition.sourceFieldKey;
  if (!rawConditionFieldKey) return false;

  const controllingFieldKey = resolveDependencyFieldKey(rawConditionFieldKey, context);
  const controllingField = findFieldByKey(allFields, controllingFieldKey);
  const fieldValueRaw = getFormFieldValue(formData, controllingFieldKey, controllingField, {
    moduleKey: context.moduleKey,
  });
  const fieldValue = normalizeDependencyValue(fieldValueRaw);
  const operator = String(condition.operator || 'equals').toLowerCase();
  const conditionValue = normalizeDependencyValue(condition.value);

  switch (operator) {
    case 'equals':
      return toComparableString(fieldValue) === toComparableString(conditionValue);
    
    case 'not_equals':
      return toComparableString(fieldValue) !== toComparableString(conditionValue);
    
    case 'in':
      // Handle array, comma-separated string, or single value
      let inArray = [];
      if (Array.isArray(conditionValue)) {
        inArray = conditionValue.map((v) => toComparableString(v)).filter(Boolean);
      } else if (typeof conditionValue === 'string' && conditionValue.includes(',')) {
        inArray = conditionValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (conditionValue !== null && conditionValue !== undefined) {
        inArray = [toComparableString(conditionValue)];
      }
      return inArray.includes(toComparableString(fieldValue));
    
    case 'not_in':
      // Handle array, comma-separated string, or single value
      let notInArray = [];
      if (Array.isArray(conditionValue)) {
        notInArray = conditionValue.map((v) => toComparableString(v)).filter(Boolean);
      } else if (typeof conditionValue === 'string' && conditionValue.includes(',')) {
        notInArray = conditionValue.split(',').map(s => s.trim()).filter(Boolean);
      } else if (conditionValue !== null && conditionValue !== undefined) {
        notInArray = [toComparableString(conditionValue)];
      }
      return !notInArray.includes(toComparableString(fieldValue));
    
    case 'exists':
      return hasDependencyValue(fieldValue);
    
    case 'gt':
      return Number(fieldValue) > Number(conditionValue);
    
    case 'lt':
      return Number(fieldValue) < Number(conditionValue);
    
    case 'gte':
      return Number(fieldValue) >= Number(conditionValue);
    
    case 'lte':
      return Number(fieldValue) <= Number(conditionValue);
    
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(conditionValue || '').toLowerCase());
    
    default:
      return false;
  }
}

/**
 * Evaluates all conditions for a dependency rule
 * @param {Object} dependency - The dependency rule
 * @param {Object} formData - Current form data
 * @param {Array} allFields - All field definitions
 * @returns {boolean} - True if dependency conditions are met
 */
export function evaluateDependency(dependency, formData, allFields = [], context = {}) {
  if (!dependency) return false;

  const validConditions = Array.isArray(dependency.conditions)
    ? dependency.conditions.filter((c) => !!(c && (c.fieldKey || c.field || c.sourceFieldKey)))
    : [];

  // Handle simple condition (backward compatible)
  if (validConditions.length === 0) {
    if (!dependency.fieldKey) return false;
    return evaluateDependencyCondition(
      { fieldKey: dependency.fieldKey, operator: dependency.operator || 'equals', value: dependency.value },
      formData,
      allFields,
      context
    );
  }

  const logic = String(dependency.logic || 'AND').toUpperCase();
  const results = validConditions.map(condition => 
    evaluateDependencyCondition(condition, formData, allFields, context)
  );

  if (logic === 'AND') {
    return results.every(r => r === true);
  } else {
    return results.some(r => r === true);
  }
}

/**
 * Resolve allowed child picklist options from a picklistValue dependency rule.
 * Returns [] when parent is empty or unmapped (restrict options).
 * Returns null when the rule is incomplete (ignore rule).
 */
export function resolvePicklistValueAllowedOptions(dep, formData, allFields = [], context = {}) {
  if (!dep?.parentFieldKey || !Array.isArray(dep.mappings)) return null;

  const parentKey = resolveDependencyFieldKey(dep.parentFieldKey, context);
  const parentFld = findFieldByKey(allFields, parentKey);
  const parentValueRaw = getFormFieldValue(formData, parentKey, parentFld, {
    moduleKey: context.moduleKey,
  });
  const parentValue = toComparableString(parentValueRaw);
  if (!parentValue) return [];

  const matchingMapping = dep.mappings.find(
    (m) => toComparableString(m?.parentValue) === parentValue
  );
  if (!matchingMapping || !Array.isArray(matchingMapping.allowedOptions)) return [];
  return matchingMapping.allowedOptions.map((opt) => String(opt || '')).filter(Boolean);
}

/**
 * Clear / filter picklist values that are no longer allowed under dependency rules.
 * Supports multi-level chains (Country → State → City) by iterating until stable.
 * Mutates a shallow copy of formData and returns it when changed; otherwise returns null.
 */
export function applyPicklistDependencyValueClears(fields, formData, context = {}) {
  if (!formData || !Array.isArray(fields) || fields.length === 0) return null;

  let next = formData;
  let changed = false;
  // Bound iterations to field count (worst-case chain length)
  const maxPasses = Math.max(fields.length, 1);
  for (let pass = 0; pass < maxPasses; pass++) {
    let passChanged = false;
    for (const field of fields) {
      if (!field?.key) continue;
      const dt = String(field.dataType || '');
      if (dt !== 'Picklist' && dt !== 'Multi-Picklist') continue;

      const depState = getFieldDependencyState(field, next, fields, context);
      if (!Array.isArray(depState.allowedOptions)) continue;

      const allowed = new Set(depState.allowedOptions.map((o) => toComparableString(o)));
      const current = getFormFieldValue(next, field.key, field, { moduleKey: context.moduleKey });

      if (dt === 'Multi-Picklist' && Array.isArray(current)) {
        const filtered = current.filter((v) => allowed.has(toComparableString(v)));
        if (filtered.length !== current.length) {
          if (!changed) next = { ...next };
          next[field.key] = filtered;
          changed = true;
          passChanged = true;
        }
        continue;
      }

      if (current === null || current === undefined || current === '') continue;
      if (!allowed.has(toComparableString(current))) {
        if (!changed) next = { ...next };
        next[field.key] = dt === 'Multi-Picklist' ? [] : '';
        changed = true;
        passChanged = true;
      }
    }
    if (!passChanged) break;
  }
  return changed ? next : null;
}

/**
 * Get the effective state of a field based on dependencies
 * @param {Object} field - The field definition
 * @param {Object} formData - Current form data
 * @param {Array} allFields - All field definitions
 * @returns {Object} - { visible: boolean, readonly: boolean, required: boolean, allowedOptions: Array }
 */
export function getFieldDependencyState(field, formData, allFields = [], context = {}) {
  if (!field || !field.dependencies || !Array.isArray(field.dependencies) || field.dependencies.length === 0) {
    return {
      visible: true,
      readonly: false,
      required: field.required || false,
      allowedOptions: null,
      label: null,
      lookupQuery: null,
      setValue: null
    };
  }

  let readonly = false;
  let required = field.required || false;
  let allowedOptions = null;
  let label = null;
  let lookupQuery = null;
  let setValue = null;

  const resolveLookupQuery = (value) => {
    // Allow templating: "$field:<fieldKey>" will be replaced with formData[fieldKey]
    // Works for nested objects/arrays.
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      const s = value.trim();
      if (s === '$currentUser.organizationId') {
        // Fallback chain:
        // 1) currentUser.organizationId (id or populated object)
        // 2) currentUser.organization (some profile payloads)
        // 3) auth organization store value passed through context.organization
        return (
          extractId(context?.currentUser?.organizationId) ||
          extractId(context?.currentUser?.organization) ||
          extractId(context?.organization?._id) ||
          extractId(context?.organization?.id) ||
          null
        );
      }
      if (s.startsWith('$field:')) {
        const key = s.slice('$field:'.length).trim();
        const fld = findFieldByKey(allFields, key);
        const v = formData
          ? getFormFieldValue(formData, key, fld, { moduleKey: context.moduleKey })
          : undefined;
        // If the form stores populated objects, normalize to _id when present
        if (v && typeof v === 'object' && v._id) return v._id;
        return v;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(resolveLookupQuery);
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveLookupQuery(v);
      return out;
    }
    return value;
  };

  // Separate visibility dependencies from others (normalize type — admin UI / imports may vary casing)
  const visibilityDeps = field.dependencies.filter(
    (d) => String(d?.type || '').toLowerCase() === 'visibility'
  );
  const otherDeps = field.dependencies.filter(
    (d) => String(d?.type || '').toLowerCase() !== 'visibility'
  );

  // Handle visibility: field is visible if ANY visibility dependency condition is met
  // If no visibility dependencies, field is visible by default
  let visible = true;
  if (visibilityDeps.length > 0) {
    visible = visibilityDeps.some(dep => evaluateDependency(dep, formData, allFields, context));
  }

  // Handle other dependency types (readonly, required, picklist)
  for (const dep of otherDeps) {
    const depType = String(dep?.type || '').toLowerCase();

    // picklistValue rules are mapping-driven (parentFieldKey + mappings), not condition-driven.
    // Do not gate on evaluateDependency — those rules typically have no fieldKey/conditions.
    if (depType === 'picklistvalue') {
      const resolved = resolvePicklistValueAllowedOptions(dep, formData, allFields, context);
      if (resolved !== null) {
        allowedOptions = resolved;
      }
      continue;
    }

    const conditionMet = evaluateDependency(dep, formData, allFields, context);
    if (!conditionMet) continue;

    switch (depType) {
      case 'readonly':
        readonly = conditionMet; // Override readonly state when condition is met
        break;
      
      case 'required':
        required = conditionMet; // Override required state when condition is met
        break;
      
      case 'picklist':
        // For picklist, only apply filter if condition is met
        if (dep.allowedOptions && Array.isArray(dep.allowedOptions) && dep.allowedOptions.length > 0) {
          allowedOptions = dep.allowedOptions.map(opt => String(opt || '')).filter(Boolean);
        }
        break;

      case 'label':
        // Label override is additive: first matching rule wins
        if (!label && dep.labelValue) {
          label = String(dep.labelValue);
        }
        break;

      case 'lookup':
        // Lookup query params: last matching rule wins (lets more-specific rules override generic ones)
        if (dep.lookupQuery && typeof dep.lookupQuery === 'object') {
          lookupQuery = resolveLookupQuery(dep.lookupQuery);
        }
        break;

      case 'setvalue':
        // Forced field value: last matching rule wins
        if (dep.setValue !== undefined) {
          setValue = resolveLookupQuery(dep.setValue);
        }
        break;
    }
  }

  // Check for popup dependencies
  let popupTrigger = null;
  for (const dep of field.dependencies) {
    if (String(dep?.type || '').toLowerCase() === 'popup') {
      const conditionMet = evaluateDependency(dep, formData, allFields, context);
      if (conditionMet && dep.popupFields && Array.isArray(dep.popupFields) && dep.popupFields.length > 0) {
        popupTrigger = {
          dependencyName: dep.name || '',
          fields: dep.popupFields
        };
        break; // Use first matching popup dependency
      }
    }
  }

  return {
    visible,
    readonly,
    required,
    allowedOptions,
    popupTrigger,
    label,
    lookupQuery,
    setValue
  };
}

