import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'arivu:recent-searches';
const MAX_ITEMS = 8;

export type RecentSearchEntry = {
  id: string;
  kind: 'record';
  label: string;
  subtitle?: string;
  route: string;
  type?: string;
  moduleKey?: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  visitedAt: number;
};

export type RecentSearchInput = Omit<RecentSearchEntry, 'id' | 'visitedAt'> & { id?: string };

function readStorage(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RecentSearchEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentSearchEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

export function useRecentSearches() {
  const recentSearches = ref<RecentSearchEntry[]>([]);

  const load = () => {
    recentSearches.value = readStorage()
      .filter(
        (e) =>
          e &&
          typeof e.label === 'string' &&
          (e.kind === 'record' || (!e.kind && e.route)) &&
          typeof e.route === 'string' &&
          e.route.length > 0
      )
      .map((e) => ({ ...e, kind: 'record' as const }))
      .slice(0, MAX_ITEMS);
  };

  const persist = (entries: RecentSearchEntry[]) => {
    const trimmed = entries.slice(0, MAX_ITEMS);
    recentSearches.value = trimmed;
    writeStorage(trimmed);
  };

  const addRecentSearch = (entry: RecentSearchInput) => {
    if (!entry.route) return;

    const id = entry.id || `record:${entry.route}`;

    const next: RecentSearchEntry = {
      id,
      kind: 'record',
      label: entry.label,
      subtitle: entry.subtitle,
      route: entry.route,
      type: entry.type,
      moduleKey: entry.moduleKey,
      avatar: entry.avatar,
      first_name: entry.first_name,
      last_name: entry.last_name,
      visitedAt: Date.now()
    };

    const withoutDup = recentSearches.value.filter((e) => e.id !== id);
    persist([next, ...withoutDup]);
  };

  const removeRecentSearch = (id: string) => {
    persist(recentSearches.value.filter((e) => e.id !== id));
  };

  const clearRecentSearches = () => {
    persist([]);
  };

  onMounted(load);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    reloadRecentSearches: load
  };
}
