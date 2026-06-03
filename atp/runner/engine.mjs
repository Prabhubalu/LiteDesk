import { createContext } from './context.mjs';
import { resolveExecutor } from './registry.mjs';
import { clearPersonaCache } from './lib/authSession.mjs';
import { closeBrowser } from './lib/uiSession.mjs';
import { buildMetricsFromStore } from './lib/metricsFromStore.mjs';
import { bindUiStore } from './lib/uiRunner.mjs';
import { initFlowTrace, buildTraceFromStore, recordFlowStep } from './lib/flowTrace.mjs';

export async function runCase(caseId, options = {}) {
  const resolved = await resolveExecutor(caseId);
  if (!resolved) {
    return {
      caseId,
      status: 'skipped',
      durationMs: 0,
      error: { message: 'No executor implemented' },
    };
  }

  if (options.dryRun) {
    return { caseId, status: 'skipped', durationMs: 0, error: null, dryRun: true };
  }

  const ctx = createContext({
    caseId,
    envKey: options.envKey || 'local',
    dryRun: false,
  });

  if (options.sharedStore) {
    ctx.store = options.sharedStore;
  }
  initFlowTrace(ctx.store, caseId);
  recordFlowStep(ctx.store, {
    kind: 'case',
    label: `Start ${caseId}`,
    durationMs: 0,
  });

  const started = Date.now();
  const maxAttempts =
    process.env.ATP_RETRY_ON_FAIL === '1' && !caseId.startsWith('TC-SEC-') ? 2 : 1;

  const runFn = resolved.mod.run || resolved.mod.default?.run;
  if (typeof runFn !== 'function') {
    throw new Error(`Executor missing run() for ${caseId}`);
  }

  let lastErr = null;
  const isUiCase = /^TC-(?:UI|E2E)-/.test(caseId);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (isUiCase) bindUiStore(ctx.store);
      await runFn(ctx);
      bindUiStore(null);
      const durationMs = Date.now() - started;
      const metrics = buildMetricsFromStore(ctx.store);
      const trace = buildTraceFromStore(ctx.store, durationMs);
      return {
        caseId,
        status: 'passed',
        durationMs,
        error: null,
        metrics,
        trace,
        attempts: attempt,
      };
    } catch (err) {
      bindUiStore(null);
      lastErr = err;
      if (err.skip || attempt >= maxAttempts) break;
    }
  }
  bindUiStore(null);

  const err = lastErr || new Error('Case failed with no error');
  if (err.skip) {
      return {
        caseId,
        status: 'skipped',
        durationMs: Date.now() - started,
        error: { message: err.message },
      };
    }
    const durationMs = Date.now() - started;
    return {
      caseId,
      status: 'failed',
      durationMs,
      error: {
        message: err.message,
        stack: err.stack,
        request: err.request || null,
        response: err.response || null,
        metrics: err.metrics || null,
        artifactPath: err.artifactPath || null,
      },
      metrics: err.metrics || buildMetricsFromStore(ctx.store) || null,
      trace: buildTraceFromStore(ctx.store, durationMs),
    };
}

export async function resetRunState() {
  clearPersonaCache();
  await closeBrowser();
}
