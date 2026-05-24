#!/usr/bin/env node
/**
 * Apply hand-reviewed Spanish overrides for ICU / gap keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import IntlMessageFormat from 'intl-messageformat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gapsPath = path.join(__dirname, 'es-gap-translations.json');
const localesRoot = path.join(__dirname, '../../src/locales');

const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'));
let applied = 0;
const errors = [];

for (const [fullKey, message] of Object.entries(gaps)) {
  const [namespace, ...rest] = fullKey.split('.');
  const key = rest.join('.');
  const esPath = path.join(localesRoot, 'es', `${namespace}.json`);
  if (!fs.existsSync(esPath)) {
    errors.push(`Missing ${esPath}`);
    continue;
  }
  try {
    new IntlMessageFormat(message);
  } catch (e) {
    errors.push(`Invalid ICU ${fullKey}: ${e.message}`);
    continue;
  }
  const catalog = JSON.parse(fs.readFileSync(esPath, 'utf8'));
  const prev = catalog[key];
  catalog[key] =
    typeof prev === 'string' ? { message } : { ...prev, message };
  fs.writeFileSync(esPath, `${JSON.stringify(catalog, null, 2)}\n`);
  applied += 1;
}

if (errors.length) {
  for (const e of errors) console.error('❌', e);
  process.exit(1);
}
console.log(`Applied ${applied} Spanish gap translations to es/*.json`);
