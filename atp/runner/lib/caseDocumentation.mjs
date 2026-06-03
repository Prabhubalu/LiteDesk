/**
 * Human-readable test documentation for catalog + dashboard.
 * @typedef {object} CaseDocumentation
 * @property {string} summary
 * @property {string[]} howToRun
 * @property {object} request
 * @property {object} expected
 * @property {object} onFailure
 */

export function cleanCatalogTitle(title = '') {
  return title
    .replace(/`/g, '')
    .replace(/\s*—\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTitleParts(title = '') {
  const clean = cleanCatalogTitle(title);
  const parts = clean.split(' — ').map((p) => p.trim()).filter(Boolean);
  return {
    endpoint: parts[0] || clean,
    scenario: parts[1] || '',
    outcome: parts[2] || '',
  };
}

function formatStatus(expected) {
  if (expected == null) return 'HTTP 200';
  if (Array.isArray(expected)) return `HTTP ${expected.join(' or ')}`;
  return `HTTP ${expected}`;
}

function failureBlock({ typicalError, whatToFix, likelyCauses, layer, statusHint, remediation }) {
  const steps = remediation || defaultRemediation(layer, statusHint);
  return {
    typicalError,
    whatToFix: whatToFix || likelyCauses || [],
    likelyCauses: likelyCauses || [],
    howToFix: steps,
    remediation: steps,
  };
}

function defaultRemediation(layer, statusHint) {
  const base = [
    'Confirm SUT API is running (`ATP_SUT_API_URL`, default http://localhost:3000).',
    'Verify owner credentials in `fixtures/personas.json` or `ATP_PERSONA_OWNER_*`.',
  ];
  if (layer === 'ui') {
    base.push('Confirm client is running (`ATP_SUT_CLIENT_URL`, default http://localhost:5173).');
    base.push('Run `npm run playwright:install` if the browser is missing.');
  }
  if (layer === 'public') {
    base.push('Optional tokens: copy `fixtures/public.example.json` → `fixtures/public.json`.');
  }
  if (layer === 'security' && statusHint?.includes('403')) {
    base.push('Configure a restricted `viewer` persona if testing RBAC denial.');
  }
  if (statusHint?.includes('404')) {
    base.push('Seed data may be missing — ensure the org has sample records for placeholder IDs.');
  }
  return base;
}

/**
 * @param {string} caseId
 * @param {object} catalogEntry
 * @param {object} [route]
 * @param {CaseDocumentation} [override]
 */
export function resolveSummary(caseId, catalogEntry = {}) {
  const { endpoint, scenario, outcome } = parseTitleParts(catalogEntry.title);
  const fromCells = catalogEntry.rawCells?.[2] || catalogEntry.rawCells?.[1];
  return (
    (typeof fromCells === 'string' && fromCells.trim()) ||
    [scenario, outcome].filter(Boolean).join(' — ') ||
    scenario ||
    outcome ||
    endpoint ||
    cleanCatalogTitle(catalogEntry.title) ||
    caseId
  );
}

export function buildCaseDocumentation(caseId, catalogEntry = {}, route = null, override = null) {
  if (override) {
    return {
      ...override,
      summary: override.summary || resolveSummary(caseId, catalogEntry),
    };
  }

  const layer = catalogEntry.layer || 'api';
  const summary = resolveSummary(caseId, catalogEntry);

  if (layer === 'ui') return buildUiDocumentation(caseId, catalogEntry, route, summary);
  if (layer === 'e2e') return buildE2eDocumentation(caseId, catalogEntry, route, summary);
  if (layer === 'public') return buildPublicDocumentation(caseId, catalogEntry, route, summary);
  if (layer === 'security') return buildSecurityDocumentation(caseId, catalogEntry, route, summary);
  if (layer === 'async') return buildAsyncDocumentation(caseId, catalogEntry, route, summary);
  if (layer === 'load') return buildLoadDocumentation(caseId, catalogEntry, summary);
  if (layer === 'perf') return buildPerfDocumentation(caseId, catalogEntry, summary);
  return buildApiDocumentation(caseId, catalogEntry, route, summary);
}

function buildLoadDocumentation(caseId, entry, summary) {
  const vus = process.env.ATP_LOAD_VUS || '10';
  const dur = process.env.ATP_LOAD_DURATION_SEC || '30';
  return {
    summary,
    howToRun: [
      `Concurrent load: ${vus} VUs for ${dur}s (env ATP_LOAD_VUS, ATP_LOAD_DURATION_SEC).`,
      'Do not run in PR — use nightly or manual against UAT.',
      'Unset ATP_SKIP_LOAD_TESTS to execute.',
    ],
    request: { method: 'LOAD', path: entry.rawCells?.[1] || 'see executor', auth: 'varies', body: null },
    expected: {
      status: 'metrics',
      behavior: `Error rate ≤ ${process.env.ATP_LOAD_ERROR_RATE_MAX || '0.05'}, p95 ≤ ${process.env.ATP_LOAD_P95_MS_MAX || '3000'}ms`,
    },
    onFailure: failureBlock({
      typicalError: 'p95 or error rate exceeded load thresholds',
      likelyCauses: ['DB pool exhaustion', 'CPU saturation', 'rate limiting'],
      layer: 'api',
    }),
  };
}

function buildPerfDocumentation(caseId, entry, summary) {
  return {
    summary,
    howToRun: [
      `Sequential samples: ${process.env.ATP_PERF_SAMPLES || '20'} (warmup ${process.env.ATP_PERF_WARMUP || '2'}).`,
      'Measures p50/p95/p99 for single-user latency SLA.',
    ],
    request: { method: 'PERF', path: entry.rawCells?.[1] || 'see executor', auth: 'Bearer (owner)', body: null },
    expected: {
      status: 'metrics',
      behavior: `p95 ≤ ${process.env.ATP_PERF_P95_MS_MAX || '800'}ms, p99 ≤ ${process.env.ATP_PERF_P99_MS_MAX || '1500'}ms`,
    },
    onFailure: failureBlock({
      typicalError: 'Latency percentile above perf threshold',
      likelyCauses: ['Slow query', 'cold cache', 'local dev machine noise'],
      layer: 'api',
    }),
  };
}

function buildApiDocumentation(caseId, entry, route, summary) {
  const method = route?.m || 'GET';
  const path = route?.p || parseTitleParts(entry.title).endpoint || '/api/…';
  const expected = route?.s ?? [200, 400, 403, 404];
  const statusText = formatStatus(expected);
  const body =
    method !== 'GET' && method !== 'DELETE'
      ? route?.body ?? '(minimal JSON `{}` or generator default)'
      : null;

  return {
    summary,
    howToRun: [
      'Obtain owner JWT via login (ATP uses the owner persona).',
      `Send authenticated ${method} request to \`${path}\`.`,
      placeholdersNote(path),
      `Assert response status is ${statusText}.`,
      'Smoke level: does not validate full response body shape.',
    ].filter(Boolean),
    request: {
      method,
      path,
      auth: 'Bearer token (owner persona)',
      body,
      headers: { 'Content-Type': 'application/json' },
    },
    expected: {
      status: expected,
      behavior:
        entry.rawCells?.[3] ||
        `Endpoint responds without server error; status matches smoke band (${statusText}).`,
    },
    onFailure: failureBlock({
      typicalError: `Expected one of [${[].concat(expected).join(', ')}], got <other>`,
      whatToFix: [
        `Endpoint must respond with status ${statusText} for smoke pass.`,
        'Wrong status usually means auth, routing, or missing tenant data.',
      ],
      likelyCauses: [
        'API down or `/health/ready` failing.',
        'Invalid/expired JWT or missing owner persona.',
        'Route not registered or wrong path after refactor.',
        'Missing seed record when path uses __RECORD__ / __DEAL__ placeholders.',
      ],
      layer: 'api',
      statusHint: formatStatus(expected),
    }),
  };
}

