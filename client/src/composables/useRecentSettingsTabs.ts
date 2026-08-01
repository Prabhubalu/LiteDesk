import { computed, ref } from 'vue';

const STORAGE_KEY = 'arivu-settings-recent-tabs';
const MAX_RECENT = 5;

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota / private mode
  }
}

const recentIds = ref<string[]>(readIds());

/**
 * Persist recently visited settings tabs for the overview Recent lane.
 */
export function useRecentSettingsTabs() {
  const ids = computed(() => recentIds.value);

  function record(tabId: string | null | undefined): void {
    if (!tabId || tabId === 'landing') return;
    const next = [tabId, ...recentIds.value.filter((id) => id !== tabId)].slice(0, MAX_RECENT);
    recentIds.value = next;
    writeIds(next);
  }

  return { recentIds: ids, record };
}
