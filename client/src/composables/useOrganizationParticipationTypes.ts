/**
 * Fetch organization participation types per app (Lead, Customer, Vendor, …).
 * Mirrors usePeopleTypes.
 */
import { ref, onMounted, watch, type Ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { organizationParticipationTypesCacheVersion } from '@/utils/organizationParticipationTypesInvalidate';
import {
  type PeopleTypeDef,
  typeDefsFromStrings,
  parsePeopleTypesApiPayload,
} from '@/utils/peopleTypeColors';
import { ORGANIZATION_PARTICIPATION_BY_APP } from '@/platform/organizations/organizationParticipation';

type ParsedOrgParticipationTypes = {
  types: string[];
  typeDefs: PeopleTypeDef[];
  defaultRole: string;
};

const sharedCache = new Map<string, ParsedOrgParticipationTypes>();
const sharedInflight = new Map<string, Promise<ParsedOrgParticipationTypes>>();
const STORAGE_TTL_MS = 5 * 60 * 1000;

function clearSharedCache() {
  sharedCache.clear();
  sharedInflight.clear();
}

function defaultsForApp(key: string | null | undefined): string[] {
  const u = key && String(key).trim() ? String(key).toUpperCase() : 'SALES';
  const cfg =
    (ORGANIZATION_PARTICIPATION_BY_APP as Record<string, { allowedTypes: readonly string[] }>)[u];
  return cfg ? [...cfg.allowedTypes] : ['Customer'];
}

function defaultRoleForApp(key: string | null | undefined): string {
  const u = key && String(key).trim() ? String(key).toUpperCase() : 'SALES';
  const cfg =
    (ORGANIZATION_PARTICIPATION_BY_APP as Record<string, { defaultType: string }>)[u];
  if (cfg?.defaultType) return cfg.defaultType;
  const types = defaultsForApp(key);
  return types[0] || 'Customer';
}

function cacheKeyForApp(key: string): string {
  return String(key).toUpperCase();
}

function storageKeyForApp(key: string): string {
  return `arivu:org-participation-types:${cacheKeyForApp(key)}`;
}

function readStored(key: string): ParsedOrgParticipationTypes | null {
  try {
    const raw = localStorage.getItem(storageKeyForApp(key));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.updatedAt || 0) > STORAGE_TTL_MS) return null;
    const data = parsed.data as ParsedOrgParticipationTypes | undefined;
    if (!data?.types || !data?.typeDefs || !data?.defaultRole) return null;
    return data;
  } catch {
    return null;
  }
}

function writeStored(key: string, parsed: ParsedOrgParticipationTypes) {
  try {
    localStorage.setItem(
      storageKeyForApp(key),
      JSON.stringify({ data: parsed, updatedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

async function loadNetwork(key: string): Promise<ParsedOrgParticipationTypes> {
  const fallbackTypes = defaultsForApp(key);
  const fallbackDefault = defaultRoleForApp(key);
  const res = (await apiClient.get(
    '/settings/core-modules/organizations/participation-types',
    { params: { appKey: key } }
  )) as { success?: boolean; data?: unknown };
  const parsed = parsePeopleTypesApiPayload(res?.data, fallbackTypes, fallbackDefault);
  return {
    types: parsed.types,
    typeDefs: parsed.typeDefs,
    defaultRole: parsed.defaultRole,
  };
}

export function useOrganizationParticipationTypes(
  appKey: string | Ref<string | null | undefined> = 'SALES'
) {
  const isRef = typeof appKey === 'object' && appKey !== null && 'value' in appKey;
  const getKey = () =>
    isRef ? (appKey as Ref<string | null | undefined>).value : (appKey as string);

  const fallbackKey = getKey() ?? null;
  const initialTypes = defaultsForApp(fallbackKey);
  const types = ref<string[]>(initialTypes);
  const typeDefs = ref<PeopleTypeDef[]>(typeDefsFromStrings(initialTypes));
  const defaultRole = ref<string>(defaultRoleForApp(fallbackKey));
  const loading = ref(false);

  function applyParsed(parsed: ParsedOrgParticipationTypes) {
    types.value = parsed.types;
    typeDefs.value = parsed.typeDefs;
    defaultRole.value = parsed.defaultRole;
  }

  async function fetchTypes(key: string | null) {
    if (!key || String(key).trim() === '') {
      types.value = [];
      typeDefs.value = [];
      defaultRole.value = defaultRoleForApp(null);
      return;
    }
    const ck = cacheKeyForApp(key);
    const cached = sharedCache.get(ck);
    if (cached) {
      applyParsed(cached);
      return;
    }

    const stored = readStored(ck);
    if (stored) {
      sharedCache.set(ck, stored);
      applyParsed(stored);
      return;
    }

    const existingFlight = sharedInflight.get(ck);
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
    const p = loadNetwork(key)
      .then((parsed) => {
        sharedCache.set(ck, parsed);
        writeStored(ck, parsed);
        return parsed;
      })
      .finally(() => {
        sharedInflight.delete(ck);
      });
    sharedInflight.set(ck, p);

    try {
      applyParsed(await p);
    } catch {
      const fallbackTypes = defaultsForApp(key);
      const fallbackParsed: ParsedOrgParticipationTypes = {
        types: fallbackTypes,
        typeDefs: typeDefsFromStrings(fallbackTypes),
        defaultRole: defaultRoleForApp(key),
      };
      sharedCache.set(ck, fallbackParsed);
      writeStored(ck, fallbackParsed);
      applyParsed(fallbackParsed);
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => fetchTypes(getKey() ?? null));

  if (isRef) {
    watch(
      appKey as Ref<string | null | undefined>,
      (key) => {
        if (!key || String(key).trim() === '') {
          types.value = [];
          typeDefs.value = [];
          defaultRole.value = defaultRoleForApp(null);
          return;
        }
        const fb = defaultsForApp(key);
        types.value = fb;
        typeDefs.value = typeDefsFromStrings(fb);
        defaultRole.value = defaultRoleForApp(key);
        fetchTypes(key ?? null);
      },
      { immediate: false }
    );
  }

  watch(organizationParticipationTypesCacheVersion, () => {
    clearSharedCache();
    const key = getKey();
    if (key && String(key).trim() !== '') {
      fetchTypes(key);
    }
  });

  return {
    types,
    typeDefs,
    defaultRole,
    loading,
    refetch: () => fetchTypes(getKey() ?? null),
  };
}
