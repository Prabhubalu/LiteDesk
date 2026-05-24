#!/usr/bin/env node
/**
 * Mirror en locale files into target languages (copies message text from en).
 * Usage: node scripts/i18n/mirror-locales.mjs fr de hi
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_NAMESPACES } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesRoot = path.join(__dirname, '../../src/locales');
const enDir = path.join(localesRoot, 'en');
const targets = process.argv.slice(2);

if (!targets.length) {
  console.error('Usage: mirror-locales.mjs <lang> [lang2 ...]');
  process.exit(1);
}

const enFiles = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'));

for (const lang of targets) {
  const langDir = path.join(localesRoot, lang);
  fs.mkdirSync(langDir, { recursive: true });
  for (const file of enFiles) {
    const en = JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8'));
    const outPath = path.join(langDir, file);
    const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
    const merged = { ...en };
    for (const [k, v] of Object.entries(existing)) {
      if (!merged[k]) merged[k] = v;
    }
    fs.writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
  console.log(`Mirrored ${enFiles.length} files → ${lang}/`);
}

console.log(`Namespaces: ${SHARED_NAMESPACES.join(', ')}`);
