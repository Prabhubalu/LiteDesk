/**
 * Release gate: smoke 100%, e2e-critical ≥95%, no failures on gate suites.
 */

const GATE_SUITES = [
  { key: 'smoke', label: 'Smoke', minPassPct: 100, allowSkipped: true },
  { key: 'e2e-critical', label: 'E2E Critical', minPassPct: 95, allowSkipped: true },
  { key: 'perf-api', label: 'Perf API (core)', minPassPct: 90, allowSkipped: true, optionalEnv: 'ATP_GO_NOGO_PERF' },
];

function passPct(run) {
  const { total = 0, passed = 0, failed = 0, skipped = 0 } = run.stats || {};
  const denom = total - skipped;
  if (denom <= 0) return total === 0 ? 100 : 0;
  return Math.round((passed / denom) * 100);
}

function suiteGateResult(run, rule) {
  if (!run) {
    return { suiteKey: rule.key, label: rule.label, status: 'missing', passPct: 0, message: 'No completed run found' };
  }
  const pct = passPct(run);
  const failed = run.stats?.failed ?? 0;
  const ok = failed === 0 && pct >= rule.minPassPct;
  return {
    suiteKey: rule.key,
    label: rule.label,
    status: ok ? 'pass' : 'fail',
    passPct: pct,
    runId: run.runId,
    finishedAt: run.finishedAt,
    stats: run.stats,
    message: ok
      ? `${pct}% pass`
      : failed > 0
        ? `${failed} failure(s), ${pct}% pass`
        : `${pct}% pass (need ≥${rule.minPassPct}%)`,
  };
}

/**
 * @param {import('mongoose').Model} TestRun
 */
export async function evaluateGoNoGo(TestRun) {
  const checks = [];
  let overall = 'go';

  for (const rule of GATE_SUITES) {
    if (rule.optionalEnv && process.env[rule.optionalEnv] !== '1') {
      checks.push({
        suiteKey: rule.key,
        label: rule.label,
        status: 'skipped',
        passPct: 0,
        message: `Enable ${rule.optionalEnv}=1 to gate`,
      });
      continue;
    }
    const run = await TestRun.findOne({
      suiteKey: rule.key,
      status: { $in: ['passed', 'failed', 'partial'] },
      dryRun: false,
    })
      .sort({ finishedAt: -1, createdAt: -1 })
      .lean();

    const result = suiteGateResult(run, rule);
    checks.push(result);
    if (result.status === 'fail') overall = 'no-go';
  }

  const failedRuns = await TestRun.find({
    suiteKey: { $in: GATE_SUITES.map((g) => g.key) },
    status: { $in: ['failed', 'partial'] },
    'stats.failed': { $gt: 0 },
    finishedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  })
    .sort({ finishedAt: -1 })
    .limit(3)
    .lean();

  const recentFailures = failedRuns.flatMap((r) =>
    (r.results || [])
      .filter((c) => c.status === 'failed')
      .map((c) => ({ runId: r.runId, suiteKey: r.suiteKey, caseId: c.caseId, message: c.error?.message }))
  );

  return {
    status: overall,
    evaluatedAt: new Date().toISOString(),
    checks,
    recentFailures: recentFailures.slice(0, 10),
    rules: GATE_SUITES.map((g) => ({ suiteKey: g.key, minPassPct: g.minPassPct })),
  };
}
