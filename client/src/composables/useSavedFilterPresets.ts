import { ref, computed } from 'vue';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import { createDefaultRootGroup } from '@/platform/filters/filterQueryAst';

export interface SavedFilterPreset {
  id: string;
  name: string;
  createdAt: number;
  filters: Record<string, unknown>;
  operators: Record<string, FilterOperatorId>;
  query: FilterGroupNode;
}

const STORAGE_PREFIX = 'arivu-saved-filter-presets';

function storageKey(moduleKey: string, userId: string): string {
  return `${STORAGE_PREFIX}-${moduleKey}-${userId}`;
}

function readPresets(moduleKey: string, userId: string): SavedFilterPreset[] {
  if (!moduleKey || !userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(moduleKey, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(moduleKey: string, userId: string, presets: SavedFilterPreset[]) {
  localStorage.setItem(storageKey(moduleKey, userId), JSON.stringify(presets));
}

export function useSavedFilterPresets(moduleKey: string, userId: string) {
  const presets = ref<SavedFilterPreset[]>(readPresets(moduleKey, userId));

  const sortedPresets = computed(() =>
    [...presets.value].sort((a, b) => b.createdAt - a.createdAt)
  );

  function refresh() {
    presets.value = readPresets(moduleKey, userId);
  }

  function savePreset(
    name: string,
    payload: {
      filters: Record<string, unknown>;
      operators: Record<string, FilterOperatorId>;
      query: FilterGroupNode;
    }
  ): SavedFilterPreset {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Preset name required');

    const preset: SavedFilterPreset = {
      id: `sfp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: trimmed,
      createdAt: Date.now(),
      filters: { ...payload.filters },
      operators: { ...payload.operators },
      query: JSON.parse(JSON.stringify(payload.query)),
    };

    const next = [preset, ...presets.value.filter((p) => p.name !== trimmed)];
    presets.value = next;
    writePresets(moduleKey, userId, next);
    return preset;
  }

  function deletePreset(id: string) {
    const next = presets.value.filter((p) => p.id !== id);
    presets.value = next;
    writePresets(moduleKey, userId, next);
  }

  function getPreset(id: string): SavedFilterPreset | null {
    return presets.value.find((p) => p.id === id) ?? null;
  }

  function defaultQuery(): FilterGroupNode {
    return createDefaultRootGroup();
  }

  return {
    presets: sortedPresets,
    refresh,
    savePreset,
    deletePreset,
    getPreset,
    defaultQuery,
  };
}
