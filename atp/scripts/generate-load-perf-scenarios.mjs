#!/usr/bin/env node
/**
 * Expand load/perf scenarios from coverage-routes.json:
 * - static GET paths
 * - GET paths with __PLACEHOLDER__ (resolved at runtime)
 * - static POST paths (light mutation load)
 * - public unauthenticated GET paths
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_LOAD_SCENARIOS, catalogEntriesFromScenarios, getAllLoadScenarios } from '../runner/definitions/load-perf-scenarios.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = path.join(__dirname, '../runner/definitions/coverage-routes.json');
const OUT_ROUTES = path.join(__dirname, '../catalog/load-perf-routes.generated.json');
const OUT_CATALOG = path.join(__dirname, '../catalog/perf-catalog.json');

const PUBLIC_LOAD_PATHS = [
  { id: 'U001', path: '/health/ready', label: 'Public health ready' },
  { id: 'U002', path: '/health/live', label: 'Public health live' },
  { id: 'U003', path: '/api/auth/test-version', label: 'Auth test version' },
];

function labelFromPath(p) {
  const clean = p.replace(/\?.*$/, '').replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  return parts.slice(-2).join(' ') || clean;
}

function authForPath(p) {
  return !p.startsWith('/health') && !p.startsWith('/api/auth/test');
}

function capVusForPath(p, mutation = false) {
  if (mutation) return 2;
  if (p.startsWith('/health')) return 12;
  if (p.includes('/search')) return 4;
  if (p.startsWith('/api/admin')) return 3;
  return 6;
}

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildGeneratedFromCoverage() {
  const routes = loadRoutes();
  const corePaths = new Set(CORE_LOAD_SCENARIOS.map((s) => s.path));
  const generated = [];
  const placeholders = [];
  const mutations = [];
  const seenGet = new Set(corePaths);
  const seenPh = new Set();
  const seenMut = new Set();

  const pathMap = new Map();
  for (const [, spec] of Object.entries(routes)) {
    const m = (spec.m || 'GET').toUpperCase();
    const p = spec.p;
    if (!p) continue;
    if (m === 'GET' && !p.includes('__') && !corePaths.has(p)) {
      pathMap.set(p, spec);
    }
  }

  const paths = [...pathMap.keys()].sort();
  let n = CORE_LOAD_SCENARIOS.length + 1;
  for (const p of paths) {
    seenGet.add(p);
    const id = String(n++).padStart(3, '0');
    generated.push({
      id,
      path: p,
      method: 'GET',
      auth: authForPath(p),
      label: labelFromPath(p),
      capVus: capVusForPath(p),
      generated: true,
    });
  }

  let pi = 1;
  for (const [, spec] of Object.entries(routes)) {
    const m = (spec.m || 'GET').toUpperCase();
    const p = spec.p;
    if (m !== 'GET' || !p?.includes('__')) continue;
    if (seenPh.has(p)) continue;
    seenPh.add(p);
    placeholders.push({
      id: `P${String(pi++).padStart(3, '0')}`,
      path: p,
      method: 'GET',
      auth: true,
      label: `Placeholder ${labelFromPath(p)}`,
      capVus: 3,
      placeholder: true,
      generated: true,
    });
  }

  let mi = 1;
  for (const [, spec] of Object.entries(routes)) {
    const m = (spec.m || 'GET').toUpperCase();
    const p = spec.p;
    if (m !== 'POST' || !p || p.includes('__')) continue;
    if (seenMut.has(p)) continue;
    seenMut.add(p);
    mutations.push({
      id: `M${String(mi++).padStart(3, '0')}`,
      path: p,
      method: 'POST',
      auth: authForPath(p),
      label: `POST ${labelFromPath(p)}`,
      capVus: capVusForPath(p, true),
      mutation: true,
      body: {},
      generated: true,
    });
  }

  const publicScenarios = PUBLIC_LOAD_PATHS.map((s) => ({
    ...s,
    method: 'GET',
    auth: false,
    capVus: 8,
    public: true,
    generated: true,
  }));

  return { generated, placeholders, mutations, public: publicScenarios };
}

function main() {
  const { generated, placeholders, mutations, public: publicScenarios } = buildGeneratedFromCoverage();
  const payload = {
    generated,
    placeholders,
    mutations,
    public: publicScenarios,
    generatedAt: new Date().toISOString(),
    counts: {
      generated: generated.length,
      placeholders: placeholders.length,
      mutations: mutations.length,
      public: publicScenarios.length,
    },
  };
  fs.writeFileSync(OUT_ROUTES, `${JSON.stringify(payload, null, 2)}\n`);

  const all = getAllLoadScenarios();
  const catalog = { entries: catalogEntriesFromScenarios(all) };
  fs.writeFileSync(OUT_CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);

  console.log('Wrote', OUT_ROUTES, payload.counts);
  console.log('Wrote', OUT_CATALOG, `(${catalog.entries.length} catalog entries)`);
  console.log('Total load scenarios:', all.length, '(perf mirrors load)');
}

main();
