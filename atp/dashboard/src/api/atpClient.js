const API_KEY = import.meta.env.VITE_ATP_API_KEY || 'dev-atp-key-change-me';

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-ATP-API-Key': API_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

export const atpApi = {
  health: () => request('/atp/health'),
  overview: () => request('/atp/stats/overview'),
  goNoGo: () => request('/atp/go-no-go'),
  catalog: () => request('/atp/catalog'),
  catalogCase: (caseId) => request(`/atp/catalog/${encodeURIComponent(caseId)}`),
  suites: () => request('/atp/suites'),
  runs: (limit = 20) => request(`/atp/runs?limit=${limit}`),
  run: (runId) => request(`/atp/runs/${runId}`),
  compareRuns: (runA, runB) => request(`/atp/runs/compare?runA=${encodeURIComponent(runA)}&runB=${encodeURIComponent(runB)}`),
  schedules: () => request('/atp/schedules'),
  createSchedule: (body) => request('/atp/schedules', { method: 'POST', body: JSON.stringify(body) }),
  updateSchedule: (id, body) => request(`/atp/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSchedule: (id) => request(`/atp/schedules/${id}`, { method: 'DELETE' }),
  startRun: (body) => request('/atp/runs', { method: 'POST', body: JSON.stringify(body) }),
  executeRun: (body) => request('/atp/runs/execute', { method: 'POST', body: JSON.stringify(body) }),
};

export function subscribeRunStream(runId, onMessage) {
  const key = import.meta.env.VITE_ATP_API_KEY || 'dev-atp-key-change-me';
  const es = new EventSource(`/atp/runs/${runId}/stream?key=${encodeURIComponent(key)}`);
  es.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
  return () => es.close();
}
