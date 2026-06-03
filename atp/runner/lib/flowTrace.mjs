/**
 * Ordered execution trace per test case (API, UI, auth, load/perf phases).
 * @typedef {{ step: number, atMs: number, durationMs: number, kind: string, label: string, path?: string, method?: string, status?: number|string, detail?: unknown }} FlowTraceStep
 */

/**
 * @param {Record<string, unknown>} store
 * @param {string} caseId
 */
export function initFlowTrace(store, caseId) {
  store.flowTrace = [];
  store._traceCaseId = caseId;
  store._traceT0 = performance.now();
}

/**
 * @param {Record<string, unknown>} store
 * @param {Omit<FlowTraceStep, 'step'|'atMs'> & { durationMs: number }} step
 */
export function recordFlowStep(store, step) {
  if (!store.flowTrace) initFlowTrace(store, store._traceCaseId || '');
  const atMs = Math.round(performance.now() - (store._traceT0 || performance.now()));
  const entry = {
    step: store.flowTrace.length + 1,
    atMs,
    durationMs: step.durationMs ?? 0,
    kind: step.kind || 'step',
    label: step.label || step.kind,
    path: step.path,
    method: step.method,
    status: step.status,
    detail: step.detail,
  };
  store.flowTrace.push(entry);
  return entry;
}

function stepsFromLegacyTimings(store) {
  const steps = [];
  for (const t of store.apiTimings || []) {
    steps.push({
      step: steps.length + 1,
      atMs: 0,
      durationMs: t.latencyMs ?? 0,
      kind: 'api',
      label: t.label || `${t.method || 'GET'} ${t.path}`,
      path: t.path,
      method: t.method,
      status: t.status,
    });
  }
  for (const t of store.uiTimings || []) {
    steps.push({
      step: steps.length + 1,
      atMs: 0,
      durationMs: t.ms ?? 0,
      kind: 'ui',
      label: t.action || 'UI step',
      path: t.path,
    });
  }
  return steps;
}

/**
 * @param {Record<string, unknown>} store
 * @param {number} totalMs
 */
export function buildTraceFromStore(store, totalMs) {
  let steps = [...(store.flowTrace || [])];
  if (!steps.length) steps = stepsFromLegacyTimings(store);

  const sumStepMs = steps.reduce((n, s) => n + (s.durationMs || 0), 0);
  return {
    caseId: store._traceCaseId || null,
    totalMs,
    stepCount: steps.length,
    tracedMs: sumStepMs,
    steps,
  };
}
