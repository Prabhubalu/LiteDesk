import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { getFieldMetadataFromRegistry, isModuleRegistered } from '@/platform/fields/FieldRegistry';
import { mergePeopleVirtualFieldDefinitions } from '@/platform/fields/peopleFieldRegistry';
import { isGlobalSystemFieldKey } from '@/platform/fields/globalSystemFields';
import { normalizeFieldKeyForMetadataLookup } from '@/platform/fields/BaseFieldModel';

const IMPORT_ENTITY_TO_MODULE = {
  Contacts: 'people',
  Deals: 'deals',
  Tasks: 'tasks',
  Organizations: 'organizations',
};

/** Fields that must never appear in CSV import mapping. */
const IMPORT_EXCLUDED_KEYS = new Set([
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid',
  'organizationid',
  'type', // legacy alias — use sales_type
]);

function isImportableField(fieldKey, moduleKey) {
  const norm = normalizeFieldKeyForMetadataLookup(fieldKey);
  if (!fieldKey || IMPORT_EXCLUDED_KEYS.has(norm)) return false;
  if (isGlobalSystemFieldKey(fieldKey)) return false;

  if (isModuleRegistered(moduleKey)) {
    const metadata = getFieldMetadataFromRegistry(moduleKey, fieldKey);
    if (metadata) {
      if (metadata.isVisibleInConfig === false) return false;
      if (metadata.owner === 'system' && metadata.editable === false) return false;
      return true;
    }
  }

  // Tenant-defined custom fields (no platform metadata)
  return true;
}

function participationGroupLabel(t, appKey) {
  if (appKey === 'SALES') return t('settings.modFieldsParticipationSales');
  if (appKey === 'AUDIT') return t('settings.modFieldsParticipationAudit');
  return t('settings.modFieldsParticipationApp', { app: appKey });
}

function coreGroupLabel(t, moduleKey) {
  if (moduleKey === 'people') return t('settings.modFieldsGroupCoreIdentity');
  if (moduleKey === 'organizations') return t('settings.modFieldsGroupCoreBusiness');
  return t('import.importFieldGroupGeneral');
}

function buildImportFieldOption(field) {
  const baseLabel = field.label || field.key;
  const required = field.required === true;
  return {
    label: baseLabel,
    displayLabel: required ? `${baseLabel} *` : baseLabel,
    value: field.key,
    required,
  };
}

/**
 * Loads importable module fields from the module API and groups them for HeadlessSelect.
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>} entityTypeRef
 */
export function useImportModuleFields(entityTypeRef) {
  const { t } = useI18n();
  const loading = ref(false);
  const loadError = ref(null);
  const moduleFields = ref([]);

  const moduleKey = computed(() => {
    const entityType = entityTypeRef?.value ?? entityTypeRef;
    return IMPORT_ENTITY_TO_MODULE[entityType] || null;
  });

  async function load() {
    const key = moduleKey.value;
    if (!key) {
      moduleFields.value = [];
      return;
    }

    loading.value = true;
    loadError.value = null;
    try {
      const res = await apiClient.get('/modules', { params: { key, context: 'all' } });
      if (!res?.success || !Array.isArray(res.data) || !res.data[0]) {
        moduleFields.value = [];
        return;
      }

      let fields = res.data[0].fields || [];
      if (key === 'people') {
        fields = mergePeopleVirtualFieldDefinitions(fields);
      }

      moduleFields.value = fields.filter((f) => f?.key && isImportableField(f.key, key));
    } catch (e) {
      loadError.value = e.message || 'Failed to load fields';
      moduleFields.value = [];
    } finally {
      loading.value = false;
    }
  }

  watch(moduleKey, load, { immediate: true });

  const availableFields = computed(() =>
    moduleFields.value.map((f) => buildImportFieldOption(f))
  );

  const requiredImportFields = computed(() =>
    availableFields.value.filter((f) => f.required)
  );

  const fieldOptionGroups = computed(() => {
    const key = moduleKey.value;
    if (!key || !moduleFields.value.length) return [];

    const core = [];
    const participationByApp = {};
    const custom = [];

    for (const f of moduleFields.value) {
      const fieldKey = f.key;
      const option = buildImportFieldOption(f);
      const metadata = isModuleRegistered(key)
        ? getFieldMetadataFromRegistry(key, fieldKey)
        : undefined;

      if (!metadata) {
        custom.push(option);
        continue;
      }

      if (metadata.owner === 'participation') {
        const app = metadata.fieldScope || f.appKey || 'OTHER';
        if (!participationByApp[app]) participationByApp[app] = [];
        participationByApp[app].push(option);
      } else if (metadata.owner === 'core' || (metadata.owner === 'system' && metadata.editable !== false)) {
        core.push(option);
      }
    }

    const groups = [];
    if (core.length) {
      groups.push({ label: coreGroupLabel(t, key), options: core });
    }

    for (const [appKey, options] of Object.entries(participationByApp).sort(([a], [b]) => a.localeCompare(b))) {
      groups.push({ label: participationGroupLabel(t, appKey), options });
    }

    if (custom.length) {
      groups.push({ label: t('import.importFieldGroupCustom'), options: custom });
    }

    return groups;
  });

  const displayFieldOptionGroups = computed(() =>
    fieldOptionGroups.value.map((group) => ({
      ...group,
      options: group.options.map((option) => ({
        ...option,
        label: option.displayLabel,
      })),
    }))
  );

  const fieldsByKey = computed(() => {
    const map = {};
    for (const field of moduleFields.value) {
      if (field?.key) map[field.key] = field;
    }
    return map;
  });

  return {
    loading,
    loadError,
    moduleKey,
    moduleFields,
    availableFields,
    requiredImportFields,
    fieldOptionGroups,
    displayFieldOptionGroups,
    fieldsByKey,
    load,
  };
}
