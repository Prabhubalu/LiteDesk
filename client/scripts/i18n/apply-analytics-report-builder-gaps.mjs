#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gapsPath = path.join(__dirname, 'analytics-report-builder-gap-translations.json');
const localesRoot = path.join(__dirname, '../../src/locales');
const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'));

let applied = 0;

for (const [lang, entries] of Object.entries(gaps)) {
  const filePath = path.join(localesRoot, lang, 'analytics.json');
  if (!fs.existsSync(filePath)) {
    console.warn(`Skip missing ${filePath}`);
    continue;
  }
  const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const [key, message] of Object.entries(entries)) {
    const prev = catalog[key];
    if (!prev) {
      console.warn(`Skip missing key ${lang}.${key}`);
      continue;
    }
    catalog[key] = typeof prev === 'string' ? { message } : { ...prev, message };
    applied += 1;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(catalog, null, 2)}\n`);
}

console.log(`Applied ${applied} analytics report builder gap translations.`);
