#!/usr/bin/env node
/**
 * i18n:extract — report keys used in source vs catalog; optional TMS export.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CLIENT_ROOT,
  loadAllKeysForLanguage,
  scanSourceFiles,
} from './shared.mjs';

const KEY_USAGE_RE =
  /(?:\bt|\$t|i18n\.t)\s*\(\s*['"`]([a-z][a-zA-Z0-9_.]*)['"`]/g;

function isCatalogKey(key) {
  if (!key || key.includes('/') || key.includes('${')) return false;
  return key.includes('.');
}

function collectUsedKeys() {
  const used = new Map();
  for (const file of scanSourceFiles()) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = KEY_USAGE_RE.exec(content)) !== null) {
      const key = match[1];
      if (!isCatalogKey(key)) continue;
      const list = used.get(key) ?? [];
      list.push(path.relative(CLIENT_ROOT, file));
      used.set(key, list);
    }
  }
  return used;
}

function exportTms() {
  const { messages } = loadAllKeysForLanguage('en');
  const metadata = {};
  const outPath = path.join(CLIENT_ROOT, 'src/locales/en.export.json');
  const exportDoc = {};
  for (const [key, message] of Object.entries(messages).sort(([a], [b]) => a.localeCompare(b))) {
    exportDoc[key] = { message, description: metadata[key]?.description };
  }
  fs.writeFileSync(outPath, JSON.stringify(exportDoc, null, 2) + '\n');
  console.log(`Wrote TMS export: ${path.relative(CLIENT_ROOT, outPath)}`);
}

function main() {
  const args = new Set(process.argv.slice(2));
  const failOnMissing = args.has('--fail-on-missing');
  const used = collectUsedKeys();
  const { keys: catalogKeys } = loadAllKeysForLanguage('en');
  const catalogSet = new Set(catalogKeys);

  console.log(`Used keys in source: ${used.size}`);
  console.log(`Catalog keys (en): ${catalogKeys.length}`);

  const missing = [];
  for (const [key, files] of [...used.entries()].sort()) {
    if (!catalogSet.has(key)) {
      missing.push({ key, files });
      console.log(`  MISSING  ${key}  ← ${files.slice(0, 2).join(', ')}`);
    }
  }

  if (failOnMissing && missing.length > 0) {
    console.error(`\n❌ ${missing.length} t() keys used in source but missing from en catalogs.`);
    console.error('Add keys to src/locales/en/{namespace}.json then run npm run i18n:sync-keys');
    process.exit(1);
  }

  if (args.has('--export')) {
    exportTms();
  }

  if (args.has('--sort')) {
    console.log('Note: commit sorted locale JSON manually or via formatter.');
  }
}

main();
