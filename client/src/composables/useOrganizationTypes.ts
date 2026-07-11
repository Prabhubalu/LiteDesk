/**
 * Tenant organization type definitions (Status & Types config) with per-type field overrides.
 */
import { ref, onMounted, watch } from 'vue';
import apiClient from '@/utils/apiClient';
import { organizationTypesCacheVersion } from '@/utils/organizationTypesInvalidate';
import {
  type OrganizationTypeDef,
  parseOrganizationTypesFromStatusTypesPayload
} from '@/utils/organizationTypeConfig';

type ParsedOrganizationTypes = {
  typeDefs: OrganizationTypeDef[];
  enabledTypes: string[];
};

const sharedCache = new Map<string, ParsedOrganizationTypes>();
const sharedInflight = new Map<string, Promise<ParsedOrganizationTypes>>();
const STORAGE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'default';

function storageKey(): string {
  return 'arivu:organization-types';
}

function readStored(): ParsedOrganizationTypes | null {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.updatedAt || 0) > STORAGE_TTL_MS) return null;
    const data = parsed.data as ParsedOrganizationTypes | undefined;
    if (!data?.typeDefs) return null;
    return data;
  } catch {
    return null;
  }
}

function writeStored(parsed: ParsedOrganizationTypes) {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({ data: parsed, updatedAt: Date.now() })
    );
  } catch {
    // localStorage may be unavailable
  }
}

function toParsed(typeDefs: OrganizationTypeDef[]): ParsedOrganizationTypes {
  const enabledTypes = typeDefs.filter((d) => d.enabled !== false).map((d) => d.value);
  return { typeDefs, enabledTypes };
}

async function loadOrganizationTypesNetwork(): Promise<ParsedOrganizationTypes> {
  const res = (await apiClient.get('/settings/core-modules/organizations/status-types')) as {
    success?: boolean;
    data?: unknown;
  };
  const typeDefs =
    res?.data != null ? parseOrganizationTypesFromStatusTypesPayload(res.data) : [];
  return toParsed(typeDefs);
}

function clearSharedCache() {
  sharedCache.clear();
  sharedInflight.clear();
}

export function useOrganizationTypes() {
  const typeDefs = ref<OrganizationTypeDef[]>([]);
  const enabledTypes = ref<string[]>([]);
  const loading = ref(false);

  function applyParsed(parsed: ParsedOrganizationTypes) {
    typeDefs.value = parsed.typeDefs;
    enabledTypes.value = parsed.enabledTypes;
  }

  async function fetchTypes() {
    const cached = sharedCache.get(CACHE_KEY);
    if (cached) {
      applyParsed(cached);
      return;
    }

    const stored = readStored();
    if (stored) {
      sharedCache.set(CACHE_KEY, stored);
      applyParsed(stored);
      return;
    }

    const existingFlight = sharedInflight.get(CACHE_KEY);
    if (existingFlight) {
      loading.value = true;
      try {
        applyParsed(await existingFlight);
      } finally {
        loading.value = false;
      }
      return;
    }

    loading.value = true;
    const p = loadOrganizationTypesNetwork()
      .then((parsed) => {
        sharedCache.set(CACHE_KEY, parsed);
        writeStored(parsed);
        return parsed;
      })
      .finally(() => {
        sharedInflight.delete(CACHE_KEY);
      });
    sharedInflight.set(CACHE_KEY, p);

    try {
      applyParsed(await p);
    } catch {
      const fallback = toParsed([]);
      sharedCache.set(CACHE_KEY, fallback);
      applyParsed(fallback);
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    void fetchTypes();
  });

  watch(organizationTypesCacheVersion, () => {
    clearSharedCache();
    void fetchTypes();
  });

  return {
    typeDefs,
    enabledTypes,
    loading,
    refetch: () => fetchTypes()
  };
}
