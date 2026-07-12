/**
 * Load all module fields for process designer IF conditions.
 * Uses the same full module definition path as webforms (context=all + people virtuals).
 */

import { ref, watch, computed } from 'vue';
import { ENTITY_TYPE_TO_MODULE_KEY } from '@/utils/processDesignerConstants';
import { fetchWebformModuleDefinition } from '@/utils/webformModuleDefinition';
import { fetchCoreModulesSettingsCached } from '@/utils/tenantSchemaApiCache';
import { PEOPLE_PARTICIPATION_APP_KEYS } from '@/utils/peopleParticipationUi';

const APP_LABEL_FALLBACK = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  PLATFORM: 'Core'
};

/**
 * Apps from People Types → Application (core-modules people.applications).
 * @returns {Promise<Array<{ value: string, label: string }>>}
 */
async function fetchPeopleParticipationAppOptions() {
  try {
    const res = await fetchCoreModulesSettingsCached();
    const modules = res?.modules || res?.data?.modules || [];
    const people = modules.find(
      (m) => String(m.moduleKey || m.key || '').toLowerCase() === 'people'
    );
    const apps = Array.isArray(people?.applications) ? people.applications : [];
    const fromCore = apps
      .filter((a) => a && a.enabled !== false)
      .map((a) => {
        const value = String(a.appKey || '').toUpperCase();
        if (!value) return null;
        return {
          value,
          label: String(a.appName || APP_LABEL_FALLBACK[value] || value)
        };
      })
      .filter(Boolean);
    if (fromCore.length) return fromCore;
  } catch {
    /* fall through */
  }

  return PEOPLE_PARTICIPATION_APP_KEYS.map((value) => ({
    value,
    label: APP_LABEL_FALLBACK[value] || value
  }));
}

/** Common picklist fallbacks when module metadata lacks options. */
const MODULE_FIELD_OPTION_FALLBACKS = {
  people: {
    salutation: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Mx.', 'Other'],
    lead_status: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'],
    contact_status: ['Active', 'Inactive', 'DoNotContact'],
    role: ['Decision Maker', 'Influencer', 'Support', 'Other'],
    preferred_contact_method: ['Email', 'Phone', 'WhatsApp', 'SMS', 'None'],
    sales_type: ['Lead', 'Contact'],
    helpdesk_role: ['Customer', 'Agent'],
    lifecycle: ['Lead', 'Contact', 'Customer', 'Partner', 'Vendor', 'Inactive']
  },
  organizations: {
    customerStatus: ['Prospect', 'Active', 'On Hold', 'At Risk', 'Inactive', 'Churned'],
    partnerStatus: ['Invited', 'Onboarding', 'Active', 'Paused', 'Inactive'],
    vendorStatus: ['Prospect', 'Onboarding', 'Approved', 'Suspended', 'Inactive', 'Rejected']
  },
  deals: {
    status: ['Open', 'Won', 'Lost'],
    priority: ['Low', 'Medium', 'High', 'Urgent'],
    type: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell']
  },
  tasks: {
    status: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'],
    priority: ['low', 'medium', 'high', 'urgent']
  },
  cases: {
    priority: ['Low', 'Medium', 'High', 'Critical'],
    status: ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed'],
    caseType: ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'],
    channel: ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal']
  }
};

function toOption(opt) {
  if (opt == null || opt === '') return null;
  if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') {
    const value = String(opt);
    return { value, label: value };
  }
  if (typeof opt === 'object') {
    const value = opt.value ?? opt.key ?? opt.name ?? opt.label ?? '';
    if (value === '' || value == null) return null;
    const label = opt.label ?? opt.name ?? opt.value ?? value;
    return { value: String(value), label: String(label) };
  }
  return null;
}

function normalizeFieldOptions(field, moduleDoc, moduleKey) {
  const candidates = [
    field?.options,
    field?.enum,
    field?.picklistOptions,
    field?.allowedValues,
    field?.values
  ];

  let options = [];
  for (const raw of candidates) {
    if (!Array.isArray(raw) || !raw.length) continue;
    options = raw.map(toOption).filter(Boolean);
    if (options.length) break;
  }

  const key = String(field?.key || '');
  const keyLower = key.toLowerCase();

  if (!options.length && keyLower === 'stage' && Array.isArray(moduleDoc?.pipelineSettings)) {
    const names = new Set();
    for (const pipeline of moduleDoc.pipelineSettings) {
      for (const stage of pipeline.stages || []) {
        const name = (stage?.name || '').trim();
        if (name) names.add(name);
      }
    }
    options = [...names].sort().map((name) => ({ value: name, label: name }));
  }

  if (!options.length && keyLower === 'pipeline' && Array.isArray(moduleDoc?.pipelineSettings)) {
    options = moduleDoc.pipelineSettings
      .map((p) => {
        const value = p?.key || p?.name;
        if (!value) return null;
        return { value: String(value), label: String(p?.name || value) };
      })
      .filter(Boolean);
  }

  if (!options.length) {
    const fallbacks = MODULE_FIELD_OPTION_FALLBACKS[moduleKey]?.[key]
      || MODULE_FIELD_OPTION_FALLBACKS[moduleKey]?.[keyLower];
    if (Array.isArray(fallbacks) && fallbacks.length) {
      options = fallbacks.map((v) => ({ value: String(v), label: String(v) }));
    }
  }

  return options;
}

