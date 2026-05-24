#!/usr/bin/env node
/**
 * Remove locale keys not present in en catalog.
 * Usage: node scripts/i18n/prune-orphaned-keys.mjs fr de hi es
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES_DIR } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enDir = path.join(LOCALES_DIR, 'en');
const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: prune-orphaned-keys.mjs <lang> [...]');
  process.exit(1);
}

const enKeys = new Set();
for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith('.json'))) {
  const ns = file.replace(/\.json$/, '');
  const catalog = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
  for (const k of Object.keys(catalog)) enKeys.add(`${ns}.${k}`);
}

for (const lang of targets) {
  const langDir = path.join(LOCALES_DIR, lang);
  let removed = 0;
  for (const file of fs.readdirSync(langDir).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace(/\.json$/, '');
    const filePath = path.join(langDir, file);
    const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const next = {};
    for (const [k, v] of Object.entries(catalog)) {
      if (enKeys.has(`${ns}.${k}`)) next[k] = v;
      else removed += 1;
    }
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);
  }
  console.log(`${lang}: removed ${removed} orphaned keys`);
}
