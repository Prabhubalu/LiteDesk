import DescriptionSection from '@/components/record-page/sections/DescriptionSection.vue';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import StageHistorySection from '@/components/record-page/sections/StageHistorySection.vue';
import RelatedSection from '@/components/record-page/sections/RelatedSection.vue';
import {
  ChartBarIcon,
  CalendarIcon,
  UserIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TagIcon,
  ClockIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  LinkIcon,
  FunnelIcon,
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  RectangleStackIcon,
  FlagIcon
} from '@heroicons/vue/24/outline';
import { getDealFieldMetadata, getDealSystemFields } from '@/platform/fields/dealFieldModel';
import { getGlobalSystemFieldKeys } from '@/platform/fields/fieldCapabilityEngine';
import { getKeyFields, getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { i18n } from '@/i18n/index';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { resolvePipelineLabel, resolveStageOrPicklistLabel } from '@/utils/configurableLabelResolver';

/** Normalize field key for exclusion check (lowercase, no spaces/hyphens/underscores). */
const normalizeKeyForExclusion = (key) =>
  String(key || '').toLowerCase().replace(/\s/g, '').replace(/-/g, '').replace(/_/g, '');

const toReadableFieldLabel = (fieldKey) => String(fieldKey || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (char) => char.toUpperCase());

const getStateFieldLabel = (fieldKey, fallback) => {
  const metadata = getDealFieldMetadata(fieldKey);
  const configured = metadata?.displayName || metadata?.label || fallback || toReadableFieldLabel(fieldKey);
  const t = i18n.global.t.bind(i18n.global);
  const te = i18n.global.te.bind(i18n.global);
  return resolveFieldLabel('deals', { key: fieldKey, label: configured }, t, te);
};

function resolveDealsFieldLabel(fieldKey, configuredLabel) {
  const t = i18n.global.t.bind(i18n.global);
  const te = i18n.global.te.bind(i18n.global);
  return resolveFieldLabel('deals', { key: fieldKey, label: configuredLabel }, t, te);
}

const getOwnerDisplayName = (record) => {
  const owner = record?.ownerId;
  if (!owner || typeof owner !== 'object') return '—';
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || '—';
};

const KEY_FIELD_SECTION_EXCLUDED_KEYS = Object.freeze(['name', 'title', 'description', 'subtasks']);
const KEY_SECTION_EDITABLE_TYPES = Object.freeze(new Set(['text', 'number', 'date', 'select', 'user', 'entity']));
const DETAIL_SECTION_BASE_EXCLUDED_KEYS = Object.freeze([
  'name', 'title', 'description', 'subtasks',
  'createdBy', 'createdAt', 'modifiedBy', 'updatedAt',
  'deletedAt', 'deletedBy', 'deletionReason',
  'stageHistory',
  // Infrastructure / internal – never show in Details (versions, logs, ordering, relationship arrays)
  'descriptionVersions',
  'activityLogs',
  'stageOrder',
  'lineItems',
  'dealPeople',
  'dealOrganizations',
  // notes is an array of { text, createdBy, createdAt } – edited via deal notes API, not inline
  'notes'
]);

const resolveValue = (input) => {
  if (input && typeof input === 'object' && 'value' in input) {
    return input.value;
  }
  return input;
};

const resolveDealStateKeys = (moduleDefinitionInput) => {
  const moduleDefinition = resolveValue(moduleDefinitionInput);
  const configured = getKeyFields(moduleDefinition)
    .map((field) => String(field?.key || '').trim())
    .filter(Boolean);
  return configured.filter((key) => !KEY_FIELD_SECTION_EXCLUDED_KEYS.includes(key));
};

const resolveConfiguredFieldMap = (moduleDefinitionInput) => {
  const moduleDefinition = resolveValue(moduleDefinitionInput);
  const configured = getKeyFields(moduleDefinition);
  return new Map(configured.map((field) => [String(field?.key || '').trim(), field]));
};

/** Map of all module fields by key (from moduleDefinition.fields), for detail section label/options lookup. */
const resolveModuleFieldsByKey = (moduleDefinitionInput) => {
  const moduleDefinition = resolveValue(moduleDefinitionInput);
  const fields = Array.isArray(moduleDefinition?.fields) ? moduleDefinition.fields : [];
  return new Map(fields.map((field) => [String(field?.key || '').trim(), field]).filter(([k]) => k));
};

const normalizeSelectOptions = (options) => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (option && typeof option === 'object') {
        const value = option.value ?? option.key ?? option.id ?? option.label ?? option.name;
        const label = option.label ?? option.name ?? option.value ?? option.key ?? option.id;
        if (value == null || label == null) return null;
        return {
          value,
          label: String(label),
          color: option.color || null
        };
      }
      if (option == null) return null;
      return { value: option, label: String(option) };
    })
    .filter(Boolean);
};

