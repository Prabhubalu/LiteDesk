/**
 * Generic record adapter for any module (people, organizations, events, items, custom).
 * Builds state fields, detail fields, and sections from module definition.
 * Same interface as deal/task adapters so SectionStack and RecordStateSection work unchanged.
 */
import DescriptionSection from '@/components/record-page/sections/DescriptionSection.vue';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import RelatedSection from '@/components/record-page/sections/RelatedSection.vue';
import {
  DocumentTextIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  LinkIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/vue/24/outline';
import { getKeyFields, getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getGlobalSystemFieldKeys } from '@/platform/fields/fieldCapabilityEngine';
import { getDefaultTagChipClass } from '@/components/record-page/composables/useRecordTags';
import { shouldHideDetailField, shouldHideRecordPaneDetailField } from '@/components/record-page/fieldVisibilityGuards';
import { canEditField } from '@/platform/fields/fieldCapabilityEngine';
import { isFieldVisibleInContext } from '@/utils/fieldContextFilter';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { normalizeModuleKeyForRegistry, classifyFieldForModule } from '@/platform/fields/FieldRegistry';
import { getAllowedNextQuoteStatuses } from '@/constants/quoteLifecycle';

const KEY_SECTION_EXCLUDED = new Set(['name', 'title', 'description']);
const DETAIL_EXCLUDED = new Set([
  'name', 'title', 'description',
  'createdBy', 'createdAt', 'modifiedBy', 'updatedAt',
  'deletedAt', 'deletedBy', 'deletionReason',
  'organizationId', // Infrastructure: tenant context, never show on record page
  'activityLogs', 'subtasks', 'stageHistory'
]);

/** Shown in Item catalog section stack, not the Details field list. */
const ITEM_CATALOG_DETAIL_EXCLUDED = new Set([
  'category',
  'subcategory',
  'categoryid',
  'attributevalues',
  'media',
  'variants',
  'defaultvariant',
  'catalogvariantid',
  'catalogcategory',
  'attributetemplates',
  'hasvariants',
  'defaultvariantid'
]);

/** Normalize field key for exclusion matching (lowercase, no spaces/dashes). */
function normKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Set of field keys to exclude from both Key fields and Details (system + audit). */
function getDisplayExcludedKeys() {
  const globalSystem = (getGlobalSystemFieldKeys && getGlobalSystemFieldKeys()) || [];
  return new Set([
    ...Array.from(DETAIL_EXCLUDED).map(normKey),
    ...globalSystem.map(normKey)
  ]);
}

function resolveValue(v) {
  if (typeof v === 'function') return v();
  if (v && typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

function toReadableLabel(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** 24-char hex ids: compact label for the right pane (full value remains in `value` for copy/edit flows if needed). */
function formatObjectIdForDisplay(maybeId) {
  if (maybeId == null || maybeId === '') return '';
  const s = String(maybeId);
  if (/^[a-f\d]{24}$/i.test(s)) return `${s.slice(0, 6)}…${s.slice(-4)}`;
  return s;
}

function formatActivitiesForDetailPane(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) return '';
  const n = rawList.length;
  const tail = rawList.slice(-3);
  const parts = tail.map((a) => {
    if (a == null) return '';
    if (typeof a !== 'object') return String(a);
    const line = [a.message, a.activityType].map((x) => (x == null ? '' : String(x).trim())).find(Boolean) || 'Entry';
    return line;
  }).filter(Boolean);
  const more = n > 3 ? ` · +${n - 3} more` : '';
  return `${n} ${n === 1 ? 'entry' : 'entries'}${more}` + (parts.length ? ` — ${parts.join(' · ')}` : '');
}

function fieldTypeFromDef(field, fieldKey) {
  const key = String(fieldKey || field?.key || '').trim().toLowerCase();
  if (key === 'tags') return 'tags';
  if (!field) {
    if (/(created|updated|modified|deleted|closed|start|end).*(at|date)/i.test(key) || ['duedate', 'birthday'].includes(key)) return 'date';
    if (key === 'caseownerid') return 'user';
    if (/(createdby|modifiedby|updatedby|assignedto)$/i.test(key) || /(owner|userid|caseowner)$/i.test(key)) return 'user';
    if (/(website|url|link)$/i.test(key)) return 'url';
    if (key === 'phone' || key === 'mobile') return 'phone';
    if (key === '_id' || key === 'id' || key === '__v') return 'text';
  }
  const dt = String(field?.dataType || '').toLowerCase();
  if (key === 'caseownerid' || (field && String(field.key || '').toLowerCase() === 'caseownerid')) {
    return 'user';
  }
  if (['createdby', 'updatedby', 'modifiedby', 'deletedby'].includes(key)) {
    return 'user';
  }
  if (dt.includes('date') || dt.includes('datetime')) return 'date';
  if (dt.includes('number') || dt.includes('currency') || dt.includes('decimal')) return 'number';
  if (dt.includes('select') || dt.includes('picklist') || dt.includes('status')) return 'select';
  if (dt.includes('url') || dt.includes('website') || dt.includes('link')) return 'url';
  if (dt.includes('phone')) return 'phone';
  if (dt.includes('user')) return 'user';
  if (dt.includes('lookup') || dt.includes('entity')) return 'entity';
  return 'text';
}

function normalizeSelectOptions(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (option == null) return null;
      if (typeof option === 'string' || typeof option === 'number') {
        const value = String(option);
        return { value, label: value };
      }
      const value = option.value ?? option.id ?? option._id ?? option.key ?? option.name;
      if (value == null) return null;
      const label = option.label ?? option.name ?? option.title ?? String(value);
      return { value, label };
    })
    .filter(Boolean);
}

function filterFieldsForRecordSurface(fields, fieldContext) {
  if (!Array.isArray(fields)) return [];
  const ctx =
    fieldContext != null && String(fieldContext).trim() !== ''
      ? String(fieldContext).toLowerCase()
      : 'platform';
  return fields.filter((f) => isFieldVisibleInContext(f, ctx));
}

function filterFieldKeysByDependencies(keys, fields, record, moduleKey) {
  if (!Array.isArray(keys) || !record || !Array.isArray(fields)) return keys;
  const mk = String(moduleKey || '').toLowerCase();
  return keys.filter((key) => {
    const field = fields.find((f) => normKey(f?.key) === normKey(key));
    if (!field?.dependencies?.length) return true;
    const depState = getFieldDependencyState(field, record, fields, { moduleKey: mk });
    return depState.visible !== false;
  });
}

function iconForKey(key, field) {
  const k = String(key || '').toLowerCase();
  const dt = String(field?.dataType || '').toLowerCase();
  if (['ownerid', 'owner_id', 'assignedto', 'caseownerid', 'createdby', 'updatedby', 'modifiedby', 'user'].includes(k) || dt.includes('user')) return UserIcon;
  if (['date', 'createdat', 'updatedat', 'closedate'].some((x) => k.includes(x)) || dt.includes('date')) return CalendarIcon;
  if (['amount', 'currency', 'number'].some((x) => k.includes(x)) || dt.includes('currency')) return CurrencyDollarIcon;
  const isSelectLikeTypeKey =
    k === 'sales_type' ||
    k === 'lead_status' ||
    k === 'contact_status' ||
    k === 'item_type' ||
    k === 'types' ||
    k === 'helpdesk_role';
  if (['stage', 'status', 'tags'].some((x) => k.includes(x)) || isSelectLikeTypeKey || dt.includes('select')) return TagIcon;
  if (['organization', 'account', 'company'].some((x) => k.includes(x))) return BuildingOfficeIcon;
  if (['link', 'related'].some((x) => k.includes(x))) return LinkIcon;
  return DocumentTextIcon;
}

/**
 * State keys for RecordStateSection (Key fields). Only fields explicitly marked as key fields
 * in field configuration (field.keyField === true). No fallback; empty if none configured.
 */
function getStateKeys(moduleDefinition, fieldContext = 'platform') {
  const def = resolveValue(moduleDefinition);
  const displayExcluded = getDisplayExcludedKeys();
  const filteredFields = filterFieldsForRecordSurface(def?.fields || [], fieldContext);
  const defForKeys = { ...def, fields: filteredFields };
  const keyFields = getKeyFields(defForKeys);
  return keyFields
    .map((f) => String(f?.key || '').trim())
    .filter((k) => k && !KEY_SECTION_EXCLUDED.has(k) && !displayExcluded.has(normKey(k)));
}

function getDetailFieldKeys(moduleDefinition, moduleKey = '', fieldContext = 'platform') {
  const def = resolveValue(moduleDefinition);
  const displayExcluded = getDisplayExcludedKeys();
  const excluded = new Set([...displayExcluded, ...getStateKeys(def, fieldContext).map(normKey)]);
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  const fields = filterFieldsForRecordSurface(Array.isArray(def?.fields) ? def.fields : [], fieldContext);
  return fields
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => {
      const key = String(f?.key || '').trim();
      if (!key) return false;
      if (excluded.has(normKey(key))) return false;
      if (normalizedModuleKey === 'items' && ITEM_CATALOG_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (shouldHideDetailField(f, normalizedModuleKey, { enforceRegistryKnown: true })) return false;
      const vis = f?.visibility;
      return vis?.detail !== false;
    })
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a?.f?.order)) ? Number(a.f.order) : null;
      const bOrder = Number.isFinite(Number(b?.f?.order)) ? Number(b.f.order) : null;
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      // Preserve configured module.fields order when "order" is absent.
      return a.index - b.index;
    })
    .map(({ f }) => f.key);
}