function normalizeDataType(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * Map module field dataType → value control type.
 * @returns {'select'|'number'|'boolean'|'date'|'datetime'|'text'}
 */
export function inferValueInputType(fieldMeta) {
  if (!fieldMeta) return 'text';

  const t = normalizeDataType(fieldMeta.dataType || fieldMeta.type);

  if (
    t.includes('multipicklist') ||
    t === 'multiselect' ||
    t === 'tags'
  ) {
    return 'multi-select';
  }

  if (Array.isArray(fieldMeta.options) && fieldMeta.options.length) return 'select';

  if (
    t.includes('picklist') ||
    t.includes('radiobutton') ||
    t === 'radio' ||
    t === 'select' ||
    t === 'enum' ||
    t === 'dropdown'
  ) {
    return 'select';
  }
  if (
    t.includes('number') ||
    t.includes('currency') ||
    t.includes('decimal') ||
    t.includes('integer') ||
    t.includes('percent') ||
    t === 'int' ||
    t === 'float'
  ) {
    return 'number';
  }
  if (t.includes('boolean') || t.includes('checkbox')) {
    return 'boolean';
  }
  if (t.includes('datetime')) {
    return 'datetime';
  }
  if (t === 'date' || (t.includes('date') && !t.includes('time'))) {
    return 'date';
  }
  return 'text';
}

/**
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>} entityTypeRef
 */
export function useProcessModuleFields(entityTypeRef) {
  const loading = ref(false);
  const loadError = ref(null);
  /** @type {import('vue').Ref<Record<string, { key: string, label: string, dataType: string, options: Array<{value:string,label:string}>, valueInputType: string }>>} */
  const fieldMetaByKey = ref({});

  const moduleKey = computed(() => {
    const et = entityTypeRef?.value ?? entityTypeRef;
    return ENTITY_TYPE_TO_MODULE_KEY[et] || et || null;
  });

  async function load() {
    const key = moduleKey.value;
    if (!key) {
      fieldMetaByKey.value = {};
      return;
    }

    loading.value = true;
    loadError.value = null;
    try {
      const { moduleRow, fields } = await fetchWebformModuleDefinition(key);
      const participationApps =
        key === 'people' ? await fetchPeopleParticipationAppOptions() : [];
      const map = {};
      for (const f of fields || []) {
        const fieldKey = f?.key;
        if (!fieldKey) continue;
        const keyLower = String(fieldKey).toLowerCase();
        let options = normalizeFieldOptions(f, moduleRow, key);
        let dataType = f.dataType || f.type || 'Text';
        let valueInputType = 'text';

        // People.participations → multi-picklist of Types → Application apps
        if (key === 'people' && keyLower === 'participations') {
          options = participationApps;
          dataType = 'Multi-Picklist';
          valueInputType = 'multi-select';
        } else {
          const entryProbe = { dataType, type: f.type, options };
          valueInputType = inferValueInputType(entryProbe);
        }

        map[fieldKey] = {
          key: fieldKey,
          label: f.label || fieldKey,
          dataType,
          options,
          valueInputType
        };
      }

      // Ensure participations exists even if omitted from module field list
      if (key === 'people' && !map.participations && !Object.keys(map).some((k) => k.toLowerCase() === 'participations')) {
        map.participations = {
          key: 'participations',
          label: 'Participations',
          dataType: 'Multi-Picklist',
          options: participationApps,
          valueInputType: 'multi-select'
        };
      }

      fieldMetaByKey.value = map;
    } catch (e) {
      loadError.value = e.message || 'Failed to load module fields';
      fieldMetaByKey.value = {};
    } finally {
      loading.value = false;
    }
  }

  watch(moduleKey, load, { immediate: true });

  function getFieldMeta(fieldKey) {
    if (!fieldKey) return null;
    return fieldMetaByKey.value[fieldKey] || null;
  }

  return {
    loading,
    loadError,
    fieldMetaByKey,
    moduleKey,
    load,
    getFieldMeta,
    inferValueInputType
  };
}
