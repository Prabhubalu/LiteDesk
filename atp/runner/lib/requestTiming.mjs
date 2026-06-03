import { recordFlowStep } from './flowTrace.mjs';

/**
 * Records per-request latency on ctx.store (surfaced in run results).
 * @param {Record<string, unknown>} store
 * @param {{ method?: string, path: string, status: number, latencyMs: number }} meta
 */
export function recordApiTiming(store, meta) {
  if (store._traceSuppressApi) return;
  const method = (meta.method || 'GET').toUpperCase();
  const entry = {
    kind: 'api',
    label: 'API request',
    method,
    path: meta.path,
    status: meta.status,
    latencyMs: meta.latencyMs,
  };
  if (!store.apiTimings) store.apiTimings = [];
  store.apiTimings.push(entry);
  store.apiTiming = entry;
  recordFlowStep(store, {
    kind: 'api',
    label: `${method} ${meta.path}`,
    path: meta.path,
    method,
    status: meta.status,
    durationMs: meta.latencyMs,
  });
}

export function recordUiTiming(store, { path, action, ms }) {
  const entry = { path, action: action || 'UI', ms };
  if (!store.uiTimings) store.uiTimings = [];
  store.uiTimings.push(entry);
  store.apiTiming = { kind: 'ui', path, latencyMs: ms, label: entry.action };
  recordFlowStep(store, {
    kind: 'ui',
    label: action || 'UI step',
    path,
    durationMs: ms,
  });
}

export function wrapTimedFetch(fetchFn, store) {
  return async (apiPath, init = {}) => {
    const start = performance.now();
    const res = await fetchFn(apiPath, init);
    recordApiTiming(store, {
      method: init.method || 'GET',
      path: apiPath,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
    });
    return res;
  };
}
