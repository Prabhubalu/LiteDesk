#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLIENT_ROOT } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'auto-migrate-vue.mjs');

const SKIP =
  /(?:HelloWorld|WelcomeItem|\/icons\/|RecordPageExample|\.legacy\.|EmailSmokeTest|Demo\.vue$|I18nDeveloperSettings)/;

const ENGLISH_TEXT_RE = />\s*([A-Za-z][A-Za-z0-9\s,'’.!?…\-:()/#]+?)\s*</g;
const ATTR_RE = /(?:title|label|placeholder|aria-label)=["']([A-Za-z][^"'{][^"']{2,})["']/g;

function nsFor(rel) {
  if (rel.includes('/events/') || rel.includes('/Event')) return 'events';
  if (rel.includes('/deals/') || rel.includes('/Deal')) return 'deals';
  if (rel.includes('/tasks/') || rel.includes('/Task')) return 'tasks';
  if (rel.includes('/people/') || rel.includes('/People') || rel.includes('/Contact')) return 'people';
  if (rel.includes('/organizations/') || rel.includes('/Organization') || rel.includes('/Group')) return 'organizations';
  if (rel.includes('/inbox/') || rel.includes('/communications/') || rel.includes('Inbox')) return 'inbox';
  if (rel.includes('/dashboard/') || rel.includes('Dashboard')) return 'dashboard';
  if (rel.includes('/import/') || rel.includes('Import')) return 'import';
  if (rel.includes('/audit/') || rel.includes('/portal/')) return 'audit';
  if (rel.includes('/platform/')) return 'platform';
  if (rel.includes('/forms/') || rel.includes('/Form')) return 'forms';
  if (rel.includes('/settings/')) return 'settings';
  if (rel.includes('/process') || rel.includes('/admin/')) return 'process';
  if (rel.includes('/appointments/')) return 'appointments';
  if (rel.includes('/notifications/')) return 'notifications';
  if (rel.includes('/record') || rel.includes('/relationships/') || rel.includes('/activity/')) return 'records';
  if (rel.includes('/ui/')) return 'common';
  return 'common';
}

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.vue')) acc.push(full);
  }
  return acc;
}

function hasHardcoded(content) {
  for (const re of [ENGLISH_TEXT_RE, ATTR_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const text = (m[2] ?? m[1]).trim();
      if (text.length >= 3 && /[aeiou]/i.test(text) && !/t\s*\(/.test(text)) return true;
    }
  }
  return false;
}

const byNs = new Map();
for (const file of walk(path.join(CLIENT_ROOT, 'src'))) {
  const rel = path.relative(CLIENT_ROOT, file).replace(/\\/g, '/');
  if (SKIP.test(rel)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (!hasHardcoded(content)) continue;
  const ns = nsFor(rel);
  if (!byNs.has(ns)) byNs.set(ns, []);
  byNs.get(ns).push(rel);
}

for (const [ns, files] of byNs) {
  console.log(`\n== second pass ${ns} (${files.length} files) ==`);
  const r = spawnSync('node', [script, '--namespace', ns, '--write', ...files], {
    cwd: CLIENT_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const keysFile = path.join(__dirname, `auto-${ns}-keys.json`);
  if (fs.existsSync(keysFile)) {
    spawnSync('node', [path.join(__dirname, 'merge-locale-keys.mjs'), ns, keysFile], {
      cwd: CLIENT_ROOT,
      stdio: 'inherit',
    });
  }
}

console.log('\nSecond pass done.');
