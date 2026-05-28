#!/usr/bin/env node
/**
 * Semi-automated vue-i18n migration: extract template/attr English strings,
 * merge keys into locale catalogs, patch Vue files with t().
 *
 * Usage:
 *   node scripts/i18n/auto-migrate-vue.mjs --namespace=records --write src/components/Notes.vue ...
 *   node scripts/i18n/auto-migrate-vue.mjs --namespace=events --write --glob=src/components/events
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_ROOT, LOCALES_DIR, SHARED_NAMESPACES } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENGLISH_TEXT_RE = />\s*([A-Za-z][A-Za-z0-9\s,'’.!?…\-:()/#]+?)\s*</g;
const ATTR_RE =
  /(?<![:\w])(title|label|placeholder|aria-label)=["']([A-Za-z][^"'{][^"']{2,})["']/g;

const ALLOWLIST = new Set([
  'OK',
  'ID',
  'API',
  'CRM',
  'URL',
  'UTC',
  'PDF',
  'CSV',
  'ESC',
  'Enter',
]);

const SKIP_PATH_RE =
  /(?:HelloWorld|WelcomeItem|\/icons\/|RecordPageExample|\.legacy\.|EmailSmokeTest|Demo\.vue$)/;

const FORBIDDEN_LEAF = new Set([
  'title',
  'label',
  'message',
  'text',
  'name',
  'description',
  'error',
  'hint',
  'placeholder',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { namespace: '', write: false, globs: [], files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--write') opts.write = true;
    else if (a === '--namespace' && args[i + 1]) {
      opts.namespace = args[++i];
    } else if (a.startsWith('--namespace=')) opts.namespace = a.split('=')[1];
    else if (a === '--glob' && args[i + 1]) {
      opts.globs.push(args[++i]);
    } else if (a.startsWith('--glob=')) opts.globs.push(a.slice(7));
    else if (!a.startsWith('--')) opts.files.push(a);
  }
  return opts;
}

function isLikelyUiEnglish(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return false;
  if (ALLOWLIST.has(trimmed)) return false;
  if (trimmed.startsWith('{')) return false;
  if (/^[\d\s$%•]+$/.test(trimmed)) return false;
  if (/^t\s*\(/.test(trimmed) || /\bt\s*\(/.test(trimmed)) return false;
  if (/^(get|is|has)[A-Z]\w*\(/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(trimmed) && !/\s/.test(trimmed)) return false;
  if (
    trimmed.includes('${') ||
    trimmed.includes('{{') ||
    trimmed.includes('?') ||
    trimmed.includes('||') ||
    trimmed.includes('&&') ||
    (trimmed.includes('(') && !trimmed.includes(')'))
  ) {
    return false;
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && !/\s/.test(trimmed)) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return /[aeiouAEIOU]/.test(trimmed);
}

function componentPrefix(filePath) {
  const base = path.basename(filePath, '.vue');
  return base.charAt(0).toLowerCase() + base.slice(1);
}

function suffixFromText(text) {
  const words = text
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (!words.length) return 'text';
  const camel = words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
  return camel.slice(0, 48) || 'text';
}

function loadReuseMap() {
  const map = new Map();
  const enDir = path.join(LOCALES_DIR, 'en');
  for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace(/\.json$/, '');
    const catalog = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
    for (const [key, val] of Object.entries(catalog)) {
      const msg = typeof val === 'string' ? val : val?.message;
      if (msg) map.set(msg.trim(), `${ns}.${key}`);
    }
  }
  return map;
}

function walkGlob(relGlob) {
  const out = [];
  const norm = relGlob.replace(/\\/g, '/');
  if (!norm.includes('*')) {
    const abs = path.join(CLIENT_ROOT, norm);
    if (fs.existsSync(abs)) {
      if (fs.statSync(abs).isDirectory()) walkDir(abs, out);
      else if (abs.endsWith('.vue')) out.push(abs);
    }
    return out;
  }
  const base = norm.split('*')[0].replace(/\/$/, '');
  const absBase = path.join(CLIENT_ROOT, base);
  if (!fs.existsSync(absBase)) return out;
  walkDir(absBase, out);
  const suffix = norm.includes('**') ? '' : norm.split('*').pop() || '';
  return out.filter((f) => {
    const rel = path.relative(CLIENT_ROOT, f).replace(/\\/g, '/');
    if (!rel.endsWith('.vue')) return false;
    if (suffix && !rel.includes(suffix.replace(/^\//, ''))) return true;
    return true;
  });
}

function walkDir(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, acc);
    else if (e.name.endsWith('.vue')) acc.push(full);
  }
}

function ensureUseI18n(content) {
  if (/useI18n/.test(content)) return content;
  const scriptMatch = content.match(/<script setup[^>]*>/);
  if (!scriptMatch) return content;
  let next = content.replace(
    scriptMatch[0],
    `${scriptMatch[0]}\nimport { useI18n } from 'vue-i18n';`
  );
  const insertAfter = next.match(
    /(const props = defineProps\([\s\S]*?\);|const emit = defineEmits\([\s\S]*?\);|defineProps\([\s\S]*?\);)/
  );
  if (insertAfter) {
    const idx = next.indexOf(insertAfter[0]) + insertAfter[0].length;
    next = `${next.slice(0, idx)}\n\nconst { t } = useI18n();${next.slice(idx)}`;
  } else {
    next = next.replace(
      /import \{ useI18n \} from 'vue-i18n';\n/,
      "import { useI18n } from 'vue-i18n';\n\nconst { t } = useI18n();\n"
    );
  }
  return next;
}

function uniqueKey(basePrefix, suffix, usedKeys) {
  let key = `${basePrefix}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
  if (FORBIDDEN_LEAF.has(key.split('.').pop())) {
    key = `${basePrefix}Ui${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
  }
  let candidate = key;
  let n = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${key}${n}`;
    n += 1;
  }
  usedKeys.add(candidate);
  return candidate;
}

function extractStrings(content) {
  const findings = [];
  for (const [re, kind] of [
    [ENGLISH_TEXT_RE, 'text'],
    [ATTR_RE, 'attr'],
  ]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const text = kind === 'attr' ? m[2] : m[1];
      if (!isLikelyUiEnglish(text)) continue;
      findings.push({ text: text.trim(), index: m.index, raw: m[0], kind, attr: kind === 'attr' ? m[1] : null });
    }
  }
  findings.sort((a, b) => b.index - a.index);
  return findings;
}

function patchContent(content, findings, namespace, prefix, reuseMap, catalog, usedKeys) {
  let next = content;
  const replacements = [];

  for (const f of findings) {
    const reuse = reuseMap.get(f.text);
    const fullKey = reuse || `${namespace}.${uniqueKey(prefix, suffixFromText(f.text), usedKeys)}`;
    if (!reuse) {
      const leaf = fullKey.split('.').slice(1).join('.');
      if (!catalog[leaf]) {
        catalog[leaf] = {
          message: f.text,
          description: `Auto-migrated from ${prefix}`,
        };
      }
    }

    let replacement;
    if (f.kind === 'text') {
      replacement = `>{{ t('${fullKey}') }}<`;
    } else {
      replacement = `:${f.attr}="t('${fullKey}')"`;
    }
    replacements.push({ start: f.index, end: f.index + f.raw.length, replacement, raw: f.raw, kind: f.kind });
  }

  for (const r of replacements) {
    const before = next.slice(0, r.start);
    const after = next.slice(r.end);
    next = before + r.replacement + after;
  }

  return next;
}

function templateOnly(content) {
  const start = content.indexOf('<template');
  const end = content.indexOf('</template>');
  if (start === -1 || end === -1) return content;
  return content.slice(start, end + '</template>'.length);
}

function migrateFile(filePath, namespace, reuseMap, catalog, usedKeys, write) {
  const rel = path.relative(CLIENT_ROOT, filePath);
  if (SKIP_PATH_RE.test(rel)) return { skipped: true, rel };
  let content = fs.readFileSync(filePath, 'utf8');
  const template = templateOnly(content);
  if (/useI18n/.test(content)) {
    const findings = extractStrings(content);
    if (!findings.length) return { skipped: true, rel, reason: 'already-i18n' };
  }
  const prefix = componentPrefix(filePath);
  const findings = extractStrings(template);
  if (!findings.length) return { skipped: true, rel, reason: 'no-strings' };

  // Map template-local indices back to full file offsets
  const templateStart = content.indexOf('<template');
  const mapped = findings.map((f) => ({ ...f, index: f.index + templateStart }));
  let next = patchContent(content, mapped, namespace, prefix, reuseMap, catalog, usedKeys);
  next = ensureUseI18n(next);

  if (write) fs.writeFileSync(filePath, next);
  return { rel, count: findings.length, write };
}

function main() {
  const opts = parseArgs();
  if (!opts.namespace) {
    console.error('--namespace required');
    process.exit(1);
  }
  if (!SHARED_NAMESPACES.includes(opts.namespace) && opts.write) {
    console.warn(
      `Warning: "${opts.namespace}" is not in SHARED_NAMESPACES — add to constants.ts before runtime load.`
    );
  }

  let files = opts.files.map((f) => path.join(CLIENT_ROOT, f));
  for (const g of opts.globs) {
    files.push(...walkGlob(g));
  }
  files = [...new Set(files)].filter((f) => fs.existsSync(f));

  const reuseMap = loadReuseMap();
  const catalog = {};
  const usedKeys = new Set();
  const enPath = path.join(LOCALES_DIR, 'en', `${opts.namespace}.json`);
  if (fs.existsSync(enPath)) {
    const existing = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    for (const k of Object.keys(existing)) usedKeys.add(k);
  }

  let migrated = 0;
  let strings = 0;
  for (const file of files) {
    const res = migrateFile(file, opts.namespace, reuseMap, catalog, usedKeys, opts.write);
    if (res.count) {
      migrated += 1;
      strings += res.count;
      console.log(`${opts.write ? '✓' : '·'} ${res.rel} (${res.count})`);
    }
  }

  const keysPath = path.join(__dirname, `auto-${opts.namespace}-keys.json`);
  if (opts.write && Object.keys(catalog).length) {
    fs.writeFileSync(keysPath, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`Wrote ${Object.keys(catalog).length} new keys → ${keysPath}`);
    console.log(`Run: npm run i18n:merge-keys -- ${opts.namespace} scripts/i18n/auto-${opts.namespace}-keys.json`);
  }

  console.log(`Done: ${migrated} files, ${strings} strings${opts.write ? '' : ' (dry-run)'}`);
}

main();
