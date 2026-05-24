#!/usr/bin/env node
/**
 * Merge *-keys.json fragments into en/{namespace}.json and es/{namespace}.json
 * Usage: node scripts/i18n/merge-locale-keys.mjs <namespace> <keys-file.json> [keys-file2.json ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesRoot = path.join(__dirname, '../../src/locales');

const namespace = process.argv[2];
const keyFiles = process.argv.slice(3);

if (!namespace || !keyFiles.length) {
  console.error('Usage: merge-locale-keys.mjs <namespace> <keys.json> [...]');
  process.exit(1);
}

const mergedExtra = {};
for (const file of keyFiles) {
  const extraPath = path.isAbsolute(file) ? file : path.join(__dirname, file);
  if (!fs.existsSync(extraPath)) {
    console.error(`Missing keys file: ${extraPath}`);
    process.exit(1);
  }
  Object.assign(mergedExtra, JSON.parse(fs.readFileSync(extraPath, 'utf8')));
}

for (const lang of ['en', 'es']) {
  const targetPath = path.join(localesRoot, lang, `${namespace}.json`);
  const catalog = fs.existsSync(targetPath)
    ? JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    : {};
  for (const [k, v] of Object.entries(mergedExtra)) {
    if (lang === 'es' && catalog[k]) continue;
    if (lang === 'en' && catalog[k]?.message) continue;
    catalog[k] = v;
  }
  fs.writeFileSync(targetPath, `${JSON.stringify(catalog, null, 2)}\n`);
}

console.log(`Merged ${Object.keys(mergedExtra).length} keys into en/es ${namespace}.json`);
