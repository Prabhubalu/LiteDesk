import { ref, onMounted } from 'vue';

const STORAGE_KEY = 'arivu:frequent-modules';
const MAX_ITEMS = 6;

export type FrequentModuleEntry = {
  commandId: string;
  visitedAt: number;
};

function readStorage(): FrequentModuleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FrequentModuleEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: FrequentModuleEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

export function useFrequentModules() {
  const frequentModuleIds = ref<string[]>([]);

  const load = () => {
    frequentModuleIds.value = readStorage()
      .filter((e) => e && typeof e.commandId === 'string' && e.commandId.length > 0)
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, MAX_ITEMS)
      .map((e) => e.commandId);
  };

  const persist = (entries: FrequentModuleEntry[]) => {
    const trimmed = entries
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, MAX_ITEMS);
    frequentModuleIds.value = trimmed.map((e) => e.commandId);
    writeStorage(trimmed);
  };

  const recordFrequentModule = (commandId: string) => {
    if (!commandId) return;
    const withoutDup = readStorage().filter((e) => e.commandId !== commandId);
    persist([{ commandId, visitedAt: Date.now() }, ...withoutDup]);
  };

  const clearFrequentModules = () => {
    persist([]);
  };

  onMounted(load);

  return {
    frequentModuleIds,
    recordFrequentModule,
    clearFrequentModules,
    reloadFrequentModules: load
  };
}
