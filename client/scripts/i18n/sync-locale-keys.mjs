#!/usr/bin/env node
/**
 * Copy missing keys from en/*.json into every other locale (English placeholder).
 * Does not overwrite existing translations.
 *
 * Usage:
 *   node scripts/i18n/sync-locale-keys.mjs          # write missing keys
 *   node scripts/i18n/sync-locale-keys.mjs --check  # exit 1 if any locale is missing keys
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR, SHARED_NAMESPACES, SUPPORTED_LANGUAGES } from './shared.mjs';

const checkOnly = process.argv.includes('--check');
const targets = SUPPORTED_LANGUAGES.filter((l) => l !== 'en');
let missingTotal = 0;
let addedTotal = 0;

for (const ns of SHARED_NAMESPACES) {
  const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
  if (!fs.existsSync(enPath)) continue;

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  for (const lang of targets) {
    const langDir = path.join(LOCALES_DIR, lang);
    if (!fs.existsSync(langDir)) continue;

    const outPath = path.join(langDir, `${ns}.json`);
    const loc = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
    let added = 0;

    for (const [key, entry] of Object.entries(en)) {
      if (loc[key]) continue;
      missingTotal += 1;
      added += 1;
      if (!checkOnly) {
        loc[key] = entry;
      }
    }

    if (added && !checkOnly) {
      fs.writeFileSync(outPath, `${JSON.stringify(loc, null, 2)}\n`);
      addedTotal += added;
      console.log(`  ${lang}/${ns}.json +${added} keys`);
    } else if (added && checkOnly) {
      console.log(`  MISSING ${lang}/${ns}.json: ${added} keys`);
    }
  }
}

if (checkOnly) {
  if (missingTotal > 0) {
    console.error(`\n❌ ${missingTotal} keys missing across locales. Run: npm run i18n:sync-keys`);
    process.exit(1);
  }
  console.log('✅ All locale files include every en key.');
} else {
  console.log(`\nSynced ${addedTotal} keys. Run npm run i18n:translate-locale -- <lang> to MT new strings.`);
}
