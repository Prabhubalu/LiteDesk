#!/usr/bin/env node
/**
 * i18n:validate — ICU syntax, key governance, missing fallbacks, duplicate semantics.
 */
import fs from 'node:fs';
import path from 'node:path';
import IntlMessageFormat from 'intl-messageformat';
import {
  CLIENT_ROOT,
  LOCALES_DIR,
  SHARED_NAMESPACES,
  SUPPORTED_LANGUAGES,
  loadAllKeysForLanguage,
  readJson,
  validateKeyNaming,
  flattenCatalogFile,
} from './shared.mjs';

const errors = [];
const warnings = [];

function validateIcu(message, key) {
  try {
    new IntlMessageFormat(message);
  } catch (e) {
    errors.push(`Invalid ICU for "${key}": ${e.message}`);
  }
}

function checkDuplicateSemantics(allMessages) {
  const byMessage = new Map();
  for (const [key, message] of Object.entries(allMessages)) {
    if (!message || message.length < 4) continue;
    const list = byMessage.get(message) ?? [];
    list.push(key);
    byMessage.set(message, list);
  }

  for (const [message, keys] of byMessage.entries()) {
    const domains = new Set(keys.map((k) => k.split('.')[0]));
    if (keys.length > 1 && domains.size > 1) {
      warnings.push(
        `Duplicate phrase "${message}" across domains: ${keys.join(', ')} (prefer shared namespace actions.* / states.*)`
      );
    }
  }
}

function main() {
  const base = loadAllKeysForLanguage('en');
  const baseKeys = new Set(base.keys);

  for (const [key, message] of Object.entries(base.messages)) {
    errors.push(...validateKeyNaming(key).map((m) => `[naming] ${m}`));
    validateIcu(message, key);
  }

  checkDuplicateSemantics(base.messages);

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === 'en') continue;
    const langDir = path.join(LOCALES_DIR, lang);
    if (!fs.existsSync(langDir)) {
      continue;
    }

    const { messages, keys } = loadAllKeysForLanguage(lang);
    for (const key of baseKeys) {
      if (!messages[key]) {
        errors.push(`Missing fallback key "${key}" in locale "${lang}"`);
      }
    }

    for (const key of keys) {
      if (!baseKeys.has(key)) {
        warnings.push(`Orphaned key "${key}" in locale "${lang}" (not in en)`);
      }
    }

    for (const [key, message] of Object.entries(messages)) {
      validateIcu(message, `${lang}:${key}`);
    }
  }

  for (const ns of SHARED_NAMESPACES) {
    const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    const raw = readJson(enPath);
    const sorted = JSON.stringify(raw, Object.keys(raw).sort(), 2);
    const fileSorted = JSON.stringify(raw, null, 2);
    if (process.env.I18N_CHECK_SORT === '1' && sorted !== fileSorted) {
      warnings.push(`Non-deterministic key order in ${enPath} (run i18n:extract --sort)`);
    }
  }

  for (const w of warnings) console.warn(`⚠️  ${w}`);
  for (const e of errors) console.error(`❌ ${e}`);

  if (errors.length) {
    console.error(`\ni18n:validate failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log('✅ i18n:validate passed.');
}

main();
