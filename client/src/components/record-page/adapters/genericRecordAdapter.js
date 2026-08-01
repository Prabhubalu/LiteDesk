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
import { getKeyFields, getFieldDisplayLabel, stripHtmlForDetailDisplay } from '@/utils/fieldDisplay';
import { getGlobalSystemFieldKeys } from '@/platform/fields/fieldCapabilityEngine';
import { getDefaultTagChipClass } from '@/components/record-page/composables/useRecordTags';
import { shouldHideDetailField, shouldHideRecordPaneDetailField } from '@/components/record-page/fieldVisibilityGuards';
import { canEditField } from '@/platform/fields/fieldCapabilityEngine';
import { isFieldVisibleInContext } from '@/utils/fieldContextFilter';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';
import { normalizeModuleKeyForRegistry, classifyFieldForModule } from '@/platform/fields/FieldRegistry';
import { getAllowedNextQuoteStatuses } from '@/constants/quoteLifecycle';
import {
  getPicklistOptionValue,
  getSemanticPicklistColor,
} from '@/utils/picklistColorPalette';
import { picklistBadgeStyle } from '@/utils/peopleParticipationPicklistColors';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import {
  formatPeopleNameWithSalutation,
  getPeopleSalutationOptionsFromModuleFields,
  resolvePeopleSalutation,
} from '@/platform/fields/peopleSalutationField';
import {
  getPrimaryOrganizationStatusFieldKey,
  isOrganizationDerivedStatusSystemOwned,
  resolveOrganizationKeyFieldStatus,
} from '@/platform/fields/organizationFieldModel';
import { getAllowedStatusesForOrganizationStatusField } from '@/platform/organizations/organizationIntents';

const KEY_SECTION_EXCLUDED = new Set(['name', 'title', 'description']);
const DETAIL_EXCLUDED = new Set([
  'name', 'title', 'description',
  'createdBy', 'createdAt', 'modifiedBy', 'updatedAt',
  'deletedAt', 'deletedBy', 'deletionReason',
  'organizationId', // Infrastructure: tenant context, never show on record page
  'activityLogs', 'subtasks', 'stageHistory', 'playbookState'
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

/** Shown in Document file section stack, not the Details field list. */
const DOCUMENT_FILE_DETAIL_EXCLUDED = new Set([
  'storagepath',
  'storageprovider',
  'checksum',
  'mimetype',
  'filesizebytes',
  'filetype',
  'currentversionid',
  'versionnumber',
  'sourcetype',
  'sourceprovider',
  'externalurl',
  'richcontent'
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

function isMultiPicklistField(field) {
  const dt = String(field?.dataType || '').toLowerCase();
  return dt.includes('multi-picklist') || dt.includes('multi picklist');
}

function normalizeArrayFieldValue(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) return value.length ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.length ? parsed : null;
      } catch {
        // fall through
      }
    }
  }
  return value;
}

function buildPicklistTagChipStyleResolver(fieldDef, moduleKey) {
  const options = normalizeSelectOptions(fieldDef?.options);
  const mk = String(moduleKey || '').toLowerCase();
  const fieldKey = String(fieldDef?.key || '');
  return (tag) => {
    const tagStr = String(tag ?? '').trim();
    if (!tagStr) return {};
    const opt = options.find((o) => {
      const v = String(o.value ?? '').trim();
      const l = String(o.label ?? '').trim();
      return (
        v.toLowerCase() === tagStr.toLowerCase()
        || l.toLowerCase() === tagStr.toLowerCase()
        || getPicklistOptionValue(o).toLowerCase() === tagStr.toLowerCase()
      );
    });
    const color = opt?.color || getSemanticPicklistColor(fieldKey, tagStr, mk);
    return picklistBadgeStyle(color);
  };
}