function scopeToGroupLabel(scope) {
  const s = String(scope || '').toUpperCase();
  if (s === 'SALES') return 'Sales';
  if (s === 'HELPDESK') return 'Helpdesk';
  if (s === 'PLATFORM') return 'Platform';
  return toReadableLabel(scope);
}

function participationSortOrder(scope) {
  const s = String(scope || '').toUpperCase();
  const map = { SALES: 51, HELPDESK: 52, PLATFORM: 53 };
  return map[s] ?? 58;
}

/**
 * Group headers for the right-pane Details tab (explicit uiGroup/group/section, else field registry).
 */
function getFieldGroupMeta(fieldDef, moduleKeyRaw, groupLabels = null) {
  const g = groupLabels || { groupCore: 'Core', groupSystem: 'System', groupOther: 'Other' };
  const explicit = fieldDef?.uiGroup ?? fieldDef?.group ?? fieldDef?.section;
  if (typeof explicit === 'string' && explicit.trim()) {
    const s = explicit.trim();
    return { id: `explicit-${normKey(s)}`, label: s, sortOrder: 40 };
  }
  const mk = normalizeModuleKeyForRegistry(moduleKeyRaw || '');
  const fieldKey = String(fieldDef?.key || '').trim();
  if (fieldKey && /^(createdat|updatedat|createdby|modifiedby|updatedby|_id|__v)$/i.test(fieldKey)) {
    return { id: 'system', label: g.groupSystem, sortOrder: 95 };
  }
  if (mk && fieldKey) {
    try {
      const c = classifyFieldForModule(mk, fieldKey);
      if (c === 'core') return { id: 'core', label: g.groupCore, sortOrder: 0 };
      if (c === 'system') return { id: 'system', label: g.groupSystem, sortOrder: 95 };
      if (c && c !== 'core' && c !== 'system') {
        return {
          id: `app-${c}`,
          label: scopeToGroupLabel(c),
          sortOrder: participationSortOrder(c)
        };
      }
    } catch (e) {
      /* ignore */
    }
  }
  return { id: '__fields__', label: g.groupOther, sortOrder: 80 };
}

