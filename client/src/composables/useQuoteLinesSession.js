import { computed, ref, unref } from 'vue';

const sessions = new Map();

function getOrCreateSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { busy: ref(false), overrideLock: ref(false) });
  }
  return sessions.get(id);
}

export function useQuoteLinesSession(quoteIdSource) {
  function session() {
    return getOrCreateSession(String(unref(quoteIdSource) || ''));
  }

  const busy = computed({
    get: () => session().busy.value,
    set: (value) => { session().busy.value = value; }
  });

  const overrideLock = computed({
    get: () => session().overrideLock.value,
    set: (value) => { session().overrideLock.value = value; }
  });

  return { busy, overrideLock };
}

export function clearQuoteLinesSession(quoteId) {
  const id = String(quoteId || '');
  if (id) sessions.delete(id);
}