function fieldTypeFromDef(field, fieldKey) {
  const key = String(fieldKey || field?.key || '').trim().toLowerCase();
  if (key === 'tags') return 'tags';
  if (isMultiPicklistField(field)) return 'multi-select';
  if (!field) {
    if (
      key.includes('datetime')
      || /(created|updated|modified|deleted)at$/i.test(key)
    ) {
      return 'datetime';
    }
    if (
      /(closed|start|end|due|expected).*(date)/i.test(key)
      || ['duedate', 'birthday', 'expectedclosedate', 'closedate'].includes(key)
    ) {
      return 'date';
    }
    if (key === 'assignedto') return 'user';
    if (/(createdby|modifiedby|updatedby|assignedto)$/i.test(key) || /(owner|userid|caseowner)$/i.test(key)) return 'user';
    if (/(website|url|link)$/i.test(key)) return 'url';
    if (key === 'phone' || key === 'mobile') return 'phone';
    if (key === '_id' || key === 'id' || key === '__v') return 'text';
  }
  const dt = String(field?.dataType || '').toLowerCase();
  if (key === 'assignedto' || (field && String(field.key || '').toLowerCase() === 'assignedto')) {
    return 'user';
  }
  if (['createdby', 'updatedby', 'modifiedby', 'deletedby'].includes(key)) {
    return 'user';
  }
  if (
    dt === 'date-time'
    || dt === 'datetime'
    || dt.includes('date-time')
    || dt.includes('datetime')
  ) {
    return 'datetime';
  }
  if (dt.includes('date')) return 'date';
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
      const normalized = { value, label };
      if (option.color) normalized.color = option.color;
      if (option.enabled === false) normalized.enabled = false;
      return normalized;
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
  if (['ownerid', 'owner_id', 'assignedto', 'assignedto', 'createdby', 'updatedby', 'modifiedby', 'user'].includes(k) || dt.includes('user')) return UserIcon;
  if (['date', 'createdat', 'updatedat', 'closedate'].some((x) => k.includes(x)) || dt.includes('date')) return CalendarIcon;
  if (['amount', 'currency', 'number'].some((x) => k.includes(x)) || dt.includes('currency')) return CurrencyDollarIcon;
  const isSelectLikeTypeKey =
    k === 'sales_type' ||
    k === 'lead_status' ||
    k === 'contact_status' ||
    k === 'item_type' ||
    k === 'lifecycle_state' ||
    k === 'types' ||
    k === 'helpdesk_role';
  if (['stage', 'status', 'tags'].some((x) => k.includes(x)) || isSelectLikeTypeKey || dt.includes('select') || dt.includes('picklist')) return TagIcon;
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

function getDetailFieldKeys(moduleDefinition, moduleKey = '', fieldContext = 'platform', options = {}) {
  const def = resolveValue(moduleDefinition);
  const displayExcluded = getDisplayExcludedKeys();
  const excluded = new Set([...displayExcluded, ...getStateKeys(def, fieldContext).map(normKey)]);
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  const fields = filterFieldsForRecordSurface(Array.isArray(def?.fields) ? def.fields : [], fieldContext);
  const orgTypes = options.organizationSelectedTypes;
  const orgTypeDefs = options.organizationTypeDefs ?? null;
  return fields
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => {
      const key = String(f?.key || '').trim();
      if (!key) return false;
      if (excluded.has(normKey(key))) return false;
      if (normalizedModuleKey === 'items' && ITEM_CATALOG_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (normalizedModuleKey === 'documents' && DOCUMENT_FILE_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (
        shouldHideDetailField(f, normalizedModuleKey, {
          enforceRegistryKnown: true,
          organizationSelectedTypes: orgTypes,
          organizationTypeDefs: orgTypeDefs
        })
      ) {
        return false;
      }
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
function getRecordPaneAllModuleFieldKeys(moduleDefinition, moduleKey = '', fieldContext = 'platform', options = {}) {
  const def = resolveValue(moduleDefinition);
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  const fields = filterFieldsForRecordSurface(Array.isArray(def?.fields) ? def.fields : [], fieldContext);
  const orgTypes = options.organizationSelectedTypes;
  const orgTypeDefs = options.organizationTypeDefs ?? null;
  return fields
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => {
      const key = String(f?.key || '').trim();
      if (!key) return false;
      if (normalizedModuleKey === 'items' && ITEM_CATALOG_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (normalizedModuleKey === 'documents' && DOCUMENT_FILE_DETAIL_EXCLUDED.has(normKey(key))) return false;
      if (
        shouldHideRecordPaneDetailField(f, normalizedModuleKey, {
          organizationSelectedTypes: orgTypes,
          organizationTypeDefs: orgTypeDefs
        })
      ) {
        return false;
      }
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
 * @param {Object} opts - formatDate, formatDateTime, moduleDefinition, canEditDetails, saveDetailField, getRelatedGroups, openRelatedItem, canUnlinkRelated, onUnlinkRelated, canLinkRecords, openLinkRecordDrawer, openAddRecordDrawer, handleDescriptionSave, canEditDescription, expandedLeftSection, openLeftSection, canViewDescriptionHistory, openDescriptionHistory, getEntityOptions
 */
export function createGenericRecordAdapter(opts = {}) {
  const {
    sectionLabels: sl,
    formatDate,
    formatDateTime,
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

  const resolveOrganizationTypeDefs = () => {
    const raw = opts.organizationTypeDefs;
    if (raw == null) return null;
    if (typeof raw === 'object' && 'value' in raw) return raw.value ?? null;
    return raw;
  };

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
      if (item && typeof item === 'object' && 'value' in item && 'label' in item) {
        return {
          value: item.value,
          label: item.label,
          firstName: item.firstName ?? item.first_name,
          lastName: item.lastName ?? item.last_name,
          email: item.email,
          avatar: item.avatar,
        };
      }
      const id = item._id ?? item.id;
      const label = item.name ?? item.title ?? item.label ?? (id != null ? String(id) : '—');
      return {
        value: id,
        label,
        firstName: item.firstName ?? item.first_name,
        lastName: item.lastName ?? item.last_name,
        email: item.email,
        avatar: item.avatar,
      };
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
      const isMultiSelect = fieldType === 'multi-select';
      // Helpdesk: schema uses camelCase (contactId) but field defs may use "Contact Id", contactid, etc.
      const caseLoose = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const caseCanonicalByLoose =
        moduleKeyStr === 'cases'
          ? { contactid: 'contactId', organizationrefid: 'organizationRefId', assignedto: 'assignedTo' }
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
      if (isMultiSelect) {
        rawValue = normalizeArrayFieldValue(rawValue) || [];
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
      let options = fieldType === 'select' || isMultiSelect
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
      if (isMultiSelect && Array.isArray(rawValue)) {
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
      } else if (fieldKey === 'tags' && Array.isArray(rawValue)) {
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
        if (fieldType === 'datetime') {
          displayValue = formatDateTime
            ? formatDateTime(rawValue)
            : (formatDate ? formatDate(rawValue) : rawValue.toISOString());
        } else {
          displayValue = formatDate ? formatDate(rawValue) : rawValue.toISOString().slice(0, 10);
        }
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
        if (fieldType === 'datetime') {
          displayValue = formatDateTime
            ? formatDateTime(rawValue)
            : (formatDate ? formatDate(rawValue) : rawValue);
        } else {
          displayValue = formatDate ? formatDate(rawValue) : rawValue.slice(0, 10);
        }
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
      const isRichTextField =
        String(field?.dataType || '').toLowerCase().includes('rich') ||
        String(field?.dataType || '').toLowerCase().includes('text-area') ||
        String(field?.dataType || '').toLowerCase().includes('textarea') ||
        normalizedFieldKey === 'description' ||
        normalizedFieldKey === 'body';
      if (displayValue != null && displayValue !== '') {
        displayValue = stripHtmlForDetailDisplay(displayValue, field || { key: fieldKey });
      }
      if (moduleKeyStr === 'people' && normalizedFieldKey === 'first_name') {
        displayValue = formatPeopleNameWithSalutation(resolvePeopleSalutation(record), rawValue);
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
        ['text', 'url', 'phone', 'number', 'date', 'datetime', 'select', 'entity', 'user', 'multi-select'].includes(fieldType);
      const canOpenTagsEditor = isTags && typeof context?.openTagsEditor === 'function';
      const tagChipStyleResolver = isMultiSelect
        ? buildPicklistTagChipStyleResolver(field, moduleKeyStr)
        : undefined;
      const orgId = rawValue != null && typeof rawValue === 'object' ? (rawValue._id ?? rawValue.id) : (typeof rawValue === 'string' && rawValue.trim() ? rawValue.trim() : null);
      const recordPathForEntity = fieldType === 'entity' && orgId != null && /^(organization|account|company|organizationrefid)$/.test(String(fieldKey).toLowerCase())
        ? `/organizations/${orgId}`
        : undefined;
      return {
        key: fieldKey,
        label: field ? getFieldDisplayLabel(field) : toReadableLabel(fieldKey),
        prefixIcon: iconForKey(fieldKey, field),
        value: fieldKey === 'tags' || isMultiSelect
          ? (Array.isArray(rawValue) ? rawValue : (rawValue != null && rawValue !== '' ? [].concat(rawValue) : []))
          : rawValue,
        displayValue: displayValue == null || String(displayValue).trim() === '' ? '' : String(displayValue),
        type: fieldType,
        multiline: isRichTextField || undefined,
        rows: isRichTextField ? (Number(field?.rows) || 3) : undefined,
        options,
        recordPath: recordPathForEntity,
        canEdit,
        peopleFirstNameWithSalutation: moduleKeyStr === 'people' && normalizedFieldKey === 'first_name',
        salutationValue: moduleKeyStr === 'people' && normalizedFieldKey === 'first_name'
          ? (resolvePeopleSalutation(record) || '')
          : '',
        salutationOptions: moduleKeyStr === 'people' && normalizedFieldKey === 'first_name'
          ? getPeopleSalutationOptionsFromModuleFields(def?.fields)
          : [],
        onSave: canEdit
          ? (value) => {
            if (isMultiSelect) {
              const next = Array.isArray(value) ? value : normalizeArrayFieldValue(value) || [];
              return saveDetailField?.(fieldKey, next, record);
            }
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
        getTagChipStyle: tagChipStyleResolver,
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
      const moduleKeyStr = String(context?.moduleKey || context?.module || '').toLowerCase().trim();
      const keys = getStateKeys(def, fieldCtx);
      const fieldsByKey = new Map((def?.fields || []).map((f) => [String(f.key).trim(), f]));
      return keys.map((fieldKey) => {
        const field = fieldsByKey.get(fieldKey);
        const isOrgDerivedStatus = moduleKeyStr === 'organizations' && normKey(fieldKey) === 'derivedstatus';
        const backingStatusFieldKey = isOrgDerivedStatus
          ? getPrimaryOrganizationStatusFieldKey(record?.types)
          : null;
        const backingStatusField = backingStatusFieldKey ? fieldsByKey.get(backingStatusFieldKey) : null;
        let fieldType = fieldTypeFromDef(field, fieldKey);
        if (isOrgDerivedStatus && backingStatusField) {
          fieldType = 'select';
        }
        const isTags = fieldType === 'tags';
        const isPeopleFirstName = moduleKeyStr === 'people' && normKey(fieldKey) === 'first_name';
        let canEdit = !isTags && canEditDetails?.(null, fieldKey) === true && ['text', 'url', 'phone', 'number', 'date', 'datetime', 'select', 'entity', 'user', 'multi-select'].includes(fieldType);
        if (isOrgDerivedStatus) {
          const systemOwned = isOrganizationDerivedStatusSystemOwned(record);
          canEdit = !systemOwned
            && Boolean(backingStatusFieldKey)
            && canEditDetails?.(record, backingStatusFieldKey) === true;
        }
        const canOpenTagsEditor = isTags && typeof context?.openTagsEditor === 'function';
        const tagChipClassResolver = isTags
          ? (typeof context?.getTagChipClass === 'function' ? context.getTagChipClass : getDefaultTagChipClass)
          : undefined;
        const tagChipStyleResolver = (fieldType === 'multi-select' || fieldType === 'select')
          ? buildPicklistTagChipStyleResolver(field, moduleKeyStr)
          : undefined;
        let selectOptions = fieldType === 'select' || fieldType === 'multi-select'
          ? normalizeSelectOptions(field?.options)
          : ((fieldType === 'entity' || fieldType === 'user') ? entityOptionsFor(fieldKey) : []);
        if (
          fieldType === 'entity'
          && selectOptions.length === 0
          && normKey(fieldKey) === 'categoryid'
          && record?.category
        ) {
          const catId = record.categoryId && typeof record.categoryId === 'object'
            ? (record.categoryId._id ?? record.categoryId.id)
            : record.categoryId;
          if (catId) {
            selectOptions = [{ value: catId, label: String(record.category) }];
          }
        }
        if (isOrgDerivedStatus && backingStatusFieldKey) {
          const fromModule = normalizeSelectOptions(backingStatusField?.options);
          if (fromModule.length > 0) {
            selectOptions = fromModule;
          } else {
            const allowed = getAllowedStatusesForOrganizationStatusField(
              backingStatusFieldKey,
              Array.isArray(record?.types) ? record.types : []
            );
            selectOptions = allowed.map((status) => ({ value: status, label: status }));
          }
        }
        const picklistStyleField = isOrgDerivedStatus && backingStatusField
          ? { ...backingStatusField, key: backingStatusFieldKey }
          : field;
        const derivedStatusChipStyle = isOrgDerivedStatus && fieldType === 'select'
          ? buildPicklistTagChipStyleResolver(picklistStyleField, moduleKeyStr)
          : tagChipStyleResolver;
        const isCurrencyField =
          String(field?.dataType || '').toLowerCase().includes('currency')
          || ['selling_price', 'cost_price'].includes(String(fieldKey || '').toLowerCase());
        return {
          key: fieldKey,
          label: field ? getFieldDisplayLabel(field) : toReadableLabel(fieldKey),
          icon: iconForKey(fieldKey, field),
          type: fieldType,
          options: selectOptions,
          canEdit,
          peopleFirstNameWithSalutation: isPeopleFirstName,
          salutationValue: isPeopleFirstName ? (resolvePeopleSalutation(record) || '') : '',
          salutationOptions: isPeopleFirstName
            ? getPeopleSalutationOptionsFromModuleFields(def?.fields)
            : [],
          formatValue: isCurrencyField
            ? (raw) => {
              const num = Number(raw);
              if (!Number.isFinite(num)) return raw == null || raw === '' ? '' : String(raw);
              return formatCurrencyValue(num, {
                currencyCode: resolveOrgCurrencyCode(),
                maximumFractionDigits: num >= 1000 ? 0 : 2,
              }) || String(raw);
            }
            : undefined,
          onSave: canEdit
            ? (value) => {
              if (fieldType === 'multi-select') {
                const next = Array.isArray(value) ? value : [];
                return saveDetailField?.(fieldKey, next, record);
              }
              return saveDetailField?.(fieldKey, value, record);
            }
            : null,
          canOpenEditor: canOpenTagsEditor,
          onEdit: canOpenTagsEditor ? (e) => context.openTagsEditor(e, fieldKey, record) : null,
          getTagChipClass: tagChipClassResolver,
          getTagChipStyle: derivedStatusChipStyle,
        };
      });
    },

    getStateValues(record, context) {
      const def = resolveValue(moduleDefinition);
      const fieldCtx =
        context?.fieldContext != null && String(context.fieldContext).trim() !== ''
          ? String(context.fieldContext).toLowerCase()
          : 'platform';
      const moduleKeyStr = String(context?.moduleKey || context?.module || '').toLowerCase().trim();
      const keys = getStateKeys(def, fieldCtx);
      const fieldsByKey = new Map((def?.fields || []).map((f) => [String(f.key).trim(), f]));
      const values = {};
      for (const key of keys) {
        if (moduleKeyStr === 'organizations' && normKey(key) === 'derivedstatus') {
          values[key] = resolveOrganizationKeyFieldStatus(record);
          continue;
        }
        const v = record?.[key];
        const fieldDef = fieldsByKey.get(key);
        if (moduleKeyStr === 'people' && normKey(key) === 'first_name') {
          const formatted = formatPeopleNameWithSalutation(resolvePeopleSalutation(record), v);
          values[key] = formatted || null;
          continue;
        }
        if (key === 'tags' || isMultiPicklistField(fieldDef) || fieldTypeFromDef(fieldDef, key) === 'multi-select') {
          const normalized = normalizeArrayFieldValue(v);
          values[key] = Array.isArray(normalized) ? normalized : (normalized != null && normalized !== '' ? [].concat(normalized) : []);
          continue;
        }
        if (v == null || v === '') {
          values[key] = null;
          continue;
        }
        const valueFieldType = fieldTypeFromDef(fieldDef, key);
        // Keep user/entity raw values so EditableLabeledValue can resolve labels/avatars from options.
        if (valueFieldType === 'user' || valueFieldType === 'entity') {
          values[key] = v;
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
      const orgTypes = Array.isArray(record?.types) ? record.types : [];
      const orgOpts = {
        organizationSelectedTypes: orgTypes,
        organizationTypeDefs: resolveOrganizationTypeDefs()
      };
      let detailKeys = getDetailFieldKeys(def, moduleKey, fieldCtx, orgOpts);
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
      const orgTypes = Array.isArray(record?.types) ? record.types : [];
      const orgOpts = {
        organizationSelectedTypes: orgTypes,
        organizationTypeDefs: resolveOrganizationTypeDefs()
      };
      let keys = getRecordPaneAllModuleFieldKeys(def, moduleKey, fieldCtx, orgOpts);
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
