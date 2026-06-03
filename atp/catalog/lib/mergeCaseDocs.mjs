import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCaseDocumentation } from '../../runner/lib/caseDocumentation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATP_ROOT = path.join(__dirname, '../..');
const DEF_DIR = path.join(ATP_ROOT, 'runner/definitions');
const OVERRIDES_PATH = path.join(ATP_ROOT, 'fixtures/case-docs-overrides.json');
const CASE_DOCS_PATH = path.join(__dirname, '../case-docs.json');

const COVERAGE_FILES = {
  api: 'coverage-routes.json',
  ui: 'coverage-ui-routes.json',
  e2e: 'coverage-e2e-routes.json',
  public: 'coverage-public-routes.json',
  security: 'coverage-security-routes.json',
  async: 'coverage-async-routes.json',
};

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadRouteMap() {
  const byId = {};
  for (const [, file] of Object.entries(COVERAGE_FILES)) {
    const data = loadJson(path.join(DEF_DIR, file));
    Object.assign(byId, data);
  }
  return byId;
}

function loadOverrides() {
  return loadJson(OVERRIDES_PATH);
}

/**
 * Build documentation map for all catalog entries.
 * @param {object} catalog
 * @returns {Record<string, object>}
 */
export async function buildDocumentationMap(catalog) {
  const routes = loadRouteMap();
  const overrides = loadOverrides();
  const docs = {};

  for (const entry of catalog.entries) {
    const route = routes[entry.id] || null;
    const override = overrides[entry.id] || null;
    docs[entry.id] = buildCaseDocumentation(entry.id, entry, route, override);
  }

  return docs;
}

/**
 * Attach `documentation` to each catalog entry; optionally write case-docs.json.
 * @param {object} catalog
 * @param {{ writeFile?: boolean }} [opts]
 */
export async function attachDocumentation(catalog, opts = {}) {
  const docs = await buildDocumentationMap(catalog);
  for (const entry of catalog.entries) {
    entry.documentation = docs[entry.id] || null;
  }
  if (opts.writeFile !== false) {
    fs.writeFileSync(CASE_DOCS_PATH, `${JSON.stringify(docs, null, 2)}\n`);
  }
  return catalog;
}
