import { type ComputedRef, type Ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import { normalizeFilterSelectOptions } from '@/utils/picklistOptionUtils';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';

function getUserDisplayName(user: Record<string, unknown>): string {
  if (!user) return '';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  if (user.email) return String(user.email);
  if (user.username) return String(user.username);
  return String(user._id || user.id || 'Unknown User');
}

const BOOLEAN_OPTIONS: FilterConfig['options'] = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

type DocumentFolderRow = {
  _id?: string;
  id?: string;
  name?: string;
  path?: string;
};

type FilterSelectOption = NonNullable<FilterConfig['options']>[number];
type ModuleDefinition = {
  fields?: Array<{
    key?: string;
    options?: FilterConfig['options'];
  }>;
};

function cacheKey(moduleKey: string, fieldKey: string) {
  return `${moduleKey}:${fieldKey}`;
}

export function useFilterFieldOptions(
  moduleKey: Ref<string> | ComputedRef<string>,
  currentUserId: Ref<string | undefined>
) {
  const optionsByKey = reactive<Record<string, FilterConfig['options']>>({});
  const loadingKeys = new Set<string>();

  function resolveCacheKey(fieldKey: string, moduleKeyOverride?: string) {
    return cacheKey(moduleKeyOverride || moduleKey.value, fieldKey);
  }

  function getCachedOptions(fieldKey: string, moduleKeyOverride?: string) {
    return optionsByKey[resolveCacheKey(fieldKey, moduleKeyOverride)];
  }

  async function loadUserOptions(key: string, moduleKeyOverride?: string) {
    const scopedKey = resolveCacheKey(key, moduleKeyOverride);
    if (loadingKeys.has(scopedKey) || (getCachedOptions(key, moduleKeyOverride)?.length ?? 0) > 0) return;
    loadingKeys.add(scopedKey);
    try {
      const response = await apiClient.get('/users/list');
      const users = response.success && Array.isArray(response.data) ? response.data : [];
      const currentUserIdStr = currentUserId.value ? String(currentUserId.value) : null;
      const userOptions: NonNullable<FilterConfig['options']> = [
        { value: 'me', label: 'Me' },
        { value: 'unassigned', label: 'Unassigned' },
      ];
      for (const user of users) {
        if (!user) continue;
        const userIdStr = String(user._id || user.id);
        if (currentUserIdStr && userIdStr === currentUserIdStr) continue;
        userOptions.push({ value: userIdStr, label: getUserDisplayName(user) });
      }
      optionsByKey[scopedKey] = userOptions;
    } catch {
      optionsByKey[scopedKey] = [
        { value: 'me', label: 'Me' },
        { value: 'unassigned', label: 'Unassigned' },
      ];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

  async function loadOrganizationOptions(key: string, moduleKeyOverride?: string) {
    const scopedKey = resolveCacheKey(key, moduleKeyOverride);
    if (loadingKeys.has(scopedKey) || (getCachedOptions(key, moduleKeyOverride)?.length ?? 0) > 0) return;
    loadingKeys.add(scopedKey);
    try {
      const response = await apiClient.get('/v2/organization', { params: { limit: 1000 } });
      let orgs: Array<Record<string, unknown>> = [];
      if (response.success && Array.isArray(response.data)) {
        orgs = response.data;
      } else if (response.success && Array.isArray(response.data?.data)) {
        orgs = response.data.data;
      }
      const entityOptions: NonNullable<FilterConfig['options']> = [
        { value: 'has', label: 'Has Organization' },
        { value: '', label: 'No Organization' },
      ];
      for (const org of orgs) {
        if (!org) continue;
        entityOptions.push({
          value: String(org._id || org.id),
          label: String(org.name || 'Unnamed Organization'),
        });
      }
      optionsByKey[scopedKey] = entityOptions;
    } catch {
      optionsByKey[scopedKey] = [
        { value: 'has', label: 'Has Organization' },
        { value: '', label: 'No Organization' },
      ];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

  async function loadPeopleRecordOptions(key: string, moduleKeyOverride?: string) {
    const scopedKey = resolveCacheKey(key, moduleKeyOverride);
    if (loadingKeys.has(scopedKey) || (getCachedOptions(key, moduleKeyOverride)?.length ?? 0) > 0) return;
    loadingKeys.add(scopedKey);
    try {
      const response = await apiClient.get('/people', {
        params: { limit: 500, sortBy: 'firstName', sortOrder: 'asc' }
      });
      const rows = response.success && Array.isArray(response.data) ? response.data : [];
      optionsByKey[scopedKey] = rows.map((person: Record<string, unknown>) => {
        const id = String(person._id || person.id || '');
        const name = [person.first_name || person.firstName, person.last_name || person.lastName]
          .filter(Boolean)
          .join(' ');
        const label = name || String(person.email || id);
        return { value: id, label };
      }).filter((option: FilterSelectOption) => Boolean(option.value));
    } catch {
      optionsByKey[scopedKey] = [];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

  async function loadModuleFieldSelectOptions(
    key: string,
    filter: FilterConfig,
    moduleKeyOverride?: string
  ) {
    const scopedKey = resolveCacheKey(key, moduleKeyOverride);
    if (loadingKeys.has(scopedKey)) return;
    if ((filter.options?.length ?? 0) > 0 || (getCachedOptions(key, moduleKeyOverride)?.length ?? 0) > 0) {
      return;
    }

    loadingKeys.add(scopedKey);
    try {
      const mod = moduleKeyOverride || moduleKey.value;
      const moduleDef = await fetchModuleDefinitionCached(mod) as ModuleDefinition | null;
      const fields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
      const field = fields.find(
        (row: { key?: string }) => String(row?.key || '') === key
      );
      optionsByKey[scopedKey] = normalizeFilterSelectOptions(field?.options);
    } catch {
      optionsByKey[scopedKey] = [];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

  async function loadMarketingSelectOptions(
    key: string,
    filter: FilterConfig,
    moduleKeyOverride?: string
  ) {
    const scopedKey = resolveCacheKey(key, moduleKeyOverride);
    if (loadingKeys.has(scopedKey)) return;
    if ((filter.options?.length ?? 0) > 0 || (getCachedOptions(key, moduleKeyOverride)?.length ?? 0) > 0) {
      return;
    }

    loadingKeys.add(scopedKey);
    try {
      const mod = moduleKeyOverride || moduleKey.value;
      const response = await apiClient.get('/marketing/segments/field-options', {
        params: { moduleKey: mod, fieldKey: key },
        cache: 'no-store'
      });
      const options = normalizeFilterSelectOptions(
        Array.isArray(response?.data?.options) ? response.data.options : []
      );
      optionsByKey[scopedKey] = options;
    } catch {
      optionsByKey[scopedKey] = [];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

function isUserAssignmentField(key: string, filter: FilterConfig | null | undefined) {
  if (!key) return false;
  const bare = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const norm = bare.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (filter?.filterType === 'user') return true;
  return (
    norm === 'assignedto' ||
    norm === 'assignedby' ||
    norm === 'leadowner' ||
    norm === 'createdby' ||
    norm === 'modifiedby' ||
    norm === 'updatedby' ||
    norm === 'submittedby' ||
    norm === 'owner' ||
    norm === 'ownerid'
  );
}

  async function handleFilterOpened(
    key: string,
    filter: FilterConfig | null | undefined,
    moduleKeyOverride?: string
  ) {
    if (!key || !filter) return;
    const mod = moduleKeyOverride || moduleKey.value;
    if (filter.filterType === 'user' || isUserAssignmentField(key, filter)) {
      await loadUserOptions(key, moduleKeyOverride);
      return;
    }
    if (filter.filterType === 'entity') {
      if (key === 'organization' || key === 'organizationId') {
        await loadOrganizationOptions(key, moduleKeyOverride);
        return;
      }
      if (
        key === 'contactId' ||
        key === 'lead_owner' ||
        key === 'createdBy' ||
        (mod !== 'people' && key.toLowerCase().includes('contact'))
      ) {
        await loadPeopleRecordOptions(key, moduleKeyOverride);
        return;
      }
    }
    if (
      filter.filterType === 'select' &&
      (key === 'folderId' || key === 'folderName') &&
      mod === 'documents'
    ) {
      await loadDocumentFolderOptions(key);
      return;
    }
    if (filter.filterType === 'select' || filter.filterType === 'multi-select') {
      await loadModuleFieldSelectOptions(key, filter, moduleKeyOverride);
      if ((getCachedOptions(key, moduleKeyOverride)?.length ?? 0) === 0) {
        await loadMarketingSelectOptions(key, filter, moduleKeyOverride);
      }
    }
  }

  async function loadDocumentFolderOptions(key: string) {
    const scopedKey = resolveCacheKey(key, 'documents');
    if (loadingKeys.has(scopedKey) || (optionsByKey[scopedKey]?.length ?? 0) > 0) return;
    loadingKeys.add(scopedKey);
    try {
      const response = await apiClient.get('/document-folders', { params: { all: '1' } });
      const rows = response?.success && Array.isArray(response?.data) ? response.data : [];
      optionsByKey[scopedKey] = rows.map((folder: DocumentFolderRow) => {
        const id = String(folder?._id ?? folder?.id ?? '');
        const name = String(folder?.name || '').trim() || id;
        const path = String(folder?.path || '').trim();
        const label = path && path !== `/${name}` ? `${name} (${path})` : name;
        return { value: id, label };
      }).filter((option: FilterSelectOption) => Boolean(option.value));
      optionsByKey[resolveCacheKey('folderId', 'documents')] = optionsByKey[scopedKey];
      optionsByKey[resolveCacheKey('folderName', 'documents')] = optionsByKey[scopedKey];
    } catch {
      optionsByKey[scopedKey] = [];
    } finally {
      loadingKeys.delete(scopedKey);
    }
  }

  function enrichFilterConfig(config: FilterConfig, moduleKeyOverride?: string): FilterConfig {
    const normalizedConfig =
      isUserAssignmentField(config.key, config) && config.filterType !== 'user'
        ? { ...config, filterType: 'user' as const }
        : config;
    const normalizedOptions = normalizeFilterSelectOptions(normalizedConfig.options || []);
    if (normalizedOptions.length > 0) {
      return { ...normalizedConfig, options: normalizedOptions };
    }
    const mod = moduleKeyOverride || moduleKey.value;
    const peerKey =
      normalizedConfig.key === 'folderId' ? 'folderName'
        : normalizedConfig.key === 'folderName' ? 'folderId'
          : null;
    const loaded =
      getCachedOptions(normalizedConfig.key, mod) ??
      (peerKey ? getCachedOptions(peerKey, mod) : undefined);
    if (loaded?.length) {
      return { ...normalizedConfig, options: loaded };
    }
    if (normalizedConfig.filterType === 'boolean' && !normalizedConfig.options?.length) {
      return { ...normalizedConfig, options: BOOLEAN_OPTIONS };
    }
    return normalizedConfig;
  }

  function enrichFilterMap(
    map: Record<string, FilterConfig>,
    moduleKeyOverride?: string
  ): Record<string, FilterConfig> {
    const next: Record<string, FilterConfig> = {};
    for (const [key, config] of Object.entries(map)) {
      next[key] = enrichFilterConfig(config, moduleKeyOverride);
    }
    return next;
  }

  function seedOptionsFromMetadata(
    modules: Record<string, { fields?: Array<{ key: string; options?: FilterConfig['options'] }> }> | null | undefined
  ) {
    if (!modules) return;
    for (const [modKey, modMeta] of Object.entries(modules)) {
      for (const field of modMeta?.fields || []) {
        if (!field?.key || !field.options?.length) continue;
        const scopedKey = cacheKey(modKey, field.key);
        if ((optionsByKey[scopedKey]?.length ?? 0) > 0) continue;
        optionsByKey[scopedKey] = normalizeFilterSelectOptions(field.options);
      }
    }
  }

  return {
    handleFilterOpened,
    enrichFilterMap,
    seedOptionsFromMetadata,
  };
}
