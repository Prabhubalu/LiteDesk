/**
 * Lightweight load / performance harness (no k6 required).
 * Optional: add k6 scripts under atp/load/k6/ for heavy scenarios.
 */

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function summarizeLatencies(latenciesMs, statusCounts, wallSec = null) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const total = latenciesMs.length;
  const errors = Object.entries(statusCounts)
    .filter(([code]) => Number(code) >= 400 || Number(code) === 0)
    .reduce((n, [, c]) => n + c, 0);
  const durationSec = wallSec ?? (total > 0 ? 1 : 0.001);

  return {
    total,
    errors,
    errorRate: total ? errors / total : 0,
    rps: total / Math.max(durationSec, 0.001),
    minMs: sorted[0] ?? 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1] ?? 0,
    statusCounts,
  };
}

function envNum(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadThresholds(opts = {}) {
  if (opts.mutation) {
    return {
      maxErrorRate: envNum('ATP_LOAD_MUT_ERROR_RATE_MAX', 0.2),
      maxP95Ms: envNum('ATP_LOAD_MUT_P95_MS_MAX', 5000),
      minRps: 0,
    };
  }
  return {
    maxErrorRate: envNum('ATP_LOAD_ERROR_RATE_MAX', 0.05),
    maxP95Ms: envNum('ATP_LOAD_P95_MS_MAX', 3000),
    minRps: envNum('ATP_LOAD_MIN_RPS', 1),
  };
}

export function perfThresholds() {
  return {
    maxP95Ms: envNum('ATP_PERF_P95_MS_MAX', 800),
    maxP99Ms: envNum('ATP_PERF_P99_MS_MAX', 1500),
    maxErrorRate: envNum('ATP_PERF_ERROR_RATE_MAX', 0),
  };
}

export function loadProfile(generated = false, mutation = false) {
  if (mutation) {
    return {
      vus: envNum('ATP_LOAD_MUT_VUS', 2),
      durationSec: envNum('ATP_LOAD_MUT_DURATION_SEC', 5),
    };
  }
  return {
    vus: envNum('ATP_LOAD_VUS', 10),
    durationSec: generated
      ? envNum('ATP_LOAD_DURATION_LIGHT_SEC', 8)
      : envNum('ATP_LOAD_DURATION_SEC', 30),
  };
}

export function perfProfile() {
  return {
    samples: envNum('ATP_PERF_SAMPLES', 20),
    warmup: envNum('ATP_PERF_WARMUP', 2),
  };
}

/**
 * Sustained concurrent load for durationSec.
 * @param {object} opts
 * @param {number} opts.vus
 * @param {number} opts.durationSec
 * @param {(iteration: number) => Promise<{ status: number, ms: number }>} opts.request
 */
export async function runSustainedLoad({ vus, durationSec, request }) {
  const latenciesMs = [];
  const statusCounts = {};
  const endAt = Date.now() + durationSec * 1000;
  let iteration = 0;
  let stop = false;

  async function worker() {
    while (!stop && Date.now() < endAt) {
      const i = iteration++;
      try {
        const { status, ms } = await request(i);
        latenciesMs.push(ms);
        const code = status || 0;
        statusCounts[code] = (statusCounts[code] || 0) + 1;
      } catch {
        latenciesMs.push(0);
        statusCounts[0] = (statusCounts[0] || 0) + 1;
      }
    }
  }

  const wallStart = Date.now();
  await Promise.all(Array.from({ length: vus }, () => worker()));
  stop = true;
  const wallSec = (Date.now() - wallStart) / 1000;
  return summarizeLatencies(latenciesMs, statusCounts, wallSec);
}

/**
 * Sequential samples for latency percentiles (performance, not throughput).
 */
export async function runLatencySamples({ samples, warmup, request, onSample }) {
  const latenciesMs = [];
  const statusCounts = {};

  for (let i = 0; i < warmup + samples; i += 1) {
    try {
      const { status, ms } = await request(i);
      if (i >= warmup) {
        latenciesMs.push(ms);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        onSample?.({ index: i - warmup, status, ms });
      }
    } catch {
      if (i >= warmup) {
        latenciesMs.push(0);
        statusCounts[0] = (statusCounts[0] || 0) + 1;
        onSample?.({ index: i - warmup, status: 0, ms: 0 });
      }
    }
  }

  return summarizeLatencies(latenciesMs, statusCounts);
}

export function assertLoadMetrics(metrics, thresholds, label) {
  const failures = [];
  if (metrics.errorRate > thresholds.maxErrorRate) {
    failures.push(
      `${label}: error rate ${(metrics.errorRate * 100).toFixed(2)}% > max ${(thresholds.maxErrorRate * 100).toFixed(2)}%`
    );
  }
  if (metrics.p95Ms > thresholds.maxP95Ms) {
    failures.push(`${label}: p95 ${metrics.p95Ms}ms > max ${thresholds.maxP95Ms}ms`);
  }
  if (thresholds.minRps != null && metrics.rps < thresholds.minRps) {
    failures.push(`${label}: RPS ${metrics.rps.toFixed(2)} < min ${thresholds.minRps}`);
  }
  if (failures.length) {
    const err = new Error(failures.join('; '));
    err.metrics = metrics;
    throw err;
  }
}

export function assertPerfMetrics(metrics, thresholds, label) {
  const failures = [];
  if (metrics.errorRate > thresholds.maxErrorRate) {
    failures.push(`${label}: error rate ${(metrics.errorRate * 100).toFixed(2)}% > 0%`);
  }
  if (metrics.p95Ms > thresholds.maxP95Ms) {
    failures.push(`${label}: p95 ${metrics.p95Ms}ms > max ${thresholds.maxP95Ms}ms`);
  }
  if (metrics.p99Ms > thresholds.maxP99Ms) {
    failures.push(`${label}: p99 ${metrics.p99Ms}ms > max ${thresholds.maxP99Ms}ms`);
  }
  if (failures.length) {
    const err = new Error(failures.join('; '));
    err.metrics = metrics;
    throw err;
  }
}

export async function timedRequest(fn) {
  const start = performance.now();
  const res = await fn();
  const ms = Math.round(performance.now() - start);
  return { status: res.status, ms, res };
}
