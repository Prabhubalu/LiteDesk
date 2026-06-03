import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { definitionsById } from './definitions/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../catalog/index.json');
const EXECUTORS_DIR = path.join(__dirname, 'executors');

/** @type {Map<string, { path: string, load: () => Promise<object> }>} */
let fileRegistryCache = null;

function loadFileRegistry(force = false) {
  if (fileRegistryCache && !force) return fileRegistryCache;

  fileRegistryCache = new Map();

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.test.mjs')) {
        fileRegistryCache.set(full, {
          path: full,
          load: () => import(pathToFileURL(full).href),
        });
      }
    }
  };

  walk(EXECUTORS_DIR);
  return fileRegistryCache;
}

export async function resolveExecutor(caseId) {
  const def = definitionsById.get(caseId);
  if (def) {
    return { mod: def, filePath: `definitions:${caseId}`, fromDefinitions: true };
  }

  const registry = loadFileRegistry();
  for (const { path: filePath, load } of registry.values()) {
    const mod = await load();
    const id = mod.caseId || mod.default?.caseId;
    if (id === caseId) {
      return { mod, filePath, fromDefinitions: false };
    }
  }
  return null;
}

/** @returns {import('./lib/caseDocumentation.mjs').CaseDocumentation|null} */
export function getCaseDocumentation(caseId) {
  const def = definitionsById.get(caseId);
  if (def?.documentation) return def.documentation;
  if (!fs.existsSync(CATALOG_PATH)) return null;
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const entry = catalog.entries?.find((e) => e.id === caseId);
  return entry?.documentation ?? null;
}

export async function listAutomatedCaseIds() {
  const ids = new Set([...definitionsById.keys()]);
  const registry = loadFileRegistry();
  for (const { load } of registry.values()) {
    const mod = await load();
    const id = mod.caseId || mod.default?.caseId;
    if (id && !definitionsById.has(id)) ids.add(id);
  }
  return [...ids].sort();
}
