import { summarizeLatencies } from './loadTest.mjs';

/**
 * @param {Record<string, unknown>} store
 * @returns {object | null}
 */
export function buildMetricsFromStore(store) {
  if (store.loadMetrics) return store.loadMetrics;
  if (store.perfMetrics) return store.perfMetrics;
  if (store.uiTimings?.length) {
    const last = store.uiTimings[store.uiTimings.length - 1];
    const latencies = store.uiTimings.map((t) => t.ms);
    const summary = summarizeLatencies(latencies, { 200: latencies.length });
    return {
      kind: 'ui',
      label: last.action || 'UI step',
      path: last.path,
      latencyMs: last.ms,
      requests: store.uiTimings,
      ...summary,
    };
  }
  if (store.apiTimings?.length) {
    const latencies = store.apiTimings.map((t) => t.latencyMs);
    const statusCounts = store.apiTimings.reduce((acc, t) => {
      const code = t.status ?? 0;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {});
    const summary = summarizeLatencies(latencies, statusCounts);
    const last = store.apiTimings[store.apiTimings.length - 1];
    return {
      kind: 'api',
      label: 'API requests',
      method: last.method,
      path: last.path,
      status: last.status,
      latencyMs: last.latencyMs,
      requests: store.apiTimings,
      ...summary,
    };
  }
  return store.apiTiming || null;
}
