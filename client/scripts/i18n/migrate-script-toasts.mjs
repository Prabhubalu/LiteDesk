#!/usr/bin/env node
/**
 * Migrate alert()/toast strings in <script> blocks to t() calls.
 * Usage: node migrate-script-toasts.mjs --namespace=events --write src/components/events/EventExecution.vue
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_ROOT } from './shared.mjs';

const TOAST_RE =
  /(alert|toast\.(?:success|error|info|warning)?|notify\w*|showMessage)\(\s*([^)]*?)["']([A-Za-z][^"']{3,})["']/g;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { namespace: '', write: false, files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--write') opts.write = true;
    else if (a === '--namespace') opts.namespace = args[++i];
    else if (a.startsWith('--namespace=')) opts.namespace = a.split('=')[1];
    else if (!a.startsWith('--')) opts.files.push(path.join(CLIENT_ROOT, a));
  }
  return opts;
}

function suffixFromText(text) {
  const words = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 5);
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return (camel || 'toast').slice(0, 44);
}

function ensureUseI18n(content) {
  if (/useI18n/.test(content)) return content;
  return content.replace(
    /<script setup([^>]*)>/,
    "<script setup$1>\nimport { useI18n } from 'vue-i18n';\n\nconst { t } = useI18n();"
  );
}

function migrateFile(filePath, namespace, write) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isVue = filePath.endsWith('.vue');
  let before = '';
  let after = '';
  let script = content;
  if (isVue) {
    const scriptStart = content.indexOf('<script');
    const scriptEnd = content.lastIndexOf('</script>');
    if (scriptStart === -1) return 0;
    before = content.slice(0, scriptStart);
    script = content.slice(scriptStart, scriptEnd);
    after = content.slice(scriptEnd);
  }

  const catalog = {};
  const used = new Set();
  let count = 0;

  script = script.replace(TOAST_RE, (full, fn, prefix, text) => {
    if (!/[aeiou]/i.test(text)) return full;
    let key = suffixFromText(text);
    const prefixKey = path.basename(filePath, path.extname(filePath));
    key = `${prefixKey.charAt(0).toLowerCase()}${prefixKey.slice(1)}Toast${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    let candidate = key;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${key}${n++}`;
    }
    used.add(candidate);
    catalog[candidate] = {
      message: text,
      description: `Toast from ${path.basename(filePath)}`,
    };
    count += 1;
    return `${fn}(${prefix}t('${namespace}.${candidate}')`;
  });

  if (!count) return 0;
  if (isVue) {
    content = ensureUseI18n(before + script + after);
  } else {
    if (!/useI18n/.test(script)) {
      script = `import { useI18n } from 'vue-i18n';\n\nconst { t } = useI18n();\n\n${script}`;
    }
    content = script;
  }
  if (write) {
    fs.writeFileSync(filePath, content);
    const keysPath = path.join(__dirname, `auto-${namespace}-toast-keys.json`);
    const existing = fs.existsSync(keysPath) ? JSON.parse(fs.readFileSync(keysPath, 'utf8')) : {};
    Object.assign(existing, catalog);
    fs.writeFileSync(keysPath, `${JSON.stringify(existing, null, 2)}\n`);
  }
  return count;
}

const opts = parseArgs();
if (!opts.namespace || !opts.files.length) {
  console.error('Usage: migrate-script-toasts.mjs --namespace=events --write <files...>');
  process.exit(1);
}

let total = 0;
for (const file of opts.files) {
  if (!fs.existsSync(file)) continue;
  const n = migrateFile(file, opts.namespace, opts.write);
  if (n) console.log(`${opts.write ? '✓' : '·'} ${path.relative(CLIENT_ROOT, file)} (${n})`);
  total += n;
}
console.log(`Done: ${total} toast strings`);