function buildUiDocumentation(caseId, entry, route, summary) {
  const path = route?.path;
  const skipped = !path || route?.mode === 'skip';

  return {
    summary,
    howToRun: skipped
      ? [
          'This catalog row has no automatable route in the title.',
          'Marked skipped at runtime — implement a hand-written Playwright flow or extend the UI generator.',
        ]
      : [
          'Playwright opens Chromium (headless unless `ATP_UI_HEADLESS=0`).',
          'Log in via UI using owner persona credentials.',
          `Navigate to client route \`${path}\` (sidebar or goto).`,
          'Wait for `domcontentloaded` and verify main content is visible (not login redirect).',
        ],
    request: {
      method: 'BROWSER',
      path: path || '(not automated)',
      auth: 'UI session (owner)',
      body: null,
      headers: null,
    },
    expected: {
      status: skipped ? 'skipped' : 'page_loaded',
      behavior: skipped
        ? 'Manual UI scenario — not executed by generated smoke.'
        : 'SPA loads target module; user remains authenticated; main layout renders.',
    },
    onFailure: failureBlock({
      typicalError: skipped ? 'No automatable route — manual UI scenario' : 'Redirected to login / main content not found',
      likelyCauses: skipped
        ? ['Title uses dynamic path (`:id`) or settings query not mapped by generator.']
        : [
            'Client not running on `ATP_SUT_CLIENT_URL`.',
            'Login failed — check personas.json.',
            'Route renamed in Vue router.',
            'Permission or entitlement hides module.',
          ],
      layer: 'ui',
    }),
  };
}

