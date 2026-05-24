#!/usr/bin/env node
/**
 * Translate Phase A/B keys (sidebar, tabs, record chrome, sys fields, picklists, relative time)
 * from en → target locale when the current message still matches English.
 *
 * Usage:
 *   node scripts/i18n/apply-phase-ab-translations.mjs es fr hi
 *   node scripts/i18n/apply-phase-ab-translations.mjs --all
 *   node scripts/i18n/apply-phase-ab-translations.mjs --all --full-records
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES_DIR } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DELAY_MS = Number(process.env.I18N_TRANSLATE_DELAY_MS || 100);
const ALL_TARGETS = ['es', 'fr', 'hi', 'it', 'pt', 'nl', 'ru', 'ar', 'ja', 'zh', 'ko', 'de'];

const args = process.argv.slice(2);
const fullRecords = args.includes('--full-records');
const targets = args.includes('--all')
  ? ALL_TARGETS.filter((l) => l !== 'en')
  : args.filter((a) => !a.startsWith('--'));

if (!targets.length) {
  console.error('Usage: apply-phase-ab-translations.mjs <lang> [lang2 ...] | --all');
  process.exit(1);
}

/** @type {Record<string, (key: string) => boolean>} */
const KEY_FILTERS = {
  navigation: (k) =>
    ['home', 'inbox', 'approvals', 'attention', 'search', 'dashboard', 'coreSection', 'coreModules'].includes(
      k
    ) ||
    k.startsWith('module') ||
    (k.startsWith('app') && k !== 'appPortal') ||
    k.endsWith('Dashboard') ||
    k.startsWith('tab'),
  records: (k) =>
    fullRecords
      ? true
      : k.startsWith('section') ||
        k.startsWith('activitySystem') ||
        k === 'activityUpdatedRecord' ||
        [
          'detailsTitle',
          'descriptionTitle',
          'relatedRecordsTitle',
          'relatedTitle',
          'stageHistoryTitle',
          'subtasksTitle',
          'subtasksTitleWithCount',
          'tabSummary',
          'tabDetails',
          'genericTabActivity',
          'detailsSelectOption',
          'relatedEmpty',
          'relatedEmptyHint',
          'descriptionEmpty',
          'tagsTitle',
          'activityCommentPh',
          'activityReply',
        ].includes(k),
  deals: (k) => k.startsWith('sysField') || k.startsWith('activity') || k.startsWith('picklist'),
  people: (k) => k.startsWith('sysField'),
  organizations: (k) => k.startsWith('sysField'),
  tasks: (k) => k.startsWith('sysField'),
  common: (k) => k === 'pronounYou' || k.startsWith('relative'),
};

const NAMESPACES = Object.keys(KEY_FILTERS);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldSkipIcu(message) {
  return /,\s*plural\b/.test(message) || /,\s*select\b/.test(message);
}

function maskPlaceholders(message) {
  const tokens = [];
  const masked = message.replace(/\{[^}]+\}/g, (match) => {
    const id = `__ICU_${tokens.length}__`;
    tokens.push({ id, match });
    return id;
  });
  return { masked, tokens };
}

function unmaskPlaceholders(text, tokens) {
  let out = text;
  for (const { id, match } of tokens) {
    out = out.replaceAll(id, match);
  }
  return out;
}

async function translateText(text, lang) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', lang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'LiteDesk-i18n-script/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map((part) => part[0]).join('');
}

async function translateMessage(message, lang) {
  if (!message?.trim() || message.length > 4500) return message;
  if (shouldSkipIcu(message)) return message;
  const { masked, tokens } = maskPlaceholders(message);
  const translated = await translateText(masked, lang);
  return unmaskPlaceholders(translated, tokens);
}

function readCatalog(lang, ns) {
  const file = path.join(LOCALES_DIR, lang, `${ns}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeCatalog(lang, ns, catalog) {
  const file = path.join(LOCALES_DIR, lang, `${ns}.json`);
  fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
}

async function processLanguage(lang) {
  let translated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const ns of NAMESPACES) {
    const en = readCatalog('en', ns);
    const loc = readCatalog(lang, ns);
    if (!en || !loc) continue;

    const matchKey = KEY_FILTERS[ns];

    for (const [key, entry] of Object.entries(en)) {
      if (!matchKey(key)) continue;

      const enMsg = entry?.message;
      if (!enMsg) continue;

      const cur = loc[key];
      const curMsg = cur?.message;
      if (curMsg && curMsg !== enMsg) {
        unchanged += 1;
        continue;
      }

      if (shouldSkipIcu(enMsg)) {
        skipped += 1;
        continue;
      }

      try {
        const newMsg = await translateMessage(enMsg, lang);
        loc[key] = { ...entry, message: newMsg };
        translated += 1;
        if (translated % 25 === 0) {
          writeCatalog(lang, ns, loc);
          console.log(`  [${lang}] checkpoint ${ns} (${translated} translated)`);
        }
        await sleep(DELAY_MS);
      } catch (e) {
        console.warn(`  [${lang}] skip ${ns}.${key}: ${e.message}`);
        skipped += 1;
      }
    }

    writeCatalog(lang, ns, loc);
  }

  console.log(`✓ ${lang}: translated=${translated}, unchanged=${unchanged}, skipped=${skipped}`);
}

for (const lang of targets) {
  console.log(`\n=== ${lang} ===`);
  await processLanguage(lang);
}

console.log('\nDone.');
