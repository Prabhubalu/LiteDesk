#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enPath = path.join(__dirname, '../../src/locales/en/settings.json');
const esPath = path.join(__dirname, '../../src/locales/es/settings.json');
const extraFiles = [
  'account-settings-keys.json',
  'assignment-rules-keys.json',
  'helpdesk-sla-keys.json',
  'apps-settings-keys.json',
  'helpdesk-analytics-keys.json',
  'sales-pipelines-keys.json',
  'sales-playbooks-keys.json',
  'modules-fields-keys.json',
  'settings-remaining-keys.json',
  'settings-people-types-keys.json',
  'settings-core-module-detail-keys.json',
  'settings-integrations-keys.json',
];

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const mergedExtra = {};
for (const file of extraFiles) {
  const extraPath = path.join(__dirname, file);
  if (!fs.existsSync(extraPath)) continue;
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  Object.assign(mergedExtra, extra);
  Object.assign(en, extra);
}
fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);

let es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
for (const [k, v] of Object.entries(mergedExtra)) {
  if (!es[k]) es[k] = v;
}
fs.writeFileSync(esPath, `${JSON.stringify(es, null, 2)}\n`);
console.log(`Merged ${Object.keys(mergedExtra).length} keys into settings locale`);