const resolveStateFieldType = (fieldKey, configuredField) => {
  const normalizedKey = String(fieldKey || '').trim().toLowerCase();
  if (normalizedKey === 'tags') return 'tags';
  if (fieldKey === 'ownerId') return 'user';
  const explicitDataType = String(configuredField?.dataType || '').toLowerCase();
  const metadata = getDealFieldMetadata(fieldKey);
  const filterType = String(metadata?.filterType || '').toLowerCase();

  if (explicitDataType.includes('date')) return 'date';
  if (filterType === 'date') return 'date';
  if (explicitDataType.includes('number') || explicitDataType.includes('currency') || explicitDataType.includes('decimal') || explicitDataType.includes('integer')) return 'number';
  if (filterType === 'number') return 'number';
  if (explicitDataType.includes('picklist') || explicitDataType.includes('select')) return 'select';
  if (filterType === 'select' || filterType === 'multi-select') return 'select';
  if (filterType === 'user') return 'user';
  if (filterType === 'entity' || explicitDataType.includes('lookup')) return 'entity';
  return 'text';
};

const resolveDetailFieldType = (fieldKey, configuredField) => {
  return resolveStateFieldType(fieldKey, configuredField);
};

const normalizeConfiguredKeySet = (moduleDefinitionInput) => {
  const moduleDefinition = resolveValue(moduleDefinitionInput);
  const configuredKeys = getKeyFields(moduleDefinition)
    .map((field) => String(field?.key || '').trim())
    .filter(Boolean);
  return new Set(configuredKeys.map((key) => key.toLowerCase()));
};

const resolveDetailFieldKeys = (moduleDefinitionInput) => {
  const moduleDefinition = resolveValue(moduleDefinitionInput);
  const moduleFields = Array.isArray(moduleDefinition?.fields) ? moduleDefinition.fields : [];
  const configuredKeySet = normalizeConfiguredKeySet(moduleDefinition);

  const excluded = new Set([
    ...DETAIL_SECTION_BASE_EXCLUDED_KEYS.map((k) => normalizeKeyForExclusion(k)),
    ...(getGlobalSystemFieldKeys?.() || []).map((k) => normalizeKeyForExclusion(k)),
    ...(getDealSystemFields?.() || []).map((k) => normalizeKeyForExclusion(k)),
    ...[...configuredKeySet].map((k) => normalizeKeyForExclusion(k))
  ]);

  return [...moduleFields]
    .sort((a, b) => Number(a?.order ?? 9999) - Number(b?.order ?? 9999))
    .filter((field) => {
      const key = String(field?.key || '').trim();
      if (!key) return false;
      if (excluded.has(normalizeKeyForExclusion(key))) return false;
      const showInDetail = field?.visibility?.detail;
      return showInDetail === true;
    })
    .map((field) => String(field?.key || '').trim());
};

