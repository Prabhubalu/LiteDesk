import { type ComputedRef, type Ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';
import type { FilterConfig } from '@/platform/filters/filterResolver';

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

export function useFilterFieldOptions(
  moduleKey: Ref<string> | ComputedRef<string>,
  currentUserId: Ref<string | undefined>
) {
  const optionsByKey = reactive<Record<string, FilterConfig['options']>>({});
  const loadingKeys = new Set<string>();

  async function loadUserOptions(key: string) {
    if (loadingKeys.has(key) || (optionsByKey[key]?.length ?? 0) > 0) return;
    loadingKeys.add(key);
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
      optionsByKey[key] = userOptions;
    } catch {
      optionsByKey[key] = [
        { value: 'me', label: 'Me' },
        { value: 'unassigned', label: 'Unassigned' },
      ];
    } finally {
      loadingKeys.delete(key);
    }
  }

  async function loadOrganizationOptions(key: string) {
    if (loadingKeys.has(key) || (optionsByKey[key]?.length ?? 0) > 0) return;
    loadingKeys.add(key);
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
      optionsByKey[key] = entityOptions;
    } catch {
      optionsByKey[key] = [
        { value: 'has', label: 'Has Organization' },
        { value: '', label: 'No Organization' },
      ];
    } finally {
      loadingKeys.delete(key);
    }
  }

  async function handleFilterOpened(key: string, filter: FilterConfig | null | undefined) {
    if (!key || !filter) return;
    if (filter.filterType === 'user') {
      await loadUserOptions(key);
      return;
    }
    if (filter.filterType === 'entity' && key === 'organization' && moduleKey.value === 'people') {
      await loadOrganizationOptions(key);
      return;
    }
    if (
      filter.filterType === 'select' &&
      (key === 'folderId' || key === 'folderName') &&
      moduleKey.value === 'documents'
    ) {
      await loadDocumentFolderOptions(key);
    }
  }

  async function loadDocumentFolderOptions(key: string) {
    if (loadingKeys.has(key) || (optionsByKey[key]?.length ?? 0) > 0) return;
    loadingKeys.add(key);
    try {
      const response = await apiClient.get('/document-folders', { params: { all: '1' } });
      const rows = response?.success && Array.isArray(response?.data) ? response.data : [];
      optionsByKey[key] = rows.map((folder: DocumentFolderRow) => {
        const id = String(folder?._id ?? folder?.id ?? '');
        const name = String(folder?.name || '').trim() || id;
        const path = String(folder?.path || '').trim();
        const label = path && path !== `/${name}` ? `${name} (${path})` : name;
        return { value: id, label };
      }).filter((option: FilterSelectOption) => Boolean(option.value));
      if (key === 'folderId' || key === 'folderName') {
        optionsByKey.folderId = optionsByKey[key];
        optionsByKey.folderName = optionsByKey[key];
      }
    } catch {
      optionsByKey[key] = [];
    } finally {
      loadingKeys.delete(key);
    }
  }

  function enrichFilterConfig(config: FilterConfig): FilterConfig {
    if (config.options?.length) {
      return config;
    }
    const peerKey =
      config.key === 'folderId' ? 'folderName'
        : config.key === 'folderName' ? 'folderId'
          : null;
    const loaded = optionsByKey[config.key] ?? (peerKey ? optionsByKey[peerKey] : undefined);
    if (loaded?.length) {
      return { ...config, options: loaded };
    }
    if (config.filterType === 'boolean' && !config.options?.length) {
      return { ...config, options: BOOLEAN_OPTIONS };
    }
    return config;
  }

  function enrichFilterMap(map: Record<string, FilterConfig>): Record<string, FilterConfig> {
    const next: Record<string, FilterConfig> = {};
    for (const [key, config] of Object.entries(map)) {
      next[key] = enrichFilterConfig(config);
    }
    return next;
  }

  return {
    handleFilterOpened,
    enrichFilterMap,
  };
}