function buildE2eDocumentation(caseId, entry, route, summary) {
  const steps = route?.steps || [{ m: 'GET', p: '/api/ui/registry' }];
  const stepLines = steps.map((s, i) => `${i + 1}. ${s.m || 'GET'} ${s.p}`);

  return {
    summary,
    howToRun: [
      'E2E catalog flow — ATP proxy uses API steps (not full Playwright journey).',
      ...stepLines,
      'Each step asserts HTTP status in the allowed band.',
      'For full UI journeys see suites `e2e-critical`, `e2e-sales`, etc.',
    ],
    request: {
      method: 'MULTI',
      path: steps.map((s) => s.p).join(' → '),
      auth: 'Bearer token (owner persona)',
      body: steps.find((s) => s.m && s.m !== 'GET')?.body ?? null,
      headers: { 'Content-Type': 'application/json' },
    },
    expected: {
      status: 'per-step smoke band',
      behavior: entry.rawCells?.[3] || 'API chain completes with acceptable status codes for smoke coverage.',
    },
    onFailure: failureBlock({
      typicalError: 'Expected one of [200, 201, …], got 4xx/5xx on a step',
      likelyCauses: [
        'Upstream data missing for POST steps (e.g. helpdesk case create).',
        'Feature flag or module disabled in tenant.',
        'API contract changed vs catalog.',
      ],
      layer: 'e2e',
    }),
  };
}

function buildPublicDocumentation(caseId, entry, route, summary) {
  const method = route?.m || 'GET';
  const path = route?.p || '/api/public/…';
  const expected = route?.s ?? [200, 400, 401, 403, 404, 429, 503];

  return {
    summary,
    howToRun: [
      'No user JWT — call public/embed/webhook endpoint directly.',
      `Send ${method} \`${path}\`.`,
      route?.h ? `Include headers: ${JSON.stringify(route.h)}` : null,
      route?.body ? `Body: ${JSON.stringify(route.body)}` : null,
      `Assert status in [${[].concat(expected).join(', ')}].`,
    ].filter(Boolean),
    request: {
      method,
      path,
      auth: route?.h?.Authorization ? 'Bearer / ingest key (see headers)' : 'None (public)',
      body: route?.body ?? (method !== 'GET' ? '{}' : null),
      headers: route?.h ?? { 'Content-Type': 'application/json' },
    },
    expected: {
      status: expected,
      behavior: entry.rawCells?.[2] || 'Public contract returns expected error/success band (often 404 for invalid tokens).',
    },
    onFailure: failureBlock({
      typicalError: 'Unexpected HTTP status outside public smoke band',
      likelyCauses: [
        'Webhook signature or ingest key required but not configured in fixtures.',
        'Rate limiting (429) or service unavailable (503).',
        'Public route path changed.',
      ],
      layer: 'public',
    }),
  };
}

