import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATP_ROOT = path.join(__dirname, '..');

let envLoaded = false;

export function ensureEnv() {
  if (envLoaded) return;
  dotenv.config({ path: path.join(ATP_ROOT, '.env') });
  envLoaded = true;
}

export function getConfig() {
  ensureEnv();
  return {
    port: Number(process.env.ATP_PORT || 3099),
    apiKey: process.env.ATP_API_KEY || 'dev-atp-key-change-me',
    mongoUri: process.env.ATP_MONGO_URI || 'mongodb://127.0.0.1:27017/arivu_atp',
    sutApiUrl: (process.env.ATP_SUT_API_URL || 'http://localhost:3000').replace(/\/$/, ''),
    sutClientUrl: (process.env.ATP_SUT_CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
    controlPlaneUrl: (process.env.ATP_CONTROL_PLANE_URL || 'http://localhost:3099').replace(/\/$/, ''),
    personaOwnerEmail: process.env.ATP_PERSONA_OWNER_EMAIL || '',
    personaOwnerPassword: process.env.ATP_PERSONA_OWNER_PASSWORD || '',
  };
}

export function loadCatalog() {
  const p = path.join(ATP_ROOT, 'catalog/index.json');
  if (!fs.existsSync(p)) {
    throw new Error('catalog/index.json missing — run: npm run catalog:sync');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadSuites() {
  const p = path.join(ATP_ROOT, 'catalog/suites.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Suites that share browser/API state — run sequentially. */
export const SEQUENTIAL_SUITES = [
  'sales-api-core',
  'org-api-core',
  'ui-smoke',
  'ui-platform',
  'ui-sales',
  'sales-core',
  'e2e-critical',
  'helpdesk-core',
  'async-import',
  'load-smoke',
  'load-full',
  'perf-api',
  'perf-full',
  'load-perf',
];

export function resolveSuiteCases(suiteKey, catalog, suites = loadSuites()) {
  const suite = suites[suiteKey];
  if (!suite) throw new Error(`Unknown suite: ${suiteKey}`);

  if (suite.allAutomated) {
    let entries = catalog.entries.filter((e) => e.automated);
    if (suite.excludeLayers?.length) {
      const excluded = new Set(suite.excludeLayers);
      entries = entries.filter((e) => !excluded.has(e.layer));
    }
    if (suite.excludeIdPrefixes?.length) {
      entries = entries.filter(
        (e) => !suite.excludeIdPrefixes.some((p) => e.id.startsWith(p))
      );
    }
    return entries;
  }

  const byId = new Map(catalog.entries.map((e) => [e.id, e]));
  const ordered = [];

  for (const id of suite.caseIds || []) {
    const entry = byId.get(id);
    if (entry) ordered.push(entry);
  }

  for (const prefix of suite.caseIdPrefixes || []) {
    for (const entry of catalog.entries) {
      if (entry.id.startsWith(prefix) && !ordered.some((e) => e.id === entry.id)) {
        ordered.push(entry);
      }
    }
  }

  return ordered;
}
