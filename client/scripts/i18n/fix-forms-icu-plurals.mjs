#!/usr/bin/env node
/**
 * Split forms.json ICU plural messages into One/Other keys for vue-i18n runtime.
 * vue-i18n message compiler does not support `{count, plural, ...}` (see I18N_SUMMARY.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR, SUPPORTED_LANGUAGES } from './shared.mjs';

/** @type {Record<string, { oneSuffix: string; otherSuffix: string }>} */
const KEY_SUFFIXES = {
  builderCanvasQuestionCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  builderQuestionCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  hubSectionCount: { oneSuffix: 'One', otherSuffix: 'Other' },
  hubFillRequiredRemaining: { oneSuffix: 'One', otherSuffix: 'Other' },
};

const ICU_PLURAL_RE =
  /\{count,\s*plural,\s*one\s+\{#\s*(.+?)\}\s+other\s+\{#\s*(.+?)\}\}/;

const SECTION_SUMMARY_RE =
  /\{subsectionCount,\s*plural,\s*one\s+\{#\s*(.+?)\}\s+other\s+\{#\s*(.+?)\}\}\s*•\s*\{questionCount,\s*plural,\s*one\s+\{#\s*(.+?)\}\s+other\s+\{#\s*(.+?)\}\}/;

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

function splitSectionSummary(entry) {
  const match = entry.message.match(SECTION_SUMMARY_RE);
  if (!match) return null;
  const [, subOne, subOther, qOne, qOther] = match;
  return {
    builderSectionSubsectionCountOne: {
      message: `{subsectionCount} ${subOne}`,
      description: 'Section subsection count (singular)',
    },
    builderSectionSubsectionCountOther: {
      message: `{subsectionCount} ${subOther}`,
      description: 'Section subsection count (plural)',
    },
    builderSectionQuestionCountOne: {
      message: `{questionCount} ${qOne}`,
      description: 'Section question count (singular)',
    },
    builderSectionQuestionCountOther: {
      message: `{questionCount} ${qOther}`,
      description: 'Section question count (plural)',
    },
  };
}

let totalChanged = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const filePath = path.join(LOCALES_DIR, lang, 'forms.json');
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
    console.log(`  forms/${lang}: ${baseKey} → ${oneKey} / ${otherKey}`);
  }

  const summaryEntry = data.builderSectionSummary;
  if (summaryEntry?.message) {
    const split = splitSectionSummary(summaryEntry);
    if (split) {
      for (const [key, value] of Object.entries(split)) {
        data[key] = value;
      }
      delete data.builderSectionSummary;
      changed = true;
      console.log(`  forms/${lang}: builderSectionSummary → subsection/question One/Other`);
    } else {
      console.warn(`  ${lang}: could not parse ICU plural for builderSectionSummary`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
    totalChanged += 1;
  }
}

console.log(totalChanged ? `Done. Updated ${totalChanged} locale file(s).` : 'No changes.');
