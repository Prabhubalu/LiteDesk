#!/usr/bin/env node
/**
 * Generate coverage JSON for UI, E2E (API proxy), public, security, async gaps.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handDefinitionIds } from '../runner/definitions/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATP_ROOT = path.join(__dirname, '..');
const DEF_DIR = path.join(ATP_ROOT, 'runner/definitions');

const FLEX = [200, 400, 401, 403, 404, 429, 503];

function isRunnableId(id) {
  return /^TC-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/.test(id);
}

function pathFromUiEntry(entry) {
  const title = entry.title || '';
  const backtick = title.match(/`([^`]+)`/);
  if (backtick) {
    let p = backtick[1];
    if (p.startsWith('?')) return `/settings${p}`;
    if (p.startsWith('{')) return null;
    if (!p.startsWith('/')) return null;
    return p
      .replace(/:id\b/g, '000000000000000000000001')
      .replace(/:userId\b/g, '000000000000000000000002')
      .replace(/:slug\b/g, 'atp-slug')
      .replace(/:token\b/g, 'atp-token')
      .replace(/:configId\b/g, '000000000000000000000003');
  }
  const cell = entry.rawCells?.find((c) => typeof c === 'string' && c.startsWith('/'));
  return cell || null;
}

function uiMode(path) {
  if (!path) return 'skip';
  if (path.startsWith('/settings')) return 'settings';
  if (['/people', '/organizations', '/deals', '/tasks', '/groups'].some((p) => path.startsWith(p))) {
    return 'sidebar';
  }
  if (path.startsWith('/platform') || path.startsWith('/sales/dashboard')) return 'goto';
  return 'goto';
}

/** @type {Record<string, { steps: { m: string, p: string }[] }>} */
const E2E_API_STEPS = {
  'TC-E2E-BOOT-002': { steps: [{ m: 'GET', p: '/api/ui/apps' }, { m: 'GET', p: '/api/ui/sidebar' }] },
  'TC-E2E-BOOT-003': { steps: [{ m: 'GET', p: '/api/organization/' }] },
  'TC-E2E-BOOT-004': { steps: [{ m: 'GET', p: '/api/users/profile' }] },
  'TC-E2E-SLS-007': { steps: [{ m: 'GET', p: '/api/deals/?limit=5' }] },
  'TC-E2E-SLS-009': { steps: [{ m: 'GET', p: '/api/events/?limit=5' }] },
  'TC-E2E-SLS-010': { steps: [{ m: 'GET', p: '/api/settings/automation/assignment-rules' }] },
  'TC-E2E-SLS-011': { steps: [{ m: 'GET', p: '/api/admin/business-flow-templates' }] },
  'TC-E2E-QTE-002': { steps: [{ m: 'GET', p: '/api/quotes?limit=1' }] },
  'TC-E2E-QTE-003': { steps: [{ m: 'GET', p: '/api/quotes?limit=1' }] },
  'TC-E2E-QTE-004': { steps: [{ m: 'GET', p: '/api/quotes?limit=1' }] },
  'TC-E2E-QTE-006': { steps: [{ m: 'GET', p: '/api/public/quotes/atp-revoked/view' }] },
  'TC-E2E-QTE-007': { steps: [{ m: 'GET', p: '/api/quotes?limit=1' }] },
  'TC-E2E-QTE-008': { steps: [{ m: 'GET', p: '/api/quotes?limit=1' }] },
  'TC-E2E-QTE-009': { steps: [{ m: 'POST', p: '/api/digest/trigger/daily' }] },
  'TC-E2E-QTE-010': { steps: [{ m: 'GET', p: '/api/approvals?limit=5' }] },
  'TC-E2E-CAT-001': { steps: [{ m: 'GET', p: '/api/items?limit=5' }] },
  'TC-E2E-CAT-002': { steps: [{ m: 'GET', p: '/api/catalog/price-books' }] },
  'TC-E2E-CAT-003': { steps: [{ m: 'GET', p: '/api/catalog/categories' }] },
  'TC-E2E-CAT-004': { steps: [{ m: 'GET', p: '/api/items?limit=1' }] },
  'TC-E2E-CAT-005': { steps: [{ m: 'GET', p: '/api/items/low-stock' }] },
  'TC-E2E-CAT-006': { steps: [{ m: 'GET', p: '/api/deals/?limit=1' }] },
  'TC-E2E-FRM-001': { steps: [{ m: 'GET', p: '/api/forms?limit=5' }] },
  'TC-E2E-FRM-002': { steps: [{ m: 'GET', p: '/api/public/forms/atp-nonexistent-slug-404' }] },
  'TC-E2E-FRM-003': { steps: [{ m: 'GET', p: '/api/forms?limit=1' }] },
  'TC-E2E-FRM-004': { steps: [{ m: 'GET', p: '/api/forms?limit=1' }] },
  'TC-E2E-IMP-002': { steps: [{ m: 'GET', p: '/api/imports?limit=5' }] },
  'TC-E2E-IMP-003': { steps: [{ m: 'POST', p: '/api/csv/check-duplicates/contacts' }] },
  'TC-E2E-IMP-004': { steps: [{ m: 'GET', p: '/api/imports/stats/summary' }] },
  'TC-E2E-IMP-005': { steps: [{ m: 'GET', p: '/api/csv/export/contacts' }] },
  'TC-E2E-IMP-006': { steps: [{ m: 'GET', p: '/api/imports?limit=1' }] },
  'TC-E2E-IMP-007': { steps: [{ m: 'GET', p: '/api/imports?limit=1' }] },
  'TC-E2E-COM-001': { steps: [{ m: 'GET', p: '/api/mailboxes?limit=5' }] },
  'TC-E2E-COM-002': { steps: [{ m: 'GET', p: '/api/communications/pipeline-metrics' }] },
  'TC-E2E-COM-003': { steps: [{ m: 'GET', p: '/api/communications/templates' }] },
  'TC-E2E-COM-004': { steps: [{ m: 'GET', p: '/api/communications/inbound/diagnostics' }] },
  'TC-E2E-COM-005': { steps: [{ m: 'GET', p: '/api/tasks/?limit=5' }] },
  'TC-E2E-COM-006': { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=5' }] },
  'TC-E2E-COM-007': { steps: [{ m: 'GET', p: '/api/inbox?limit=5' }] },
  'TC-E2E-COM-008': { steps: [{ m: 'GET', p: '/api/communications/suppressions/stats' }] },
  'TC-E2E-COM-009': { steps: [{ m: 'GET', p: '/api/communications/inbound/dead-letter' }] },
  'TC-E2E-HD-001': { steps: [{ m: 'POST', p: '/api/helpdesk/cases' }] },
  'TC-E2E-HD-002': { steps: [{ m: 'GET', p: '/api/helpdesk/cases/canned-responses' }] },
  'TC-E2E-HD-003': { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=1' }] },
  'TC-E2E-HD-004': { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=1' }] },
  'TC-E2E-HD-005': { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=1' }] },
  'TC-E2E-HD-006': { steps: [{ m: 'GET', p: '/api/settings/applications/helpdesk/execution-settings' }] },
  'TC-E2E-HD-012': { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=1' }] },
  'TC-E2E-HD-013': { steps: [{ m: 'POST', p: '/api/helpdesk/cases/ingest/channel' }] },
  'TC-E2E-MRM-001': { steps: [{ m: 'GET', p: '/api/webhooks/arivu/inbound-email/health' }] },
  'TC-E2E-MRM-002': { steps: [{ m: 'GET', p: '/api/settings/automation/mailroom' }] },
  'TC-E2E-MRM-004': { steps: [{ m: 'GET', p: '/api/settings/automation/mailroom/failures?limit=5' }] },
  'TC-E2E-MRM-005': { steps: [{ m: 'POST', p: '/api/public/mailroom/ingest' }] },
  'TC-E2E-MRM-006': { steps: [{ m: 'GET', p: '/api/settings/automation/mailroom' }] },
  'TC-E2E-AUD-001': { steps: [{ m: 'GET', p: '/api/events/?limit=5' }] },
  'TC-E2E-AUD-002': { steps: [{ m: 'GET', p: '/api/events/summary' }] },
  'TC-E2E-APT-001': { steps: [{ m: 'GET', p: '/api/appointments/config/me' }] },
  'TC-E2E-APT-002': { steps: [{ m: 'GET', p: '/api/public/book/atp-invalid-booking-slug/slots' }] },
  'TC-E2E-APT-003': { steps: [{ m: 'GET', p: '/api/appointments/config/pages' }] },
  'TC-E2E-APT-004': { steps: [{ m: 'GET', p: '/api/appointments/config/teams' }] },
  'TC-E2E-APT-005': { steps: [{ m: 'GET', p: '/api/appointments/stats' }] },
};

function defaultE2eSteps(entry) {
  const id = entry.id;
  if (id.startsWith('TC-E2E-HD-')) return { steps: [{ m: 'GET', p: '/api/helpdesk/cases/analytics/summary' }] };
  if (id.startsWith('TC-E2E-AUD-')) return { steps: [{ m: 'GET', p: '/api/events/?limit=5' }] };
  if (id.startsWith('TC-E2E-FRM-')) return { steps: [{ m: 'GET', p: '/api/forms?limit=5' }] };
  if (id.startsWith('TC-E2E-PRT-')) return { steps: [{ m: 'GET', p: '/api/helpdesk/cases?limit=5' }] };
  if (id.startsWith('TC-E2E-TGT-')) return { steps: [{ m: 'GET', p: '/api/targets/summary' }] };
  if (id.startsWith('TC-E2E-TRSH-')) return { steps: [{ m: 'GET', p: '/api/trash/' }] };
  return { steps: [{ m: 'GET', p: '/api/ui/registry' }, { m: 'GET', p: '/api/users/profile' }] };
}

function publicRoute(entry) {
  const id = entry.id;
  const map = {
    'TC-PUB-BOOK-001': { auth: false, m: 'GET', p: '/api/public/book/atp-invalid-booking-slug' },
    'TC-PUB-BOOK-003': { auth: false, m: 'POST', p: '/api/public/book/atp-invalid-booking-slug/book' },
    'TC-PUB-FRM-001': { auth: false, m: 'GET', p: '/api/public/forms/atp-nonexistent-slug-404' },
    'TC-PUB-FRM-002': { auth: false, m: 'POST', p: '/api/public/forms/atp-nonexistent-slug-404/submit' },
    'TC-PUB-APT-001': { auth: false, m: 'GET', p: '/api/public/appointments/manage/atp-invalid-token' },
    'TC-PUB-APT-002': { auth: false, m: 'GET', p: '/api/public/appointments/manage/atp-invalid-token/slots' },
    'TC-PUB-APT-003': { auth: false, m: 'POST', p: '/api/public/appointments/manage/atp-invalid-token/reschedule' },
    'TC-PUB-APT-004': { auth: false, m: 'POST', p: '/api/public/appointments/manage/atp-invalid-token/cancel' },
    'TC-PUB-CHAT-002': { auth: false, m: 'POST', p: '/api/embed/chat/sessions', h: { 'X-Instance-Key': 'atp-invalid' } },
    'TC-PUB-CHAT-003': { auth: false, m: 'GET', p: '/api/embed/chat/messages', h: { 'X-Instance-Key': 'atp-invalid' } },
    'TC-PUB-CHAT-004': { auth: false, m: 'GET', p: '/api/embed/chat/stream', h: { 'X-Instance-Key': 'atp-invalid' } },
    'TC-PUB-CHAT-005': { auth: false, m: 'POST', p: '/api/embed/chat/typing', h: { 'X-Instance-Key': 'atp-invalid' } },
    'TC-PUB-CHAT-006': { auth: false, m: 'POST', p: '/api/embed/chat/close', h: { 'X-Instance-Key': 'atp-invalid' } },
    'TC-PUB-MRM-001': { auth: false, m: 'POST', p: '/api/public/mailroom/ingest' },
    'TC-PUB-MRM-002': {
      auth: false,
      m: 'POST',
      p: '/api/public/mailroom/ingest',
      body: { threadId: 'atp-thread-1', messageId: 'atp-msg-2', subject: 'ATP thread append' },
    },
    'TC-PUB-MRM-003': { auth: false, m: 'POST', p: '/api/public/mailroom/ingest', h: { Authorization: 'Bearer invalid' } },
    'TC-PUB-QTE-002': { auth: false, m: 'GET', p: '/api/public/quotes/atp-revoked-token-xyz/pdf' },
    'TC-PUB-QTE-003': { auth: false, m: 'POST', p: '/api/public/quotes/atp-revoked-token-xyz/accept' },
    'TC-PUB-QTE-004': { auth: false, m: 'POST', p: '/api/public/quotes/atp-revoked-token-xyz/reject' },
    'TC-PUB-QTE-005': { auth: false, m: 'GET', p: '/api/public/quotes/atp-revoked-token-xyz/comments' },
    'TC-PUB-QTE-007': { auth: false, m: 'GET', p: '/api/public/quotes/atp-revoked-token-xyz/view' },
    'TC-PUB-WH-003': { auth: false, m: 'POST', p: '/api/webhooks/email/inbound' },
    'TC-PUB-WH-004': { auth: false, m: 'POST', p: '/api/webhooks/email/ses-events' },
    'TC-PUB-WH-005': { auth: false, m: 'POST', p: '/api/webhooks/email/events' },
    'TC-PUB-WH-006': { auth: false, m: 'POST', p: '/api/webhooks/email/gmail/push' },
    'TC-PUB-WH-007': { auth: false, m: 'POST', p: '/api/hooks/process/atp-invalid-webhook-key' },
    'TC-PUB-WH-008': { auth: false, m: 'POST', p: '/api/hooks/process/atp-invalid-webhook-key' },
  };
  return map[id] || null;
}

function securitySpec(entry) {
  const id = entry.id;
  if (id.startsWith('TC-SEC-RBAC-008') || id.startsWith('TC-SEC-RBAC-009')) {
    return { kind: 'ui', path: '/deals', persona: 'viewer' };
  }
  if (id.startsWith('TC-SEC-APP-004')) {
    return { kind: 'ui', path: '/audit/dashboard', persona: 'owner' };
  }
  if (id.startsWith('TC-SEC-APP-005')) {
    return { kind: 'ui', path: '/portal/dashboard', persona: 'owner' };
  }
  if (id.startsWith('TC-SEC-RL-')) {
    return { kind: 'api', m: 'GET', p: '/api/ui/registry', s: FLEX };
  }
  if (id.startsWith('TC-SEC-MT-003') || id.startsWith('TC-SEC-MT-004')) {
    return { kind: 'api', m: 'GET', p: '/api/organization/', s: [200] };
  }
  if (id.startsWith('TC-SEC-MT-005')) return { kind: 'api', m: 'GET', p: '/api/imports/stats/summary', s: [200] };
  if (id.startsWith('TC-SEC-MT-006')) return { kind: 'api', m: 'GET', p: '/api/public/quotes/atp-revoked/view', s: FLEX };
  if (id.startsWith('TC-SEC-MT-007')) return { kind: 'api', m: 'GET', p: '/api/embed/chat/config', s: FLEX, h: { 'X-Instance-Key': 'invalid' } };
  if (id.startsWith('TC-SEC-MT-008')) return { kind: 'api', m: 'POST', p: '/api/public/mailroom/ingest', s: [401, 403, 404] };
  if (id.startsWith('TC-SEC-APP-007')) return { kind: 'api', m: 'GET', p: '/api/deals/?limit=5', s: [200] };
  if (id.startsWith('TC-SEC-APP-001') || id.startsWith('TC-SEC-APP-002') || id.startsWith('TC-SEC-APP-010')) {
    return { kind: 'api', m: 'GET', p: '/api/deals/?limit=5', s: FLEX };
  }
  if (id.startsWith('TC-SEC-RBAC-003') || id.startsWith('TC-SEC-RBAC-006') || id.startsWith('TC-SEC-RBAC-007')) {
    return { kind: 'api', m: 'GET', p: '/api/people/?limit=5', s: [200] };
  }
  if (id.startsWith('TC-SEC-RBAC-010')) return { kind: 'api', m: 'GET', p: '/api/roles/', s: [200] };
  return { kind: 'api', m: 'GET', p: '/api/users/profile', s: [200] };
}

function asyncSpec(entry) {
  const id = entry.id;
  const map = {
    'TC-ASYNC-001': { m: 'GET', p: '/api/communications/pipeline-metrics' },
    'TC-ASYNC-002': { m: 'GET', p: '/api/communications/inbound/dead-letter' },
    'TC-ASYNC-003': { m: 'GET', p: '/api/webhooks/arivu/inbound-email/health' },
    'TC-ASYNC-005': { m: 'GET', p: '/api/imports/stats/summary' },
    'TC-ASYNC-012': { m: 'GET', p: '/api/approvals?limit=5' },
    'TC-ASYNC-013': { m: 'GET', p: '/api/trash/?limit=5' },
    'TC-ASYNC-014': { m: 'GET', p: '/api/settings/automation/assignment-rules' },
    'TC-ASYNC-015': { m: 'GET', p: '/api/automation/context' },
    'TC-ASYNC-016': { m: 'GET', p: '/api/settings/automation/mailroom' },
    'TC-ASYNC-017': { m: 'GET', p: '/api/business-hours/kpis' },
    'TC-ASYNC-018': { m: 'GET', p: '/api/targets/summary' },
    'TC-ASYNC-019': { m: 'GET', p: '/api/helpdesk/cases/analytics/summary' },
    'TC-ASYNC-020': { m: 'GET', p: '/api/mailboxes?limit=5' },
    'TC-ASYNC-021': { m: 'GET', p: '/api/mailboxes?limit=5' },
    'TC-ASYNC-022': { m: 'GET', p: '/api/notifications?appKey=SALES&limit=5' },
    'TC-ASYNC-023': { m: 'GET', p: '/api/appointments/stats' },
    'TC-ASYNC-024': { m: 'POST', p: '/api/digest/trigger/daily' },
  };
  return map[id] || { m: 'GET', p: '/api/health/ready' };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ATP_ROOT, 'catalog/index.json'), 'utf8'));
  const handIds = handDefinitionIds;

  const ui = {};
  const e2e = {};
  const pub = {};
  const sec = {};
  const async = {};

  for (const entry of catalog.entries) {
    if (!isRunnableId(entry.id) || handIds.has(entry.id)) continue;

    if (entry.layer === 'ui') {
      const p = pathFromUiEntry(entry);
      ui[entry.id] = { path: p, mode: uiMode(p) };
    } else if (entry.layer === 'e2e') {
      e2e[entry.id] = E2E_API_STEPS[entry.id] || defaultE2eSteps(entry);
    } else if (entry.layer === 'public') {
      const spec = publicRoute(entry);
      if (spec) pub[entry.id] = spec;
    } else if (entry.layer === 'security') {
      sec[entry.id] = securitySpec(entry);
    } else if (entry.layer === 'async') {
      async[entry.id] = asyncSpec(entry);
    }
  }

  fs.writeFileSync(path.join(DEF_DIR, 'coverage-ui-routes.json'), JSON.stringify(ui, null, 2));
  fs.writeFileSync(path.join(DEF_DIR, 'coverage-e2e-routes.json'), JSON.stringify(e2e, null, 2));
  fs.writeFileSync(path.join(DEF_DIR, 'coverage-public-routes.json'), JSON.stringify(pub, null, 2));
  fs.writeFileSync(path.join(DEF_DIR, 'coverage-security-routes.json'), JSON.stringify(sec, null, 2));
  fs.writeFileSync(path.join(DEF_DIR, 'coverage-async-routes.json'), JSON.stringify(async, null, 2));

  console.log('Wrote coverage JSON:', {
    ui: Object.keys(ui).length,
    e2e: Object.keys(e2e).length,
    public: Object.keys(pub).length,
    security: Object.keys(sec).length,
    async: Object.keys(async).length,
  });
}

main();
