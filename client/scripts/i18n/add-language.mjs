#!/usr/bin/env node
/**
 * Register a new UI language and scaffold locale files from English.
 *
 * Usage:
 *   node scripts/i18n/add-language.mjs <lang> [defaultLocale]
 *
 * Examples:
 *   node scripts/i18n/add-language.mjs pl pl-PL
 *   node scripts/i18n/add-language.mjs th th-TH
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLIENT_ROOT, SUPPORTED_LANGUAGES } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [lang, localeArg] = process.argv.slice(2);

if (!lang || !/^[a-z]{2}$/.test(lang)) {
  console.error('Usage: add-language.mjs <lang> [defaultLocale]');
  console.error('  <lang> must be a two-letter ISO 639-1 code (e.g. pl, th, sv)');
  console.error('Example: add-language.mjs pl pl-PL');
  process.exit(1);
}

if (SUPPORTED_LANGUAGES.includes(lang)) {
  console.error(`Language "${lang}" is already in SUPPORTED_LANGUAGES.`);
  process.exit(1);
}

/** @type {Record<string, string>} */
const LOCALE_GUESSES = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
  pl: 'pl-PL',
  th: 'th-TH',
  sv: 'sv-SE',
  tr: 'tr-TR',
  vi: 'vi-VN',
  id: 'id-ID',
};

const defaultLocale = localeArg || LOCALE_GUESSES[lang] || `${lang}-${lang.toUpperCase()}`;

function updateLanguageArray(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(
    `export const ${exportName} = \\[([\\s\\S]*?)\\]( as const)?;`
  );
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${exportName} in ${filePath}`);
  }
  const langs = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  langs.push(lang);
  const asConst = match[2] || '';
  const replacement = `export const ${exportName} = [\n  ${langs.map((l) => `'${l}'`).join(',\n  ')},\n]${asConst};`;
  fs.writeFileSync(filePath, content.replace(pattern, replacement));
}

function updateDefaultLocaleMap(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /export const LANGUAGE_TO_DEFAULT_LOCALE: Record<SupportedLanguage, string> = \{([\s\S]*?)\};/;
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find LANGUAGE_TO_DEFAULT_LOCALE in ${filePath}`);
  }
  const insertion = `  ${lang}: '${defaultLocale}',\n`;
  const updated = content.replace(
    pattern,
    `export const LANGUAGE_TO_DEFAULT_LOCALE: Record<SupportedLanguage, string> = {${match[1]}${insertion}};`
  );
  fs.writeFileSync(filePath, updated);
}

const sharedPath = path.join(CLIENT_ROOT, 'scripts/i18n/shared.mjs');
const constantsPath = path.join(CLIENT_ROOT, 'src/i18n/constants.ts');

console.log(`Adding language "${lang}" (default locale: ${defaultLocale})...`);

updateLanguageArray(sharedPath, 'SUPPORTED_LANGUAGES');
updateLanguageArray(constantsPath, 'SUPPORTED_LANGUAGES');
updateDefaultLocaleMap(constantsPath);

console.log('  Updated scripts/i18n/shared.mjs');
console.log('  Updated src/i18n/constants.ts');

execSync(`node scripts/i18n/mirror-locales.mjs ${lang}`, {
  cwd: CLIENT_ROOT,
  stdio: 'inherit',
});
execSync('node scripts/i18n/sync-locale-keys.mjs', {
  cwd: CLIENT_ROOT,
  stdio: 'inherit',
});

console.log(`
Done. Next steps:
  1. Translate: npm run i18n:translate-locale -- ${lang}
  2. Or hand-edit src/locales/${lang}/*.json
  3. Verify: npm run i18n:check
  4. If RTL, add "${lang}" to RTL_LANGUAGES in src/i18n/constants.ts
  5. Hard refresh the app after switching locale in settings
`);
