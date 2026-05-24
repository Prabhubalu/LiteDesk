#!/usr/bin/env node
/**
 * Rename assignRulesCondField_* keys to assignRulesCondFieldCamelCase (i18n naming compliance).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesRoot = path.join(__dirname, '../../src/locales');

function renameKey(oldKey) {
  if (!oldKey.startsWith('assignRulesCondField_')) return oldKey;
  const suffix = oldKey.slice('assignRulesCondField_'.length);
  const parts = suffix.split('_').filter(Boolean);
  const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return `assignRulesCondField${camel}`;
}

function renameCatalog(catalog) {
  const next = {};
  for (const [key, value] of Object.entries(catalog)) {
    const newKey = renameKey(key);
    if (next[newKey] && newKey !== key) {
      console.warn(`Collision: ${key} -> ${newKey}`);
    }
    next[newKey] = value;
  }
  return next;
}

const targets = [
  ...['en', 'es', 'fr', 'de', 'hi'].map((lang) => path.join(localesRoot, lang, 'settings.json')),
  path.join(__dirname, 'assignment-rules-keys.json'),
];

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const renamed = renameCatalog(raw);
  const count = Object.keys(raw).filter((k) => k.startsWith('assignRulesCondField_')).length;
  fs.writeFileSync(filePath, `${JSON.stringify(renamed, null, 2)}\n`);
  console.log(`${path.relative(localesRoot, filePath) || path.basename(filePath)}: renamed ${count} keys`);
}