const resolveDetailRawValue = (record, fieldKey, fieldType) => {
  if (!record || !fieldKey) return null;
  const rawValue = record?.[fieldKey];
  if (rawValue == null || rawValue === '') return null;

  if (fieldType === 'date') {
    return String(rawValue).slice(0, 10);
  }

  if (fieldType === 'number') {
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (fieldType === 'user' || fieldType === 'entity') {
    if (typeof rawValue === 'object') {
      return rawValue._id || rawValue.id || null;
    }
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  return rawValue;
};

const resolveDetailDisplayValue = (record, fieldKey, fieldType, formatDate) => {
  if (!record || !fieldKey) return '';
  const rawValue = record?.[fieldKey];
  if (rawValue == null || rawValue === '') return '';

  if (fieldType === 'date') {
    return formatDate(rawValue) || '';
  }

  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? rawValue.map((item) => {
      if (item == null) return null;
      if (typeof item === 'object') {
        return item.name || item.label || item.title || item.email || item._id || null;
      }
      return String(item);
    }).filter(Boolean).join(', ') : '';
  }

  const fk = String(fieldKey || '').toLowerCase();
  if (fk === 'stage' || fk === 'type' || fk === 'dealtype' || fk === 'deal_type') {
    const t = i18n.global.t.bind(i18n.global);
    const te = i18n.global.te.bind(i18n.global);
    const localized = resolveStageOrPicklistLabel(String(rawValue), t, te);
    if (localized) return localized;
  }
  if (fk === 'pipeline') {
    const t = i18n.global.t.bind(i18n.global);
    const te = i18n.global.te.bind(i18n.global);
    return resolvePipelineLabel(String(rawValue), null, t, te) || String(rawValue);
  }

  if (typeof rawValue === 'object') {
    if (fieldKey === 'ownerId') {
      return [rawValue.firstName, rawValue.lastName].filter(Boolean).join(' ') || rawValue.email || '';
    }
    // People/contact: prefer first_name + last_name (server) or firstName + lastName, then name, then email
    if (fieldKey === 'contactId') {
      const first = rawValue.first_name ?? rawValue.firstName ?? '';
      const last = rawValue.last_name ?? rawValue.lastName ?? '';
      const name = [first, last].filter(Boolean).join(' ').trim();
      return name || rawValue.name || rawValue.label || rawValue.title || rawValue.email || '';
    }
    return rawValue.name || rawValue.label || rawValue.title || rawValue.email || rawValue._id || '';
  }

  return String(rawValue);
};

const isLookupField = (configuredField) => {
  const dataType = String(configuredField?.dataType || '').toLowerCase();
  return dataType.includes('lookup');
};

const canInlineEditDetailField = (record, fieldKey, fieldType, configuredField, canEditDetails) => {
  if (String(fieldKey).toLowerCase() === 'source') return false;
  if (canEditDetails?.(record, fieldKey) !== true) return false;
  if (!KEY_SECTION_EDITABLE_TYPES.has(fieldType)) return false;
  return true;
};

const resolveNumberMin = (configuredField) => {
  const min = configuredField?.numberSettings?.min;
  return Number.isFinite(Number(min)) ? Number(min) : undefined;
};

const resolveNumberStep = (configuredField) => {
  const decimals = configuredField?.numberSettings?.decimalPlaces;
  if (!Number.isFinite(Number(decimals))) return undefined;
  const parsed = Number(decimals);
  if (parsed <= 0) return 1;
  return Number(`0.${'0'.repeat(parsed - 1)}1`);
};

const resolveStateFieldIcon = (fieldKey, configuredField) => {
  const normalizedKey = String(fieldKey || '').trim();
  const normalizedLowerKey = normalizedKey.toLowerCase();
  const metadata = getDealFieldMetadata(normalizedKey);
  const filterType = String(metadata?.filterType || '').toLowerCase();
  const dataType = String(configuredField?.dataType || '').toLowerCase();

  const keyIconMap = {
    stage: CheckCircleIcon,
    status: CheckCircleIcon,
    probability: ChartBarIcon,
    amount: CurrencyDollarIcon,
    currency: CurrencyDollarIcon,
    expectedvalue: CurrencyDollarIcon,
    expectedclosedate: CalendarIcon,
    actualclosedate: CalendarIcon,
    nextfollowupdate: CalendarIcon,
    ownerid: UserIcon,
    contactid: UserIcon,
    accountid: BuildingOfficeIcon,
    organizationid: BuildingOfficeIcon,
    dealpeople: UserGroupIcon,
    dealorganizations: BuildingOfficeIcon,
    pipeline: FunnelIcon,
    type: Squares2X2Icon,
    source: RectangleStackIcon,
    priority: FlagIcon,
    tags: TagIcon,
    lostreason: DocumentTextIcon,
    stagehistory: ClockIcon,
    lastactivitydate: ClockIcon,
    relatedto: LinkIcon,
    description: DocumentTextIcon,
    nextstep: DocumentTextIcon,
    notes: DocumentTextIcon,
    lineitems: ClipboardDocumentListIcon,
    customfields: DocumentTextIcon
  };

  if (keyIconMap[normalizedLowerKey]) {
    return keyIconMap[normalizedLowerKey];
  }

  if (['ownerid', 'contactid', 'accountid', 'createdby', 'modifiedby'].includes(normalizedLowerKey) || filterType === 'user') {
    return UserIcon;
  }

  if (['expectedclosedate', 'actualclosedate', 'lastactivitydate', 'nextfollowupdate', 'createdat', 'updatedat'].includes(normalizedLowerKey)
    || filterType === 'date'
    || dataType.includes('date')) {
    return CalendarIcon;
  }

  if (['amount', 'currency', 'probability'].includes(normalizedLowerKey)
    || filterType === 'number'
    || dataType.includes('number')
    || dataType.includes('decimal')
    || dataType.includes('integer')
    || dataType.includes('currency')) {
    return CurrencyDollarIcon;
  }

  if (['stage', 'pipeline', 'status', 'type', 'source', 'priority', 'lostreason', 'tags'].includes(normalizedLowerKey)
    || filterType === 'select'
    || filterType === 'multi-select'
    || dataType.includes('picklist')
    || dataType.includes('select')) {
    return TagIcon;
  }

  if (['stagehistory', 'notes'].includes(normalizedLowerKey)) {
    return ClockIcon;
  }

  if (['description', 'nextstep', 'lineitems', 'customfields'].includes(normalizedLowerKey)
    || filterType === 'text') {
    return DocumentTextIcon;
  }

  if (filterType === 'date') return CalendarIcon;
  if (filterType === 'number') return CurrencyDollarIcon;
  if (filterType === 'select' || filterType === 'multi-select') return TagIcon;
  if (filterType === 'user') return UserIcon;

  if (['date', 'date-time', 'datetime'].some((type) => dataType.includes(type))) return CalendarIcon;
  if (['integer', 'decimal', 'number', 'currency'].some((type) => dataType.includes(type))) return CurrencyDollarIcon;
  if (['picklist', 'multi-picklist', 'select'].some((type) => dataType.includes(type))) return TagIcon;
  if (['lookup', 'user'].some((type) => dataType.includes(type))) return UserIcon;

  return DocumentTextIcon;
};

export const createDealRecordAdapter = ({
  sectionLabels: sl,
  formatDate,
  moduleDefinition,
  participantPersonName,
  participantOrgName,
  participantRoleLabel,
  allPeople,
  allOrgs,
  canEditDetails,
  saveDetailField,
  openDetailFieldEditor,
  openCreateEvent,
  getRelatedGroups,
  openRelatedItem,
  canUnlinkRelated,
  onUnlinkRelated,
  canLinkRecords = false,
  openLinkRecordDrawer,
  openAddRecordDrawer,
  handleDescriptionSave,
  canEditDescription = false,
  canViewDescriptionHistory,
  openDescriptionHistory,
  expandedLeftSection,
  openLeftSection
}) => {
  const L = sl || {
    description: 'Description',
    details: 'Details',
    related: 'Related Records',
    stageHistory: 'Stage History',
    expand: 'Expand',
    history: 'History',
    linkRecord: 'Link record',
    addRecord: 'Add record',
  };

  return {
    module: 'deal',

    getSections(record) {
      const currentExpandedSection = String(resolveValue(expandedLeftSection) || '').trim();
      const isExpandedMode = currentExpandedSection.length > 0;
      const visibleKeys = isExpandedMode
        ? ['description', 'details', 'stage-history', 'related'].filter((key) => key === currentExpandedSection)
        : ['description', 'details', 'stage-history', 'related'];

      const sections = {
        description: {
          key: 'description',
          title: L.description,
          component: DescriptionSection,
          className: 'pt-4 pb-2',
          actions: [
            ...(canViewDescriptionHistory?.(record) ? [{ key: 'description-history', type: 'history', label: L.history, handler: () => openDescriptionHistory?.(record) }] : []),
            ...(!isExpandedMode ? [{ key: 'expand-description', type: 'expand', label: L.expand, handler: () => openLeftSection?.('description') }] : [])
          ]
        },
        details: {
          key: 'details',
          title: L.details,
          component: DetailsSection,
          className: 'pt-2 pb-2',
          actions: (!isExpandedMode ? [{ key: 'expand-details', type: 'expand', label: L.expand, handler: () => openLeftSection?.('details') }] : [])
        },
        'stage-history': {
          key: 'stage-history',
          title: L.stageHistory,
          component: StageHistorySection,
          className: 'pt-2 pb-2',
          actions: (!isExpandedMode ? [{ key: 'expand-stage-history', type: 'expand', label: L.expand, handler: () => openLeftSection?.('stage-history') }] : [])
        },
        related: {
          key: 'related',
          title: L.related,
          component: RelatedSection,
          className: 'pt-2 pb-3',
          actions: [
            ...(canLinkRecords ? [{ key: 'link-record', type: 'link', label: L.linkRecord, handler: () => openLinkRecordDrawer?.() }] : []),
            ...(canLinkRecords ? [{ key: 'add-record', type: 'plus', label: L.addRecord, handler: () => openAddRecordDrawer?.() }] : []),
            ...(!isExpandedMode ? [{ key: 'expand-related', type: 'expand', label: L.expand, handler: () => openLeftSection?.('related') }] : [])
          ]
        }
      };

      return visibleKeys.map((key) => sections[key]).filter(Boolean);
    },

    shouldRenderSection(section, record) {
      const name = section?.name || section?.__name;
      if (!record) return false;
      if (name === 'StageHistorySection') {
        return Array.isArray(record.stageHistory) && record.stageHistory.length > 0;
      }
      return true;
    },

    getDescription(record) {
      return record?.description || '';
    },

    canEditDescription() {
      return canEditDescription;
    },

    saveDescription(value, record) {
      if (typeof handleDescriptionSave === 'function') {
        handleDescriptionSave(value, record);
      }
    },

    getStateFields(record, context) {
      const moduleDefinitionValue = resolveValue(moduleDefinition);
      const configuredByKey = resolveConfiguredFieldMap(moduleDefinitionValue);

      return resolveDealStateKeys(moduleDefinitionValue).map((fieldKey) => {
        const configuredField = configuredByKey.get(fieldKey);
        const fallbackLabel = getStateFieldLabel(fieldKey, toReadableFieldLabel(fieldKey));
        const fieldType = resolveStateFieldType(fieldKey, configuredField);
        const canEditField = fieldKey !== 'ownerId'
          && fieldKey !== 'stage'
          && canEditDetails?.(null, fieldKey) === true
          && KEY_SECTION_EDITABLE_TYPES.has(fieldType);
        const canOpenEditor = fieldKey === 'ownerId' && canEditDetails?.(null, fieldKey) === true;
        const entityOptions = fieldType === 'entity' && context?.getStateFieldOptions
          ? (context.getStateFieldOptions(fieldKey) || [])
          : [];

        return {
          key: fieldKey,
          label: resolveDealsFieldLabel(
            fieldKey,
            configuredField ? getFieldDisplayLabel(configuredField) : fallbackLabel
          ),
          icon: resolveStateFieldIcon(fieldKey, configuredField),
          type: fieldType,
          options: fieldType === 'select' || fieldType === 'user'
            ? normalizeSelectOptions(configuredField?.options)
            : fieldType === 'entity'
              ? normalizeSelectOptions(entityOptions)
              : [],
          canEdit: canEditField,
          onSave: canEditField
            ? (value) => saveDetailField?.(fieldKey, value)
            : null,
          canOpenEditor,
          onEdit: canOpenEditor
            ? (event) => openDetailFieldEditor?.(fieldKey, null, event)
            : null
        };
      });
    },

    getStateValues(record) {
      const values = {};
      for (const fieldKey of resolveDealStateKeys(moduleDefinition)) {
        if (fieldKey === 'ownerId') {
          values[fieldKey] = getOwnerDisplayName(record);
          continue;
        }

        const metadata = getDealFieldMetadata(fieldKey);
        const rawValue = record?.[fieldKey];

        if (rawValue == null || rawValue === '') {
          values[fieldKey] = null;
          continue;
        }

        if (metadata?.filterType === 'date') {
          values[fieldKey] = String(rawValue).slice(0, 10);
          continue;
        }

        values[fieldKey] = rawValue;
      }
      return values;
    },

    getDetailFields(record, context) {
      if (!record) return [];
      const moduleDefinitionValue = resolveValue(moduleDefinition);
      const configuredByKey = resolveConfiguredFieldMap(moduleDefinitionValue);
      const moduleFieldsByKey = resolveModuleFieldsByKey(moduleDefinitionValue);
      const detailKeys = resolveDetailFieldKeys(moduleDefinitionValue);

      if (detailKeys.length === 0) {
        return [];
      }

      const canOpenTagsEditor = typeof context?.openTagsEditor === 'function';
      const getTagChipClass = context?.getTagChipClass;

      return detailKeys.map((fieldKey) => {
        const moduleField = moduleFieldsByKey.get(fieldKey) || configuredByKey.get(fieldKey);
        const fieldType = resolveDetailFieldType(fieldKey, moduleField);
        const canEdit = canInlineEditDetailField(record, fieldKey, fieldType, moduleField, canEditDetails);
        const isLookup = isLookupField(moduleField);
        const entityOptions = fieldType === 'entity' && context?.getDetailFieldOptions
          ? (context.getDetailFieldOptions(fieldKey) || [])
          : [];
        const hasEntityOptions = entityOptions.length > 0;
        const canOpenLookupEditor = isLookup && fieldKey !== 'ownerId' && canEditDetails?.(record, fieldKey) === true && !hasEntityOptions;

        let label = resolveDealsFieldLabel(
          fieldKey,
          moduleField ? getFieldDisplayLabel(moduleField) : toReadableFieldLabel(fieldKey)
        );
        if (String(fieldKey).toLowerCase() === 'source') {
          label = i18n.global.t('records.sectionCreatedVia');
        }

        const rawValue = resolveDetailRawValue(record, fieldKey, fieldType);
        let displayValue = resolveDetailDisplayValue(record, fieldKey, fieldType, formatDate);
        // When entity field has only an id (not populated), show name from options instead of id
        if (fieldType === 'entity' && entityOptions.length > 0 && rawValue != null && typeof rawValue !== 'object') {
          const idStr = String(rawValue);
          const option = entityOptions.find((o) => (o.value ?? o._id ?? o.id) != null && String(o.value ?? o._id ?? o.id) === idStr);
          if (option) {
            displayValue = option.label ?? option.name ?? displayValue;
          }
        }

        const isTextArea = fieldType === 'text' && String(moduleField?.dataType || '').toLowerCase().includes('area');
        const field = {
          key: fieldKey,
          label,
          prefixIcon: resolveStateFieldIcon(fieldKey, moduleField),
          value: rawValue,
          displayValue,
          type: fieldType,
          options: fieldType === 'select' || fieldType === 'user'
            ? normalizeSelectOptions(moduleField?.options)
            : fieldType === 'entity'
              ? normalizeSelectOptions(entityOptions)
              : [],
          min: fieldType === 'number' ? resolveNumberMin(moduleField) : undefined,
          step: fieldType === 'number' ? resolveNumberStep(moduleField) : undefined,
          multiline: isTextArea || undefined,
          rows: isTextArea ? (Number(moduleField?.rows) || 3) : undefined,
          canEdit: hasEntityOptions ? canEdit : canEdit && !isLookup,
          canOpenEditor: fieldKey === 'tags' ? canOpenTagsEditor : canOpenLookupEditor,
          onEdit: fieldKey === 'tags' && canOpenTagsEditor
            ? (event) => context.openTagsEditor?.(event, fieldKey, record)
            : canOpenLookupEditor
              ? (event) => openDetailFieldEditor?.(fieldKey, record, event)
              : null,
          onSave: (hasEntityOptions ? canEdit : (canEdit && !isLookup)) ? (value) => saveDetailField?.(fieldKey, value, record) : null
        };
        if (fieldKey === 'tags' && typeof getTagChipClass === 'function') {
          field.getTagChipClass = getTagChipClass;
        }
        if (fieldKey === 'contactId' && rawValue != null) {
          const id = typeof rawValue === 'object' ? (rawValue._id || rawValue.id) : rawValue;
          if (id) field.recordPath = `/people/${id}`;
        }
        if (fieldKey === 'accountId' && rawValue != null) {
          const id = typeof rawValue === 'object' ? (rawValue._id || rawValue.id) : rawValue;
          if (id) field.recordPath = `/organizations/${id}`;
        }
        return field;
      });
    },

    getStageHistory(record) {
      if (!Array.isArray(record?.stageHistory)) return [];
      return record.stageHistory.slice(0, 5).map((entry, index) => ({
        id: `${entry?.stage || 'stage'}-${entry?.changedAt || index}`,
        stage: entry?.stage || '—',
        changedAtLabel: formatDate(entry?.changedAt),
        changedBy: entry?.changedBy?.firstName || ''
      }));
    },

    getRelatedGroups(record) {
      if (typeof getRelatedGroups === 'function') {
        const value = getRelatedGroups(record);
        return Array.isArray(value) ? value : [];
      }
      if (!record?._id) return [];
      return [];
    },

    openRelatedItem(item, group, record, context) {
      openRelatedItem?.(item, group, record, context);
    },

    canUnlinkRelated(item, group, record, context) {
      return typeof canUnlinkRelated === 'function' ? canUnlinkRelated(item, group, record, context) : false;
    },

    onUnlinkRelated(item, group, record, context) {
      onUnlinkRelated?.(item, group, record, context);
    }
  };
};
