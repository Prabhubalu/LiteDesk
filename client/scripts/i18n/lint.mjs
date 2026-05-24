#!/usr/bin/env node
/**
 * i18n:lint — orphaned keys, deprecated keys, namespace coverage.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CLIENT_ROOT,
  LOCALES_DIR,
  SHARED_NAMESPACES,
  loadAllKeysForLanguage,
  readJson,
  scanSourceFiles,
} from './shared.mjs';

const errors = [];
const warnings = [];

const KEY_USAGE_RE =
  /(?:\bt|\$t|i18n\.t)\s*\(\s*['"`]([a-z][a-zA-Z0-9_.]*)['"`]/g;

function isCatalogKey(key) {
  if (!key || key.includes('/') || key.includes('${')) return false;
  return /^[a-z][a-zA-Z0-9_.]*$/.test(key) && key.includes('.');
}

function collectUsedKeys() {
  const used = new Set();
  for (const file of scanSourceFiles()) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = KEY_USAGE_RE.exec(content)) !== null) {
      const key = match[1];
      if (isCatalogKey(key)) used.add(key);
    }
  }
  return used;
}

function collectDeprecated() {
  const deprecated = [];
  for (const ns of SHARED_NAMESPACES) {
    const filePath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    const data = readJson(filePath);
    for (const [key, value] of Object.entries(data)) {
      if (value?.deprecated) {
        deprecated.push(`${ns}.${key}`);
      }
    }
  }
  return deprecated;
}

function main() {
  const { keys: catalogKeys } = loadAllKeysForLanguage('en');
  const usedKeys = collectUsedKeys();

  for (const key of catalogKeys) {
    if (!usedKeys.has(key)) {
      warnings.push(`Orphaned catalog key (unused in src): ${key}`);
    }
  }

  for (const key of usedKeys) {
    if (!catalogKeys.includes(key) && !key.startsWith('workflow.')) {
      errors.push(`Missing catalog entry for used key: ${key}`);
    }
  }

  for (const dep of collectDeprecated()) {
    if (usedKeys.has(dep)) {
      errors.push(`Deprecated key still referenced: ${dep}`);
    }
  }

  for (const w of warnings) console.warn(`⚠️  ${w}`);
  for (const e of errors) console.error(`❌ ${e}`);

  if (errors.length) {
    console.error(`\ni18n:lint failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('✅ i18n:lint passed.');
}

main();
