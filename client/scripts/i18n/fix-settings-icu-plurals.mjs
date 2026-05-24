#!/usr/bin/env node
/**
 * Split settings.json ICU plural messages into One/Other keys for vue-i18n runtime.
 * vue-i18n message compiler does not support `{count, plural, ...}` (see I18N_SUMMARY.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR, SUPPORTED_LANGUAGES } from './shared.mjs';

/** @type {Record<string, { oneSuffix: string; otherSuffix: string }>} */
const KEY_SUFFIXES = {
  coreModDetailSharedBy: { oneSuffix: 'One', otherSuffix: 'Other' },
  coreModDetailApplicationCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  salesPipeStageCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  modFieldsOptionCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  modFieldsStageCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  settingsSubDetailDaysCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  settingsAppDetailModuleCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  peopleTypesInUse: { oneSuffix: 'One', otherSuffix: 'Other' },
  peopleTypesDeleteInUse: { oneSuffix: 'One', otherSuffix: 'Other' },
};

const ICU_PLURAL_RE =
  /\{count,\s*plural,\s*one\s+\{#\s*(.+?)\}\s+other\s+\{#\s*(.+?)\}\}/;

function splitPluralMessage(message) {
  const match = message.match(ICU_PLURAL_RE);
  if (!match) return null;
  const [full, oneWord, otherWord] = match;
  const prefix = message.slice(0, match.index);
  const suffix = message.slice(match.index + full.length);
  return {
    one: `${prefix}{count} ${oneWord}${suffix}`,
    other: `${prefix}{count} ${otherWord}${suffix}`,
  };
}

let totalChanged = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const filePath = path.join(LOCALES_DIR, lang, 'settings.json');
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;

  for (const [baseKey, { oneSuffix, otherSuffix }] of Object.entries(KEY_SUFFIXES)) {
    const entry = data[baseKey];
    if (!entry?.message) continue;

    const split = splitPluralMessage(entry.message);
    if (!split) {
      console.warn(`  ${lang}: could not parse ICU plural for ${baseKey}`);
      continue;
    }

    const oneKey = `${baseKey}${oneSuffix}`;
    const otherKey = `${baseKey}${otherSuffix}`;

    data[oneKey] = {
      message: split.one,
      description: `${entry.description || baseKey} (singular)`,
    };
    data[otherKey] = {
      message: split.other,
      description: `${entry.description || baseKey} (plural)`,
    };
    delete data[baseKey];
    changed = true;
    console.log(`  settings/${lang}: ${baseKey} → ${oneKey} / ${otherKey}`);
  }

  if (changed) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
    totalChanged += 1;
  }
}

console.log(totalChanged ? `Done. Updated ${totalChanged} locale file(s).` : 'No changes.');
