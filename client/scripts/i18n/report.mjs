#!/usr/bin/env node
/**
 * i18n:report — rollout visibility for engineering (burndown, phase coverage).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLIENT_ROOT,
  LOCALES_DIR,
  SUPPORTED_LANGUAGES,
  SHARED_NAMESPACES,
  loadAllKeysForLanguage,
  scanSourceFiles,
  isEnforcementPath,
} from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(__dirname, 'migration-baseline.json');

const ROLLOUT_PHASES = [
  { id: 'ui', label: 'UI primitives', paths: ['src/components/ui'] },
  { id: 'common', label: 'Shared common', paths: ['src/components/common'] },
  { id: 'layouts', label: 'Layouts', paths: ['src/layouts'] },
  { id: 'modals', label: 'Modals', paths: ['src/components/modals'] },
  { id: 'notifications', label: 'Toasts / notifications', paths: ['src/composables/useNotifications.js', 'src/components/notifications'] },
  { id: 'forms', label: 'Forms', paths: ['src/components/forms'] },
  { id: 'tables', label: 'Tables / list surfaces', paths: ['src/components/common/ListView.vue', 'src/components/common/DataTable.vue', 'src/components/common/TableView.vue', 'src/components/common/SummaryView.vue'] },
  { id: 'navigation', label: 'Navigation / sidebar', paths: ['src/components/AppSidebar.vue', 'src/components/AppSidebarSkeleton.vue', 'src/components/Nav.vue', 'src/components/TabBar.vue'] },
  { id: 'auth', label: 'Auth flows', paths: ['src/views/Login.vue', 'src/components/LoginForm.vue'] },
  { id: 'settings', label: 'Settings / profile', paths: ['src/views/Settings.vue', 'src/components/settings'] },
];

const ENFORCEMENT_GLOBS = [
  'src/components/ui',
  'src/layouts',
  'src/components/common',
  'src/components/modals',
  'src/components/AppSidebar.vue',
  'src/components/AppSidebarSkeleton.vue',
  'src/components/TabBar.vue',
  'src/components/notifications',
  'src/components/Nav.vue',
  'src/views/Login.vue',
  'src/components/LoginForm.vue',
];

const MIGRATED_RE = /useI18n\s*\(|from\s+['"]vue-i18n['"]/;

function countVueFiles(dirRel) {
  const abs = path.join(CLIENT_ROOT, dirRel);
  if (!fs.existsSync(abs)) return { total: 0, migrated: 0, files: [] };
  const files = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.vue') || e.name.endsWith('.js') || e.name.endsWith('.ts')) {
        files.push(full);
      }
    }
  }
  walk(abs);
  return { total: files.length, migrated: 0, files };
}

function isLikelyUiEnglish(text) {
  if (!text || text.length < 3) return false;
  if (/^t\s*\(/.test(text) || /\bt\s*\(/.test(text)) return false;
  if (/^(get|is|has)[A-Z]\w*\(/.test(text)) return false;
  if (/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(text) && !/\s/.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(text) && !/\s/.test(text)) return false;
  if (text.includes('${') || text.includes('{{') || text.includes('?') || text.includes('||') || text.includes('(')) return false;
  return /[a-zA-Z]/.test(text) && /[aeiou]/i.test(text);
}

async function countHardcodedScoped(pathPrefixes) {
  const ENGLISH_TEXT_RE = />\s*([A-Za-z][A-Za-z0-9\s,'’.!?\-]{2,})\s*</g;
  const ATTR_TEXT_RE = /(?:title|label|placeholder|aria-label)=["']([A-Za-z][^"'{][^"']{2,})["']/g;
  let count = 0;
  for (const file of scanSourceFiles()) {
    const rel = path.relative(CLIENT_ROOT, file);
    const normalizedPrefixes = pathPrefixes.map((p) => p.replace(/\\/g, '/'));
    const match = normalizedPrefixes.some((p) => rel === p || rel.startsWith(`${p}/`) || rel.startsWith(p));
    if (!match) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const re of [ENGLISH_TEXT_RE, ATTR_TEXT_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        if (isLikelyUiEnglish(m[1])) count += 1;
      }
    }
  }
  return count;
}

function localeCoverage() {
  const en = loadAllKeysForLanguage('en');
  const out = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    const dir = path.join(LOCALES_DIR, lang);
    if (!fs.existsSync(dir)) {
      out[lang] = { present: false, keys: 0, missingFromEn: en.keys.length };
      continue;
    }
    const bundle = loadAllKeysForLanguage(lang);
    const missing = en.keys.filter((k) => !bundle.messages[k]);
    out[lang] = {
      present: true,
      keys: bundle.keys.length,
      missingFromEn: missing.length,
      completePct: Math.round(((en.keys.length - missing.length) / en.keys.length) * 100),
    };
  }
  return out;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has('--write-baseline');

  const allVue = scanSourceFiles().filter((f) => f.endsWith('.vue'));
  const migratedVue = allVue.filter((f) => MIGRATED_RE.test(fs.readFileSync(f, 'utf8')));

  const totalHardcoded = await countHardcodedScoped(ENFORCEMENT_GLOBS);
  const phases = [];

  for (const phase of ROLLOUT_PHASES) {
    let total = 0;
    let migrated = 0;
    const phaseFiles = [];
    for (const p of phase.paths) {
      const abs = path.join(CLIENT_ROOT, p);
      if (!fs.existsSync(abs)) continue;
      if (fs.statSync(abs, { throwIf: false })?.isFile()) {
        phaseFiles.push(abs);
      } else {
        phaseFiles.push(...countVueFiles(p).files);
      }
    }
    total = phaseFiles.length;
    for (const abs of phaseFiles) {
      const content = fs.readFileSync(abs, 'utf8');
      const rel = path.relative(CLIENT_ROOT, abs);
      const fileHardcoded = await countHardcodedScoped([rel]);
      if (MIGRATED_RE.test(content) || fileHardcoded === 0) migrated += 1;
    }
    const hardcoded = await countHardcodedScoped(phase.paths);
    phases.push({
      id: phase.id,
      label: phase.label,
      componentsTotal: total,
      componentsMigrated: migrated,
      componentsPct: total ? Math.round((migrated / total) * 100) : 0,
      hardcodedRemaining: hardcoded,
      status: hardcoded === 0 && total > 0 && migrated === total ? 'complete' : migrated > 0 ? 'in_progress' : 'pending',
    });
  }

  const en = loadAllKeysForLanguage('en');
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      vueComponentsTotal: allVue.length,
      vueComponentsMigrated: migratedVue.length,
      vueComponentsMigratedPct: Math.round((migratedVue.length / allVue.length) * 100),
      hardcodedStringsRemaining: totalHardcoded,
      catalogKeysEn: en.keys.length,
      pseudoLocaleReady: true,
      rtlArchitectureReady: true,
    },
    phases,
    localeCoverage: localeCoverage(),
    nextActions: [
      phases.find((p) => p.id === 'ui')?.status !== 'complete' ? 'Complete components/ui/**' : null,
      'Migrate common/DeleteConfirmationModal, ListPageSkeleton, RowActions, ModuleActions',
      'Burndown ListView.vue and DataTable.vue',
      'Defer SummaryView.vue to dedicated sprint (high string count)',
    ].filter(Boolean),
  };

  if (writeBaseline) {
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify({ hardcodedStringsRemaining: totalHardcoded, at: report.generatedAt }, null, 2) + '\n'
    );
    console.log(`Wrote baseline: ${path.relative(CLIENT_ROOT, BASELINE_PATH)}`);
  }

  let baselineDelta = null;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    baselineDelta = totalHardcoded - baseline.hardcodedStringsRemaining;
  }

  console.log('\n# i18n Rollout Report\n');
  console.log(`Components migrated: ${report.summary.vueComponentsMigrated} / ${report.summary.vueComponentsTotal} (${report.summary.vueComponentsMigratedPct}%)`);
  console.log(`Hardcoded strings (enforced paths): ${report.summary.hardcodedStringsRemaining}`);
  if (baselineDelta !== null) {
    console.log(`Baseline delta: ${baselineDelta >= 0 ? '+' : ''}${baselineDelta}`);
  }
  console.log(`Catalog keys (en): ${report.summary.catalogKeysEn}`);
  console.log('\n## Phases\n');
  for (const p of phases) {
    console.log(
      `- ${p.label}: ${p.componentsMigrated}/${p.componentsTotal} components (${p.componentsPct}%), hardcoded=${p.hardcodedRemaining}, status=${p.status}`
    );
  }
  console.log('\n## Locale coverage (Phase A: en + es)\n');
  for (const [lang, cov] of Object.entries(report.localeCoverage)) {
    if (!cov.present && lang !== 'en' && lang !== 'es') continue;
    if (!cov.present) {
      console.log(`- ${lang}: not started`);
    } else {
      console.log(`- ${lang}: ${cov.completePct}% (${cov.missingFromEn} missing vs en)`);
    }
  }

  if (args.has('--json')) {
    const outPath = path.join(CLIENT_ROOT, 'src/locales/i18n-rollout-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nJSON report: ${path.relative(CLIENT_ROOT, outPath)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
