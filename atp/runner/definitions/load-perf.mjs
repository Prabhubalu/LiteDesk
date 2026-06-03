import { defineCase } from '../lib/httpAssert.mjs';
import { getPersonaCredentials } from '../lib/authSession.mjs';
import { resolvePlaceholderPath } from '../lib/placeholderPaths.mjs';
import { recordFlowStep } from '../lib/flowTrace.mjs';
import {
  runSustainedLoad,
  runLatencySamples,
  assertLoadMetrics,
  assertPerfMetrics,
  loadProfile,
  perfProfile,
  loadThresholds,
  perfThresholds,
  timedRequest,
} from '../lib/loadTest.mjs';
import { getAllLoadScenarios, getPerfScenarios } from './load-perf-scenarios.mjs';

function skipLoad() {
  if (process.env.ATP_SKIP_LOAD_TESTS === '1') {
    return 'Set ATP_SKIP_LOAD_TESTS=0 or unset to run load/perf suites';
  }
  return null;
}

function loadDoc(summary, path, thresholds, method = 'GET') {
  return {
    summary,
    howToRun: [
      `Concurrent VUs × duration (ATP_LOAD_VUS, ATP_LOAD_DURATION_SEC).`,
      `${method} \`${path}\` under sustained concurrency.`,
    ],
    request: { method: 'LOAD', path, auth: path.includes('/health') ? 'None' : 'Bearer (owner)', body: null },
    expected: {
      status: 'metrics',
      behavior: `p95 ≤ ${thresholds.maxP95Ms}ms, error rate ≤ ${(thresholds.maxErrorRate * 100).toFixed(0)}%`,
    },
    onFailure: {
      whatToFix: ['Throughput or latency exceeded load thresholds.'],
      howToFix: [
        'Lower ATP_LOAD_VUS on local dev.',
        'Check DB pool, Redis, CPU during the run.',
      ],
    },
  };
}

function perfDoc(summary, path, thresholds, method = 'GET') {
  return {
    summary,
    howToRun: [
      `Sequential samples (ATP_PERF_SAMPLES=${process.env.ATP_PERF_SAMPLES || '20'}).`,
      `${method} \`${path}\` — measures p50/p95/p99.`,
    ],
    request: { method: 'PERF', path, auth: path.includes('/health') ? 'None' : 'Bearer (owner)', body: null },
    expected: {
      status: 'metrics',
      behavior: `p95 ≤ ${thresholds.maxP95Ms}ms, p99 ≤ ${thresholds.maxP99Ms}ms`,
    },
    onFailure: {
      whatToFix: ['Single-user latency SLA breached.'],
      howToFix: ['Profile slow queries on this route.', 'Tune ATP_PERF_P95_MS_MAX after baseline.'],
    },
  };
}

function requireOwner() {
  if (!getPersonaCredentials('owner')) {
    const err = new Error('Configure owner persona in fixtures/personas.json');
    err.skip = true;
    throw err;
  }
}

async function resolveScenarioPath(scenario, ctx) {
  if (scenario.placeholder) {
    return resolvePlaceholderPath(scenario.path, ctx);
  }
  return scenario.path;
}

