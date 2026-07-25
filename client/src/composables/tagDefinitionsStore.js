import { reactive, ref } from 'vue';

/** Reactive tag definition lists keyed by localStorage key (shared across useRecordTags instances). */
const definitionsByStorageKey = reactive(Object.create(null));

/** Bumped on every write so chip-class lookups re-render even if a consumer missed a dependency. */
export const tagDefinitionsEpoch = ref(0);

function normalizeStorageKey(storageKey) {
  return String(storageKey || '');
}

export function getTagDefinitions(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!Object.prototype.hasOwnProperty.call(definitionsByStorageKey, key)) {
    definitionsByStorageKey[key] = [];
  }
  return definitionsByStorageKey[key];
}

export function setTagDefinitions(storageKey, next) {
  const key = normalizeStorageKey(storageKey);
  definitionsByStorageKey[key] = Array.isArray(next) ? next : [];
  tagDefinitionsEpoch.value += 1;
}