/**
 * All module fields for the record right-pane Details tab: includes key fields, name/title/description,
 * system + audit fields (read-only in UI via canEditField); still hides trash/infra blobs.
 */
function getRecordPaneAllModuleFieldKeys(moduleDefinition, moduleKey = '', fieldContext = 'platform') {
  const def = resolveValue(moduleDefinition);
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  const fields = filterFieldsForRecordSurface(Array.isArray(def?.fields) ? def.fields : [], fieldContext);
  return fields
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => {
      const key = String(f?.key || '').trim();
      if (!key) return false;
      if (normalizedModuleKey === 'items' && ITEM_CATALOG_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (shouldHideRecordPaneDetailField(f, normalizedModuleKey)) return false;
      const vis = f?.visibility;
      return vis?.detail !== false;
    })
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a?.f?.order)) ? Number(a.f.order) : null;
      const bOrder = Number.isFinite(Number(b?.f?.order)) ? Number(b.f.order) : null;
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      return a.index - b.index;
    })
    .map(({ f }) => f.key);
}

/**
 * Create generic record adapter for a module.
 * @param {Object} opts - formatDate, moduleDefinition, canEditDetails, saveDetailField, getRelatedGroups, openRelatedItem, canUnlinkRelated, onUnlinkRelated, canLinkRecords, openLinkRecordDrawer, openAddRecordDrawer, handleDescriptionSave, canEditDescription, expandedLeftSection, openLeftSection, canViewDescriptionHistory, openDescriptionHistory, getEntityOptions
 */
