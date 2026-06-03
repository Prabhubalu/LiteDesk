#!/usr/bin/env node
import { v4 as uuidv4 } from 'uuid';
import { getConfig, loadCatalog, loadSuites, resolveSuiteCases, SEQUENTIAL_SUITES } from '../shared/config.mjs';
import { executeSuite } from './runSuite.mjs';
import { listAutomatedCaseIds } from './registry.mjs';

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? true;
}

function hasFlag(name) {
  return args.includes(name);
}

async function cmdCatalogSync() {
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const atpRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const check = hasFlag('--check');
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['catalog/sync.mjs', ...(check ? ['--check'] : [])], {
      stdio: 'inherit',
      cwd: atpRoot,
    });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sync exit ${code}`))));
  });
}

async function cmdRun() {
  const suiteKey = getFlag('--suite', 'smoke');
  const envKey = getFlag('--env', 'local');
  const dryRun = hasFlag('--dry-run');
  const config = getConfig();
  const catalog = loadCatalog();
  const cases = resolveSuiteCases(suiteKey, catalog);
  const runId = uuidv4();
  const suites = loadSuites();
  const suiteName = suites[suiteKey]?.name || suiteKey;

  console.log(`\n[ATP] Run ${runId.slice(0, 8)} · suite=${suiteKey} · env=${envKey}${dryRun ? ' · DRY RUN' : ''}`);
  console.log(`[ATP] SUT: ${config.sutApiUrl}`);
  console.log(`[ATP] Cases: ${cases.length}\n`);

  const result = await executeSuite({
    runId,
    suiteKey,
    envKey,
    dryRun,
    triggeredBy: 'cli',
    parallel: !SEQUENTIAL_SUITES.includes(suiteKey),
    sequential: SEQUENTIAL_SUITES.includes(suiteKey),
    log: (line) => console.log(line),
  });

  console.log(`\n[ATP] Done: ${result.stats.passed} passed, ${result.stats.failed} failed, ${result.stats.skipped} skipped`);

  if (result.status === 'failed') process.exit(1);
}

async function cmdListSuites() {
  const suites = loadSuites();
  const automated = new Set(await listAutomatedCaseIds());
  for (const [key, suite] of Object.entries(suites)) {
    console.log(`${key}\t${suite.name}`);
  }
  console.log(`\nAutomated cases: ${automated.size}`);
}

async function main() {
  if (command === 'catalog' && args[1] === 'sync') {
    await cmdCatalogSync();
    return;
  }
  if (command === 'run') {
    await cmdRun();
    return;
  }
  if (command === 'suites') {
    await cmdListSuites();
    return;
  }

  console.log(`Arivu Test Platform CLI

Usage:
  node runner/cli.mjs catalog sync [--check]
  node runner/cli.mjs run --suite smoke [--env local] [--dry-run]
  node runner/cli.mjs suites
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
