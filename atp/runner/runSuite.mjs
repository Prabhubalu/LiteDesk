import { getConfig } from '../shared/config.mjs';
import { loadCatalog, loadSuites, resolveSuiteCases, SEQUENTIAL_SUITES } from '../shared/config.mjs';
import { runCase, resetRunState } from './engine.mjs';
import { assertSutReady } from './lib/sutHealth.mjs';
import { isQuarantined } from './lib/quarantine.mjs';

function getConcurrency() {
  const n = Number(process.env.ATP_API_CONCURRENCY || 4);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : 4;
}

async function patchRun(config, runId, payload, method = 'PATCH') {
  try {
    const res = await fetch(`${config.controlPlaneUrl}/atp/runs/${runId}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-ATP-API-Key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function createRun(config, body) {
  try {
    const res = await fetch(`${config.controlPlaneUrl}/atp/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ATP-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function runPool(cases, options, onResult) {
  const concurrency = options.parallel ? getConcurrency() : 1;
  const sharedStore = options.sharedStore || {};
  let index = 0;

  async function worker() {
    while (index < cases.length) {
      const i = index++;
      const entry = cases[i];
      const result = await runCase(entry.id, {
        envKey: options.envKey,
        dryRun: options.dryRun,
        sharedStore: options.sequential ? sharedStore : {},
      });
      const enriched = {
        ...result,
        title: entry.title,
        layer: entry.layer,
        documentation: entry.documentation || null,
        startedAt: new Date(),
        finishedAt: new Date(),
      };
      await onResult(enriched, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, () => worker()));
}

/**
 * @param {object} options
 * @param {string} options.runId
 * @param {string} options.suiteKey
 * @param {string} options.envKey
 * @param {boolean} options.dryRun
 * @param {boolean} [options.parallel=true]
 * @param {boolean} [options.sequential=false] — share ctx.store across cases (sales flows)
 * @param {string} [options.triggeredBy]
 * @param {(line: string) => void} [options.log]
 */
export async function executeSuite(options) {
  const config = getConfig();
  const catalog = loadCatalog();
  const suites = loadSuites();
  let cases = resolveSuiteCases(options.suiteKey, catalog);
  const quarantined = cases.filter((c) => isQuarantined(c.id));
  if (quarantined.length) {
    cases = cases.filter((c) => !isQuarantined(c.id));
  }
  const suiteName = suites[options.suiteKey]?.name || options.suiteKey;
  const log = options.log || console.log;

  await resetRunState();

  if (!options.dryRun) {
    const health = await assertSutReady();
    if (!health.ok) {
      throw new Error(`SUT health gate failed: ${health.reason}`);
    }
  }

  if (quarantined.length) {
    log(`[ATP] Quarantined ${quarantined.length} case(s) excluded`);
  }

  const results = cases.map((c) => ({
    caseId: c.id,
    title: c.title,
    layer: c.layer,
    documentation: c.documentation || null,
    status: 'pending',
  }));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  await createRun(config, {
    runId: options.runId,
    suiteKey: options.suiteKey,
    envKey: options.envKey,
    dryRun: options.dryRun,
    triggeredBy: options.triggeredBy || 'cli',
    status: options.dryRun ? 'passed' : 'running',
    stats: { total: cases.length, passed: 0, failed: 0, skipped: 0, pending: cases.length },
    results,
  });

  if (options.dryRun) {
    const { listAutomatedCaseIds } = await import('./registry.mjs');
    const automated = new Set(await listAutomatedCaseIds());
    for (let i = 0; i < cases.length; i++) {
      const entry = cases[i];
      const hasExec = automated.has(entry.id);
      log(`  ${entry.id} … ${hasExec ? 'would run' : 'skip (no executor)'}`);
      skipped += 1;
      results[i] = {
        caseId: entry.id,
        title: entry.title,
        layer: entry.layer,
        status: 'skipped',
        durationMs: 0,
      };
    }
  } else {
    const sequential = options.sequential || SEQUENTIAL_SUITES.includes(options.suiteKey);

    await runPool(
      cases,
      {
        envKey: options.envKey,
        dryRun: false,
        parallel: !sequential && options.parallel !== false,
        sequential,
        sharedStore: {},
      },
      async (result, i) => {
        results[i] = result;
        if (result.status === 'passed') passed += 1;
        else if (result.status === 'failed') failed += 1;
        else skipped += 1;

        const color = result.status === 'passed' ? '\x1b[32m' : result.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
        log(`  ${result.caseId} … ${color}${result.status}\x1b[0m${result.durationMs ? ` (${result.durationMs}ms)` : ''}${result.error?.message ? ` — ${result.error.message}` : ''}`);

        await patchRun(config, options.runId, {
          status: 'running',
          stats: {
            total: cases.length,
            passed,
            failed,
            skipped,
            pending: cases.length - passed - failed - skipped,
          },
          results,
        });
      }
    );
  }

  const status = failed > 0 ? 'failed' : skipped === cases.length ? 'partial' : 'passed';
  const stats = { total: cases.length, passed, failed, skipped, pending: 0 };

  await patchRun(config, options.runId, {
    status,
    stats,
    results,
    finishedAt: new Date().toISOString(),
  });

  return { runId: options.runId, suiteKey: options.suiteKey, suiteName, status, stats, results };
}