export function createGenericRecordAdapter(opts = {}) {
  const {
    sectionLabels: sl,
    formatDate,
    moduleDefinition,
    canEditDetails,
    saveDetailField,
    getRelatedGroups = () => [],
    openRelatedItem,
    canUnlinkRelated,
    onUnlinkRelated,
    canLinkRecords = false,
    openLinkRecordDrawer,
    openAddRecordDrawer,
    handleDescriptionSave,
    canEditDescription = false,
    expandedLeftSection = '',
    openLeftSection,
    canViewDescriptionHistory = true,
    openDescriptionHistory,
    getEntityOptions
  } = opts;

  const L = sl || {
    description: 'Description',
    details: 'Details',
    related: 'Related Records',
    expand: 'Expand',
    history: 'History',
    linkRecord: 'Link record',
    addRecord: 'Add record',
    createdVia: 'Created via',
    groupCore: 'Core',
    groupSystem: 'System',
    groupOther: 'Other',
    groupRecord: 'Record',
  };

  /** Normalize entity list to { value, label } options. getEntityOptions(fieldKey) may return [] or array of { _id, name } or { value, label }. */
  function entityOptionsFor(fieldKey) {
    if (typeof getEntityOptions !== 'function') return [];
    const list = getEntityOptions(fieldKey);
    if (!Array.isArray(list) || list.length === 0) return [];
    return list.map((item) => {
      if (item && typeof item === 'object' && 'value' in item && 'label' in item) return { value: item.value, label: item.label };
      const id = item._id ?? item.id;
      const label = item.name ?? item.title ?? item.label ?? (id != null ? String(id) : '—');
      return { value: id, label };
    });
  }

  function buildDetailRowsForKeys(record, context, detailKeys) {
    const def = resolveValue(moduleDefinition);
    const fieldsByKey = new Map((def?.fields || []).map((f) => [String(f.key).trim(), f]));
    const moduleKeyStr = String(context?.moduleKey || context?.module || '').toLowerCase().trim();
    const rows = detailKeys.map((fieldKey, rowIndex) => {
      const field = fieldsByKey.get(fieldKey);
      const groupMeta = getFieldGroupMeta(field || { key: fieldKey }, moduleKeyStr, L);
      const fieldType = fieldTypeFromDef(field, fieldKey);
      const normalizedFieldKey = String(fieldKey || '').toLowerCase().trim();
      // Helpdesk: schema uses camelCase (contactId) but field defs may use "Contact Id", contactid, etc.
      const caseLoose = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const caseCanonicalByLoose =
        moduleKeyStr === 'cases'
          ? { contactid: 'contactId', organizationrefid: 'organizationRefId', caseownerid: 'caseOwnerId' }
          : null;
      const canonicalKey = caseCanonicalByLoose?.[caseLoose];
      let rawValue = record[fieldKey];
      if (
        (rawValue === undefined || rawValue === null || rawValue === '') &&
        canonicalKey &&
        record[canonicalKey] != null &&
        record[canonicalKey] !== ''
      ) {
        rawValue = record[canonicalKey];
      }
      const isArrayBackedSelect = fieldType === 'select' && (
        Array.isArray(rawValue) ||
        String(field?.dataType || '').toLowerCase().includes('multi') ||
        field?.allowMultiple === true ||
        field?.multiple === true ||
        field?.isArray === true ||
        normalizedFieldKey === 'types'
      );
      const entityOpts = (fieldType === 'entity' || fieldType === 'user') ? entityOptionsFor(fieldKey) : [];
      let options = fieldType === 'select'
        ? normalizeSelectOptions(field?.options)
        : ((fieldType === 'entity' || fieldType === 'user') ? entityOpts : []);

      // Quotes: restrict status options to valid next transitions (prevents 400 INVALID_TRANSITION).
      if (moduleKeyStr === 'quotes' && normalizedFieldKey === 'status') {
        const current = String(record?.status || rawValue || '').trim();
        const allowed = getAllowedNextQuoteStatuses(current);
        const scoped = [current, ...allowed].filter(Boolean);
        options = scoped.map((s) => ({ value: s, label: s }));
      }
      let displayValue = rawValue;
      if (fieldKey === 'tags' && Array.isArray(rawValue)) {
        displayValue = rawValue.length ? rawValue.join(', ') : '';
      } else if (normalizedFieldKey === 'activities' && Array.isArray(rawValue)) {
        displayValue = formatActivitiesForDetailPane(rawValue);
      } else if (Array.isArray(rawValue) && rawValue.length > 0) {
        const el0 = rawValue[0];
        if (el0 != null && typeof el0 === 'object' && !Array.isArray(el0) && !(el0 instanceof Date)) {
          displayValue = rawValue
            .map((item) => {
              if (item == null) return '';
              if (typeof item !== 'object') return String(item);
              return String(
                item.name ?? item.title ?? item.message ?? item.label
                  ?? item.email
                  ?? item.firstName
                  ?? [item.firstName, item.lastName].filter(Boolean).join(' ').trim()
                  ?? item._id
                  ?? ''
              ).trim() || '—';
            })
            .filter(Boolean)
            .join(', ');
        } else {
          displayValue = rawValue.map((x) => (x == null ? '' : String(x))).join(', ');
        }
      } else if (isArrayBackedSelect && Array.isArray(rawValue)) {
        const labels = rawValue.map((item) => {
          const itemId = item != null && typeof item === 'object' ? (item.value ?? item._id ?? item.id) : item;
          if (itemId == null) return '';
          const matchedOption = (options || []).find((opt) => {
            const optId = opt?.value ?? opt?._id ?? opt?.id;
            return optId != null && String(optId) === String(itemId);
          });
          return matchedOption?.label ?? String(itemId);
        }).filter(Boolean);
        displayValue = labels.join(', ');
      } else if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
        displayValue = formatDate ? formatDate(rawValue) : rawValue.toISOString().slice(0, 10);
      } else if (rawValue != null && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        const asStr = typeof rawValue.toString === 'function' ? String(rawValue) : '';
        if (/^[a-f\d]{24}$/i.test(asStr) && !(rawValue.name || rawValue.title || rawValue.email || rawValue.firstName)) {
          displayValue = asStr;
        } else {
          displayValue = rawValue.name ?? rawValue.title ?? rawValue.label ?? (`${(rawValue.firstName || '')} ${(rawValue.lastName || '')}`.trim() || rawValue.email || '');
        }
      } else if ((fieldType === 'select' || fieldType === 'entity' || fieldType === 'user') && rawValue != null && !Array.isArray(rawValue)) {
        const rawId = String(rawValue);
        const matchedOption = (options || []).find((opt) => {
          const optId = opt?.value ?? opt?._id ?? opt?.id;
          return optId != null && String(optId) === rawId;
        });
        displayValue = matchedOption?.label ?? matchedOption?.name ?? rawValue;
      } else if (rawValue != null && typeof rawValue === 'string' && /^\d{4}-\d{2}/.test(rawValue)) {
        displayValue = formatDate ? formatDate(rawValue) : rawValue.slice(0, 10);
      } else if (
        (normalizedFieldKey === '_id' || normalizedFieldKey === 'id') &&
        rawValue != null
      ) {
        const idStr = String(
          rawValue && typeof rawValue === 'object' && typeof rawValue.toString === 'function'
            ? rawValue.toString()
            : rawValue
        ).trim();
        if (/^[a-f\d]{24}$/i.test(idStr)) {
          displayValue = formatObjectIdForDisplay(idStr);
        }
      }
      const isTags = fieldType === 'tags';
      const registryMk = normalizeModuleKeyForRegistry(moduleKeyStr);
      let engineAllowsEdit = true;
      if (registryMk) {
        try {
          engineAllowsEdit = canEditField(registryMk, { key: fieldKey });
        } catch (e) {
          engineAllowsEdit = true;
        }
      }
      const readOnlyByKey = new Set([
        'activities',
        'slacycles',
        'currentslacycle',
        'assignmentcontrol'
      ]);
      const forceReadonlyRow =
        readOnlyByKey.has(normalizedFieldKey) ||
        (normalizedFieldKey === '_id' || normalizedFieldKey === 'id') ||
        ['createdby', 'updatedby', 'createdat', 'modifiedat', 'updatedat', 'deletedat', 'deletedby'].includes(normalizedFieldKey);
      const canEdit =
        !forceReadonlyRow &&
        engineAllowsEdit &&
        !isTags &&
        canEditDetails?.(record, fieldKey) === true &&
        ['text', 'url', 'phone', 'number', 'date', 'select', 'entity', 'user'].includes(fieldType);
      const canOpenTagsEditor = isTags && typeof context?.openTagsEditor === 'function';
      const orgId = rawValue != null && typeof rawValue === 'object' ? (rawValue._id ?? rawValue.id) : (typeof rawValue === 'string' && rawValue.trim() ? rawValue.trim() : null);
      const recordPathForEntity = fieldType === 'entity' && orgId != null && /^(organization|account|company|organizationrefid)$/.test(String(fieldKey).toLowerCase())
        ? `/organizations/${orgId}`
        : undefined;
      return {
        key: fieldKey,
        label: field ? getFieldDisplayLabel(field) : toReadableLabel(fieldKey),
        prefixIcon: iconForKey(fieldKey, field),
        value: fieldKey === 'tags' ? (Array.isArray(rawValue) ? rawValue : (rawValue != null && rawValue !== '' ? [].concat(rawValue) : [])) : rawValue,
        displayValue: displayValue == null || String(displayValue).trim() === '' ? '' : String(displayValue),
        type: fieldType,
        options,
        recordPath: recordPathForEntity,
        canEdit,
        onSave: canEdit
          ? (value) => {
            if (isArrayBackedSelect) {
              const nextValue = value == null || value === '' ? [] : [value];
              return saveDetailField?.(fieldKey, nextValue, record);
            }
            return saveDetailField?.(fieldKey, value, record);
          }
          : null,
        canOpenEditor: canOpenTagsEditor,
        onEdit: canOpenTagsEditor ? (e) => context.openTagsEditor(e, fieldKey, record) : null,
        getTagChipClass: isTags ? (typeof context?.getTagChipClass === 'function' ? context.getTagChipClass : getDefaultTagChipClass) : undefined,
        groupId: groupMeta.id,
        groupLabel: groupMeta.label,
        groupSortOrder: groupMeta.sortOrder,
        _rowIndex: rowIndex
      };
    });
    if (record.source != null && String(record.source).trim() !== '') {
      const already = rows.some((r) => r.key === 'source');
      if (!already) {
        const dv = String(record.source).trim();
        rows.push({
          key: 'source',
          label: L.createdVia,
          prefixIcon: TagIcon,
          value: record.source,
          displayValue: dv,
          type: 'text',
          options: [],
          recordPath: undefined,
          canEdit: false,
          onSave: null,
          canOpenEditor: false,
          onEdit: null,
          groupId: 'meta',
          groupLabel: L.groupRecord,
          groupSortOrder: 250,
          _rowIndex: rows.length
        });
      }
    }
    return rows;
  }

  return {
    module: 'generic',

    getSections(record) {
      const expanded = String(resolveValue(expandedLeftSection) || '').trim();
      const isExpanded = expanded.length > 0;
      // When description-history is open, show no sections (full-page view is shown by the page)
      const stackKeys = ['description', 'details', 'related'];
      const descriptionFullPage = expanded === 'description-history';
      const keys = isExpanded && !descriptionFullPage
        ? stackKeys.filter((k) => k === expanded)
        : descriptionFullPage ? [] : stackKeys;
      const sections = {
        description: {
          key: 'description',
          title: L.description,
          component: DescriptionSection,
          className: 'pt-4 pb-2',
          actions: (canViewDescriptionHistory && openDescriptionHistory ? [{ key: 'description-history', type: 'history', label: L.history, handler: () => openDescriptionHistory() }] : []).filter(Boolean)
        },
        details: {
          key: 'details',
          title: L.details,
          component: DetailsSection,
          className: 'pt-2 pb-2',
          actions: [!isExpanded && openLeftSection ? { key: 'expand-details', type: 'expand', label: L.expand, handler: () => openLeftSection('details') } : null].filter(Boolean)
        },
        related: {
          key: 'related',
          title: L.related,
          component: RelatedSection,
          className: 'pt-2 pb-3',
          actions: [
            ...(canLinkRecords && openLinkRecordDrawer ? [{ key: 'link-record', type: 'link', label: L.linkRecord, handler: () => openLinkRecordDrawer() }] : []),
            ...(canLinkRecords && openAddRecordDrawer ? [{ key: 'add-record', type: 'plus', label: L.addRecord, handler: () => openAddRecordDrawer() }] : []),
            ...(!isExpanded && openLeftSection ? [{ key: 'expand-related', type: 'expand', label: L.expand, handler: () => openLeftSection('related') }] : [])
          ]
        }
      };
      return keys.map((k) => sections[k]).filter(Boolean);
    },

    shouldRenderSection() {
      return true;
    },

    getDescription(record) {
      return record?.description ?? record?.body ?? '';
    },

    canEditDescription() {
      return canEditDescription;
    },

    saveDescription(value, record) {
      if (typeof handleDescriptionSave === 'function') handleDescriptionSave(value, record);
    },

    getStateFields(record, context) {
      const def = resolveValue(moduleDefinition);
      const fieldCtx =
        context?.fieldContext != null && String(context.fieldContext).trim() !== ''
          ? String(context.fieldContext).toLowerCase()
          : 'platform';
      const keys = getStateKeys(def, fieldCtx);
      const fieldsByKey = new Map((def?.fields || []).map((f) => [String(f.key).trim(), f]));
      return keys.map((fieldKey) => {
        const field = fieldsByKey.get(fieldKey);
        const fieldType = fieldTypeFromDef(field, fieldKey);
        const isTags = fieldType === 'tags';
        const canEdit = !isTags && canEditDetails?.(null, fieldKey) === true && ['text', 'url', 'phone', 'number', 'date', 'select', 'entity', 'user'].includes(fieldType);
        const canOpenTagsEditor = isTags && typeof context?.openTagsEditor === 'function';
        return {
          key: fieldKey,
          label: field ? getFieldDisplayLabel(field) : toReadableLabel(fieldKey),
          icon: iconForKey(fieldKey, field),
          type: fieldType,
          options: fieldType === 'select'
            ? normalizeSelectOptions(field?.options)
            : ((fieldType === 'entity' || fieldType === 'user') ? entityOptionsFor(fieldKey) : []),
          canEdit,
          onSave: canEdit ? (value) => saveDetailField?.(fieldKey, value, record) : null,
          canOpenEditor: canOpenTagsEditor,
          onEdit: canOpenTagsEditor ? (e) => context.openTagsEditor(e, fieldKey, record) : null,
          getTagChipClass: isTags ? (typeof context?.getTagChipClass === 'function' ? context.getTagChipClass : getDefaultTagChipClass) : undefined
        };
      });
    },

    getStateValues(record, context) {
      const def = resolveValue(moduleDefinition);
      const fieldCtx =
        context?.fieldContext != null && String(context.fieldContext).trim() !== ''
          ? String(context.fieldContext).toLowerCase()
          : 'platform';
      const keys = getStateKeys(def, fieldCtx);
      const values = {};
      for (const key of keys) {
        const v = record?.[key];
        if (key === 'tags') {
          values[key] = Array.isArray(v) ? v : (v != null && v !== '' ? [].concat(v) : []);
          continue;
        }
        if (v == null || v === '') {
          values[key] = null;
          continue;
        }
        if (typeof v === 'object' && (v?.name ?? v?.title ?? v?.firstName ?? v?.email)) {
          values[key] = v.name ?? v.title ?? (`${v.firstName || ''} ${v.lastName || ''}`.trim() || v.email || '—');
          continue;
        }
        if (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}/.test(v))) {
          values[key] = String(v).slice(0, 10);
          continue;
        }
        values[key] = v;
      }
      return values;
    },

    getDetailFields(record, context) {
      if (!record) return [];
      const def = resolveValue(moduleDefinition);
      const moduleKey = String(context?.moduleKey || context?.module || '').toLowerCase().trim();
      const fieldCtx =
        context?.fieldContext != null && String(context.fieldContext).trim() !== ''
          ? String(context.fieldContext).toLowerCase()
          : 'platform';
      const allFields = Array.isArray(def?.fields) ? def.fields : [];
      let detailKeys = getDetailFieldKeys(def, moduleKey, fieldCtx);
      if (moduleKey === 'people') {
        detailKeys = filterFieldKeysByDependencies(detailKeys, allFields, record, moduleKey);
      }
      const rows = buildDetailRowsForKeys(record, context, detailKeys);
      rows.forEach((r) => {
        delete r._rowIndex;
        delete r.groupSortOrder;
      });
      return rows;
    },

    getAllModuleFields(record, context) {
      if (!record) return [];
      const def = resolveValue(moduleDefinition);
      const moduleKey = String(context?.moduleKey || context?.module || '').toLowerCase().trim();
      const fieldCtx =
        context?.fieldContext != null && String(context.fieldContext).trim() !== ''
          ? String(context.fieldContext).toLowerCase()
          : 'platform';
      let keys = getRecordPaneAllModuleFieldKeys(def, moduleKey, fieldCtx);
      if (moduleKey === 'people') {
        keys = filterFieldKeysByDependencies(keys, Array.isArray(def?.fields) ? def.fields : [], record, moduleKey);
      }
      const seen = new Set(keys.map((k) => normKey(k)));
      const extraKeys = ['createdAt', 'updatedAt', 'createdBy', 'modifiedBy', 'updatedBy', '_id'];
      for (const ek of extraKeys) {
        if (seen.has(normKey(ek))) continue;
        if (record[ek] === undefined && ek !== '_id') continue;
        if (ek === '_id' && record._id == null) continue;
        keys.push(ek);
        seen.add(normKey(ek));
      }
      const rows = buildDetailRowsForKeys(record, context, keys);
      rows.sort((a, b) => {
        const oa = a.groupSortOrder ?? 999;
        const ob = b.groupSortOrder ?? 999;
        if (oa !== ob) return oa - ob;
        return (a._rowIndex ?? 0) - (b._rowIndex ?? 0);
      });
      rows.forEach((row) => {
        delete row._rowIndex;
        delete row.groupSortOrder;
      });
      return rows;
    },

    getRelatedGroups(record) {
      const value = typeof getRelatedGroups === 'function' ? getRelatedGroups(record) : [];
      return Array.isArray(value) ? value : [];
    },

    openRelatedItem(item, group, record, ctx) {
      openRelatedItem?.(item, group, record, ctx);
    },

    canUnlinkRelated(item, group, record, ctx) {
      return typeof canUnlinkRelated === 'function' ? canUnlinkRelated(item, group, record, ctx) : false;
    },

    onUnlinkRelated(item, group, record, ctx) {
      onUnlinkRelated?.(item, group, record, ctx);
    }
  };
}
