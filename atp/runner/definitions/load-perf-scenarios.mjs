import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_PATH = path.join(__dirname, '../../catalog/load-perf-routes.generated.json');

/** @typedef {{ id: string, path: string, auth: boolean, label: string, method?: string, body?: object, capVus?: number, generated?: boolean, placeholder?: boolean, mutation?: boolean, public?: boolean }} LoadScenario */

/** Core smoke paths — always run first in load-smoke subset */
export const CORE_LOAD_SCENARIOS = [
  { id: '001', path: '/health/ready', auth: false, label: 'Health ready', method: 'GET' },
  { id: '002', path: '/health/live', auth: false, label: 'Health live', method: 'GET' },
  { id: '003', path: '/health/status', auth: false, label: 'Health status', method: 'GET' },
  { id: '004', path: '/api/people/?limit=20', auth: true, label: 'People list', capVus: 8, method: 'GET' },
  { id: '005', path: '/api/deals/?limit=20', auth: true, label: 'Deals list', capVus: 8, method: 'GET' },
  { id: '006', path: '/api/organization/?limit=20', auth: true, label: 'Organization (tenant)', capVus: 8, method: 'GET' },
  { id: '007', path: '/api/tasks/?limit=20', auth: true, label: 'Tasks list', capVus: 8, method: 'GET' },
  { id: '008', path: '/api/ui/registry', auth: true, label: 'UI registry', capVus: 6, method: 'GET' },
  { id: '009', path: '/api/ui/sidebar', auth: true, label: 'UI sidebar', capVus: 6, method: 'GET' },
  { id: '010', path: '/api/users/profile', auth: true, label: 'User profile', capVus: 8, method: 'GET' },
  { id: '011', path: '/api/search/?q=test&limit=10', auth: true, label: 'Global search', capVus: 5, method: 'GET' },
  { id: '012', path: '/api/helpdesk/cases?limit=20', auth: true, label: 'Helpdesk cases', capVus: 6, method: 'GET' },
  { id: '013', path: '/api/events/?limit=20', auth: true, label: 'Events list', capVus: 6, method: 'GET' },
  { id: '014', path: '/api/notifications?appKey=SALES&limit=20', auth: true, label: 'Notifications', capVus: 6, method: 'GET' },
  { id: '015', path: '/api/ui/apps', auth: true, label: 'UI apps', capVus: 6, method: 'GET' },
];

function loadGeneratedBundle() {
  if (!fs.existsSync(GENERATED_PATH)) {
    return { generated: [], placeholders: [], mutations: [], public: [] };
  }
  const data = JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf8'));
  if (Array.isArray(data.generated) && !data.placeholders) {
    return { generated: data.generated || [], placeholders: [], mutations: [], public: [] };
  }
  return {
    generated: data.generated || [],
    placeholders: data.placeholders || [],
    mutations: data.mutations || [],
    public: data.public || [],
  };
}

function scenarioKey(s) {
  return `${(s.method || 'GET').toUpperCase()}:${s.path}`;
}

/** @returns {LoadScenario[]} */
export function getAllLoadScenarios() {
  const byKey = new Map();
  const add = (s) => {
    const key = scenarioKey(s);
    if (!byKey.has(key)) byKey.set(key, { method: 'GET', ...s });
  };
  for (const s of CORE_LOAD_SCENARIOS) add(s);
  const bundle = loadGeneratedBundle();
  for (const s of [...bundle.generated, ...bundle.placeholders, ...bundle.mutations, ...bundle.public]) {
    add(s);
  }
  return [...byKey.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function getPerfScenarios() {
  return getAllLoadScenarios().map((s) => ({
    id: s.id,
    path: s.path,
    label: s.label,
    auth: s.auth,
    method: s.method,
    body: s.body,
    generated: s.generated,
    placeholder: s.placeholder,
    mutation: s.mutation,
    public: s.public,
  }));
}

export function catalogEntriesFromScenarios(scenarios = getAllLoadScenarios()) {
  const entries = [];
  const perf = getPerfScenarios();
  const sectionFor = (s) => {
    if (s.placeholder) return 'Load Testing (placeholder paths)';
    if (s.mutation) return 'Load Testing (POST)';
    if (s.public) return 'Load Testing (public)';
    return s.generated ? 'Load Testing (generated)' : 'Load Testing';
  };
  for (const s of scenarios) {
    entries.push({
      id: `TC-LOAD-${s.id}`,
      layer: 'load',
      domain: 'LOAD',
      title: `Load — ${s.label} — \`${s.path}\` —`,
      rawCells: [`TC-LOAD-${s.id}`, s.path, 'Concurrent load', 'RPS, p95, error rate'],
      section: sectionFor(s),
      automated: true,
    });
  }
  for (const s of perf) {
    entries.push({
      id: `TC-PERF-${s.id}`,
      layer: 'perf',
      domain: 'PERF',
      title: `Perf — ${s.label} — \`${s.path}\` —`,
      rawCells: [`TC-PERF-${s.id}`, s.path, 'Sequential latency', 'p50, p95, p99'],
      section: sectionFor(s).replace('Load', 'Performance'),
      automated: true,
    });
  }
  return entries;
}
