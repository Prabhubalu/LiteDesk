function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusColor(status) {
  if (status === 'passed') return '#10b981';
  if (status === 'failed') return '#ef4444';
  return '#f59e0b';
}

/**
 * @param {object} run — lean TestRun
 * @param {'executive'|'sprint'} template
 * @param {object[]} [history] — recent runs same suite
 */
export function buildReportHtml(run, template = 'executive', history = []) {
  const stats = run.stats || {};
  const passPct =
    stats.total > 0 ? Math.round((stats.passed / Math.max(stats.total - stats.skipped, 1)) * 100) : 0;
  const failed = (run.results || []).filter((r) => r.status === 'failed');
  const withMetrics = (run.results || []).filter((r) => r.metrics?.p95Ms != null || r.metrics?.latencyMs != null);
  const withTrace = (run.results || []).filter((r) => r.trace?.steps?.length);
  const title = template === 'sprint' ? 'ATP Sprint QA Report' : 'ATP Executive QA Report';

  const historyRows = history
    .map(
      (h) => `
    <tr>
      <td>${esc(h.runId?.slice(0, 8))}</td>
      <td>${esc(h.envKey)}</td>
      <td style="color:${statusColor(h.status)}">${esc(h.status)}</td>
      <td>${h.stats?.passed ?? 0}/${h.stats?.total ?? 0}</td>
      <td>${esc(h.finishedAt ? new Date(h.finishedAt).toLocaleString() : '—')}</td>
    </tr>`
    )
    .join('');

  const failRows = failed
    .map(
      (f) => `
    <tr>
      <td><code>${esc(f.caseId)}</code></td>
      <td>${esc(f.title || '')}</td>
      <td>${esc(f.error?.message || '—')}</td>
    </tr>`
    )
    .join('');

  const traceRows = withTrace
    .slice(0, 5)
    .flatMap((r) =>
      (r.trace.steps || []).slice(0, 8).map(
        (s) => `<tr>
      <td><code>${esc(r.caseId)}</code></td>
      <td>${s.step}</td>
      <td>${esc(s.kind)}</td>
      <td>${esc(s.label)}</td>
      <td>${s.durationMs}</td>
    </tr>`
      )
    )
    .join('');

  const metricRows = withMetrics
    .slice(0, 30)
    .map((r) => {
      const m = r.metrics || {};
      const p95 = m.p95Ms ?? m.latencyMs ?? '—';
      const kind = m.kind || 'api';
      return `<tr>
      <td><code>${esc(r.caseId)}</code></td>
      <td>${esc(kind)}</td>
      <td>${esc(m.path || m.label || '')}</td>
      <td>${esc(p95)}</td>
    </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)} — ${esc(run.suiteName || run.suiteKey)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; max-width: 960px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; min-width: 120px; }
    .card strong { display: block; font-size: 1.75rem; }
    .card span { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">
    Suite <strong>${esc(run.suiteName || run.suiteKey)}</strong> ·
    Env <strong>${esc(run.envKey)}</strong> ·
    Run <code>${esc(run.runId)}</code> ·
    ${run.finishedAt ? new Date(run.finishedAt).toLocaleString() : 'In progress'}
  </p>
  <div class="cards">
    <div class="card"><strong style="color:${statusColor(run.status)}">${esc(run.status)}</strong><span>Status</span></div>
    <div class="card"><strong>${passPct}%</strong><span>Pass rate</span></div>
    <div class="card"><strong>${stats.passed ?? 0}</strong><span>Passed</span></div>
    <div class="card"><strong>${stats.failed ?? 0}</strong><span>Failed</span></div>
    <div class="card"><strong>${stats.skipped ?? 0}</strong><span>Skipped</span></div>
  </div>
  ${
    template === 'sprint' && history.length
      ? `<h2>Recent runs (${esc(run.suiteKey)})</h2><table><thead><tr><th>Run</th><th>Env</th><th>Status</th><th>Stats</th><th>When</th></tr></thead><tbody>${historyRows}</tbody></table>`
      : ''
  }
  ${
    traceRows && template === 'sprint'
      ? `<h2>Execution traces (sample)</h2>
  <table><thead><tr><th>Case</th><th>#</th><th>Kind</th><th>Step</th><th>ms</th></tr></thead><tbody>${traceRows}</tbody></table>`
      : ''
  }
  ${
    metricRows
      ? `<h2>Performance highlights (${withMetrics.length})</h2>
  <table><thead><tr><th>Case</th><th>Kind</th><th>Path</th><th>p95 / last (ms)</th></tr></thead><tbody>${metricRows}</tbody></table>`
      : ''
  }
  <h2>Failures (${failed.length})</h2>
  ${
    failed.length
      ? `<table><thead><tr><th>Case</th><th>Title</th><th>Error</th></tr></thead><tbody>${failRows}</tbody></table>`
      : '<p>No failures.</p>'
  }
  <p class="meta" style="margin-top:2rem">Generated by Arivu Test Platform · Print to PDF via browser</p>
</body>
</html>`;
}

/**
 * @param {object} runA
 * @param {object} runB
 */
export function buildCompareHtml(runA, runB) {
  const byA = new Map((runA.results || []).map((r) => [r.caseId, r]));
  const byB = new Map((runB.results || []).map((r) => [r.caseId, r]));
  const ids = [...new Set([...byA.keys(), ...byB.keys()])].sort();

  const rows = ids
    .map((id) => {
      const a = byA.get(id);
      const b = byB.get(id);
      const changed = a?.status !== b?.status;
      if (!changed && a?.status === b?.status) return '';
      return `<tr>
        <td><code>${esc(id)}</code></td>
        <td>${esc(a?.status || '—')}</td>
        <td>${esc(b?.status || '—')}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>ATP Run Compare</title>
<style>body{font-family:system-ui;margin:2rem}table{border-collapse:collapse;width:100%}th,td{padding:0.5rem;border-bottom:1px solid #e2e8f0}th{background:#f8fafc}</style>
</head><body>
<h1>Environment / run diff</h1>
<p class="meta">A: ${esc(runA.envKey)} · ${esc(runA.runId?.slice(0, 8))} (${esc(runA.status)})<br/>
B: ${esc(runB.envKey)} · ${esc(runB.runId?.slice(0, 8))} (${esc(runB.status)})</p>
<table><thead><tr><th>Case</th><th>Run A</th><th>Run B</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No status changes</td></tr>'}</tbody></table>
</body></html>`;
}