function buildSecurityDocumentation(caseId, entry, route, summary) {
  if (route?.kind === 'ui') {
    return {
      summary,
      howToRun: [
        `Log in as ${route.persona || 'viewer'} via Playwright.`,
        `Open \`${route.path}\`.`,
        'Verify page loads under entitlement/RBAC expectations (smoke).',
      ],
      request: {
        method: 'BROWSER',
        path: route.path,
        auth: `UI session (${route.persona || 'viewer'})`,
        body: null,
        headers: null,
      },
      expected: {
        status: 'page_loaded',
        behavior: entry.rawCells?.[2] || 'User without entitlement should not access module (manual assertion in full SEC suite).',
      },
      onFailure: failureBlock({
        typicalError: 'Configure viewer persona / redirected or forbidden UI',
        likelyCauses: ['Viewer persona missing', 'Viewer has owner-level access (test may skip in full security suite)'],
        remediation: [
          'Add restricted viewer to fixtures/personas.json.',
          'Run `npm run run:security` for deep RBAC assertions.',
        ],
        layer: 'security',
      }),
    };
  }

  const method = route?.m || 'GET';
  const path = route?.p || '/api/…';
  const expected = route?.s ?? [200, 403, 404];
  const auth = route?.auth === false ? 'None' : 'Bearer token (owner)';

  return {
    summary,
    howToRun: [
      auth === 'None' ? 'Call without JWT.' : 'Call with owner (or cross-tenant) JWT.',
      `${method} \`${path}\`.`,
      `Assert ${formatStatus(expected)}.`,
    ],
    request: { method, path, auth, body: method !== 'GET' ? '{}' : null, headers: route?.h ?? null },
    expected: {
      status: expected,
      behavior: entry.rawCells?.[2] || 'Security smoke — status band indicates deny or safe response.',
    },
    onFailure: failureBlock({
      typicalError: 'Unexpected status for security scenario',
      likelyCauses: ['Tenant isolation bug if 200 on cross-tenant ID', 'RBAC not enforced'],
      remediation: [
        ...defaultRemediation('security', formatStatus(expected)),
        'Escalate to security suite owner — do not ignore 200 on negative tests.',
      ],
      layer: 'security',
      statusHint: formatStatus(expected),
    }),
  };
}

function buildAsyncDocumentation(caseId, entry, route, summary) {
  const method = route?.m || 'GET';
  const path = route?.p || '/api/…';
  const expected = route?.s ?? (method === 'POST' ? [200, 202, 400] : [200, 400, 403, 404]);

  return {
    summary,
    howToRun: [
      'Authenticate as owner.',
      `${method} \`${path}\` (async/cron/worker smoke).`,
      `Expect ${formatStatus(expected)}.`,
      'Import polling flows: see `async-import` suite and TC-ASYNC-004.',
    ],
    request: {
      method,
      path,
      auth: 'Bearer token (owner)',
      body: method === 'POST' ? '{}' : null,
      headers: { 'Content-Type': 'application/json' },
    },
    expected: {
      status: expected,
      behavior: entry.rawCells?.[2] || 'Worker/cron endpoint reachable; job may be accepted (202) or validated (400).',
    },
    onFailure: failureBlock({
      typicalError: 'Worker or cron endpoint not reachable',
      likelyCauses: ['Background worker not running', 'Mongo/queue unavailable', 'Digest/import feature disabled'],
      remediation: [
        ...defaultRemediation('api'),
        'For import tests ensure CSV fixture and worker process on SUT.',
      ],
      layer: 'api',
    }),
  };
}

function placeholdersNote(path) {
  if (!path || !path.includes('__')) return null;
  return 'Paths with __RECORD__, __DEAL__, etc. resolve to first list item in tenant at runtime.';
}

export function buildHttpCaseDocumentation(caseId, spec, catalogEntry = {}) {
  const route = {
    m: spec.method || 'GET',
    p: typeof spec.path === 'function' ? '(dynamic)' : spec.path,
    s: spec.expectStatus,
    body: typeof spec.body === 'function' ? '(dynamic)' : spec.body,
  };
  const base = buildCaseDocumentation(caseId, catalogEntry, route, spec.documentation);
  if (spec.auth === false) {
    base.request.auth = 'None (public)';
    base.howToRun[0] = 'No JWT — public/unauthenticated request.';
  }
  return base;
}
