/**
 * Fetch People module field definitions (includes configurable picklist options).
 * Shared cache so modals and record surfaces do not repeat the same request.
 */
import { ref, onMounted, type Ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type { PeopleModuleField } from '@/utils/peopleModuleFieldUtils';

type PeopleModulePayload = {
  fields?: PeopleModuleField[];
};

type CachedPeopleModule = {
  fields: PeopleModuleField[];
};

let sharedCache: CachedPeopleModule | null = null;
let sharedInflight: Promise<CachedPeopleModule> | null = null;

export function invalidatePeopleModuleFieldsCache() {
  sharedCache = null;
  sharedInflight = null;
}

async function loadPeopleModuleFieldsNetwork(): Promise<CachedPeopleModule> {
  const res = (await apiClient.get('/modules/people/quick-create', {
    params: { context: 'all' },
  })) as {
    success?: boolean;
    data?: PeopleModulePayload;
  };
  const fields = Array.isArray(res?.data?.fields) ? res.data.fields : [];
  return { fields };
}

export function usePeopleModuleFields(options?: { enabled?: Ref<boolean> | boolean }) {
  const fields = ref<PeopleModuleField[]>(sharedCache?.fields ?? []);
  const loading = ref(false);

  const isEnabled = () => {
    const flag = options?.enabled;
    if (flag == null) return true;
    return typeof flag === 'boolean' ? flag : Boolean(flag.value);
  };

  async function fetchFields(force = false) {
    if (!isEnabled()) return;

    if (!force && sharedCache) {
      fields.value = sharedCache.fields;
      return;
    }

    if (!force && sharedInflight) {
      loading.value = true;
      try {
        const parsed = await sharedInflight;
        fields.value = parsed.fields;
      } finally {
        loading.value = false;
      }
      return;
    }

    loading.value = true;
    sharedInflight = loadPeopleModuleFieldsNetwork()
      .then((parsed) => {
        sharedCache = parsed;
        return parsed;
      })
      .finally(() => {
        sharedInflight = null;
      });

    try {
      const parsed = await sharedInflight;
      fields.value = parsed.fields;
    } catch {
      fields.value = sharedCache?.fields ?? [];
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    if (isEnabled()) fetchFields();
  });

  return {
    fields,
    loading,
    refetch: () => fetchFields(true),
  };
}
