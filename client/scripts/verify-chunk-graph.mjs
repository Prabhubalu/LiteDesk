#!/usr/bin/env node
/**
 * Pre-deploy check: detect circular chunk deps that cause production TDZ
 * ("Cannot access 'ua' before initialization" = _export_sfc from wrong chunk).
 */
import fs from 'node:fs';
import path from 'node:path';

const distAssets = path.join(process.cwd(), 'dist/assets');
if (!fs.existsSync(distAssets)) {
  console.error('FAIL: dist/assets missing — run npm run build first');
  process.exit(1);
}

const jsFiles = fs.readdirSync(distAssets).filter((f) => f.endsWith('.js') && !f.endsWith('.map'));
const importRe = /from"\.\/([^"]+\.js)"/g;

/** @type {Map<string, Set<string>>} */
const graph = new Map();

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(distAssets, file), 'utf8');
  const deps = new Set();
  let m;
  while ((m = importRe.exec(content)) !== null) {
    deps.add(m[1]);
  }
  graph.set(file, deps);
}

function findCycles() {
  const cycles = [];
  const visited = new Set();
  const stack = [];

  function dfs(node) {
    if (stack.includes(node)) {
      const i = stack.indexOf(node);
      cycles.push([...stack.slice(i), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      if (graph.has(dep)) dfs(dep);
    }
    stack.pop();
  }

  for (const node of graph.keys()) dfs(node);
  return cycles;
}

const cycles = findCycles();
const relevant = cycles.filter((c) =>
  c.some((f) => f.startsWith('chunk-settings') || f.startsWith('record-activity'))
);

const recordActivity = jsFiles.find((f) => f.startsWith('record-activity'));
const chunkSettings = jsFiles.find((f) => f.startsWith('chunk-settings'));

const raContent = recordActivity ? fs.readFileSync(path.join(distAssets, recordActivity), 'utf8') : '';
const csContent = chunkSettings ? fs.readFileSync(path.join(distAssets, chunkSettings), 'utf8') : '';

const checks = [];

function pass(name, detail = '') {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail = '') {
  checks.push({ ok: false, name, detail });
}

const raImportsCs = recordActivity && (graph.get(recordActivity)?.has(chunkSettings) ?? false);
const csImportsRa = chunkSettings && (graph.get(chunkSettings)?.has(recordActivity) ?? false);
const raUaFromCs = /e as ua[^}]*from"\.\/chunk-settings/.test(raContent);
const csHasTaskDescriptionEditor = csContent.includes('TaskDescriptionEditor');
const csHasAsyncEditorImport =
  csContent.includes('import(') &&
  (csContent.includes('TaskDescriptionEditor') || csContent.includes('record-activity'));

// Critical: the original bug — _export_sfc imported from chunk-settings inside record-activity
if (!raUaFromCs) {
  pass('record-activity does not import _export_sfc (ua) from chunk-settings');
} else {
  fail('record-activity imports ua from chunk-settings', 'ROOT CAUSE of TDZ error');
}

// Critical: no static settings → record-activity edge
if (!csImportsRa) {
  pass('chunk-settings does not statically import record-activity');
} else {
  fail('chunk-settings statically imports record-activity', 'circular chunk init');
}

// Helpdesk drawer should lazy-load editors
if (csContent.includes('HelpdeskCannedResponseDrawer')) {
  if (csHasAsyncEditorImport && !csImportsRa) {
    pass('HelpdeskCannedResponseDrawer uses async editor import');
  } else if (csHasTaskDescriptionEditor && csImportsRa) {
    fail('HelpdeskCannedResponseDrawer statically bundles record-activity');
  } else {
    pass('HelpdeskCannedResponseDrawer present in chunk-settings');
  }
}

// TaskDescriptionEditor should live in record-activity, not chunk-settings
if (raContent.includes('TaskDescriptionEditor') && !csHasTaskDescriptionEditor) {
  pass('TaskDescriptionEditor bundled in record-activity only');
} else if (csHasTaskDescriptionEditor && csImportsRa) {
  fail('TaskDescriptionEditor statically duplicated in chunk-settings');
} else {
  pass('TaskDescriptionEditor chunk placement');
}

// No cycles between the two main chunks
if (relevant.length === 0) {
  pass('no chunk cycles between chunk-settings and record-activity');
} else {
  fail('chunk cycles detected', relevant.map((c) => c.join(' → ')).join('; '));
}

// Mutual import is the worst case
if (raImportsCs && csImportsRa) {
  fail('mutual static import record-activity ↔ chunk-settings');
} else if (raImportsCs && !csImportsRa) {
  pass('one-way import only (record-activity → chunk-settings)');
}

console.log('\n=== Pre-deploy chunk graph verification ===\n');
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length === 0 ? 'All checks passed — safe to deploy.' : `${failed.length} check(s) FAILED — do not deploy yet.`}\n`);

if (failed.length > 0) process.exit(1);