async function executeRequest(ctx, scenario, resolvedPath) {
  const method = (scenario.method || 'GET').toUpperCase();
  const init = { method };
  if (method !== 'GET' && method !== 'HEAD' && scenario.body != null) {
    init.body = JSON.stringify(scenario.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const fn = () =>
    scenario.auth
      ? ctx.authFetch('owner', resolvedPath, init)
      : ctx.fetchSut(resolvedPath, init);
  return timedRequest(fn);
}

function buildLoadCase(scenario) {
  const caseId = `TC-LOAD-${scenario.id}`;
  const mutation = Boolean(scenario.mutation);
  return defineCase(
    caseId,
    async (ctx) => {
      const skip = skipLoad();
      if (skip) {
        const err = new Error(skip);
        err.skip = true;
        throw err;
      }
      if (scenario.auth) requireOwner();

      if (scenario.placeholder) {
        recordFlowStep(ctx.store, { kind: 'setup', label: 'Resolve placeholder path', durationMs: 0 });
      }
      const resolveStart = performance.now();
      const resolvedPath = await resolveScenarioPath(scenario, ctx);
      recordFlowStep(ctx.store, {
        kind: 'setup',
        label: 'Path resolved',
        path: resolvedPath,
        durationMs: Math.round(performance.now() - resolveStart),
      });
      const { vus, durationSec } = loadProfile(scenario.generated, mutation);
      const thresholds = loadThresholds({ mutation });
      const effectiveVus = scenario.capVus ? Math.min(vus, scenario.capVus) : vus;

      ctx.store._traceSuppressApi = true;
      const metrics = await runSustainedLoad({
        vus: effectiveVus,
        durationSec,
        request: async () => {
          const { status, ms } = await executeRequest(ctx, scenario, resolvedPath);
          return { status, ms };
        },
      });
      ctx.store._traceSuppressApi = false;

      metrics.wallDurationSec = durationSec;
      metrics.vus = effectiveVus;
      metrics.label = scenario.label;
      metrics.kind = 'load';
      metrics.path = resolvedPath;
      metrics.method = scenario.method || 'GET';

      recordFlowStep(ctx.store, {
        kind: 'load',
        label: `Sustained load (${effectiveVus} VUs × ${durationSec}s)`,
        path: resolvedPath,
        method: scenario.method || 'GET',
        durationMs: Math.round(durationSec * 1000),
        detail: { rps: metrics.rps, p95Ms: metrics.p95Ms, errorRate: metrics.errorRate, total: metrics.total },
      });
      assertLoadMetrics(metrics, thresholds, scenario.label);
      ctx.store.loadMetrics = metrics;
    },
    {
      documentation: loadDoc(
        `Load — ${scenario.label}`,
        scenario.path,
        loadThresholds({ mutation }),
        scenario.method || 'GET'
      ),
    }
  );
}

function buildPerfCase(scenario) {
  const caseId = `TC-PERF-${scenario.id}`;
  return defineCase(
    caseId,
    async (ctx) => {
      const skip = skipLoad();
      if (skip) {
        const err = new Error(skip);
        err.skip = true;
        throw err;
      }
      if (scenario.auth) requireOwner();

      const resolveStart = performance.now();
      const resolvedPath = await resolveScenarioPath(scenario, ctx);
      recordFlowStep(ctx.store, {
        kind: 'setup',
        label: 'Path resolved',
        path: resolvedPath,
        durationMs: Math.round(performance.now() - resolveStart),
      });
      const { samples, warmup } = perfProfile();
      const thresholds = perfThresholds();
      const sampleCount = scenario.placeholder ? Math.min(samples, 8) : samples;

      ctx.store._traceSuppressApi = true;
      const metrics = await runLatencySamples({
        samples: sampleCount,
        warmup,
        request: async () => {
          const { status, ms } = await executeRequest(ctx, scenario, resolvedPath);
          return { status, ms };
        },
        onSample: ({ index, status, ms }) => {
          recordFlowStep(ctx.store, {
            kind: 'perf',
            label: `Sample ${index + 1}/${sampleCount}`,
            path: resolvedPath,
            method: scenario.method || 'GET',
            status,
            durationMs: ms,
          });
        },
      });
      ctx.store._traceSuppressApi = false;

      metrics.samples = samples;
      metrics.warmup = warmup;
      metrics.label = scenario.label;
      metrics.kind = 'perf';
      metrics.path = resolvedPath;
      metrics.method = scenario.method || 'GET';

      assertPerfMetrics(metrics, thresholds, scenario.label);
      ctx.store.perfMetrics = metrics;
    },
    {
      documentation: perfDoc(
        `Perf — ${scenario.label}`,
        scenario.path,
        perfThresholds(),
        scenario.method || 'GET'
      ),
    }
  );
}

export const loadPerfCases = [
  ...getAllLoadScenarios().map(buildLoadCase),
  ...getPerfScenarios().map(buildPerfCase),
];
