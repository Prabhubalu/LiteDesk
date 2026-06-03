import { defineHttpCase, defineCase, assertOk, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { extractRecordId, firstRecordId } from '../lib/responseHelpers.mjs';

export const apiModuleCases = [
  defineHttpCase('TC-API-EVT-001', { method: 'GET', path: '/api/events/summary', expectStatus: 200 }),
  defineHttpCase('TC-API-EVT-002', { method: 'GET', path: '/api/events/?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-EVT-003', { method: 'GET', path: '/api/events/stats', expectStatus: 200 }),
  defineHttpCase('TC-API-QTE-001', { method: 'GET', path: '/api/quotes?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-COM-005', { method: 'GET', path: '/api/communications/pipeline-metrics', expectStatus: 200 }),
  defineHttpCase('TC-API-COM-006', { method: 'GET', path: '/api/communications/pipeline-diagnostics', expectStatus: 200 }),
  defineHttpCase('TC-API-COM-010', { method: 'GET', path: '/api/communications/suppressions/stats', expectStatus: 200 }),
  defineCase('TC-API-COM-013', async (ctx) => {
    const peopleRes = await ctx.authFetch('owner', '/api/people/?limit=1');
    const people = await assertOk(peopleRes);
    const personId = firstRecordId(people);
    if (!personId) {
      const err = new Error('No people record for communications threads');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch(
      'owner',
      `/api/communications/threads?moduleKey=people&recordId=${personId}`
    );
    await assertOneOfStatus(res, [200, 400]);
    if (res.status === 400) {
      const err = new Error('Communications threads not available for this org');
      err.skip = true;
      throw err;
    }
  }),
  defineHttpCase('TC-API-NOT-001', {
    method: 'GET',
    path: '/api/notifications?appKey=SALES&limit=5',
    expectStatus: 200,
  }),
  defineHttpCase('TC-API-NOT-002', {
    method: 'GET',
    path: '/api/notifications?appKey=SALES&unreadOnly=true&limit=5',
    expectStatus: 200,
  }),
  defineHttpCase('TC-API-CASE-001', { method: 'GET', path: '/api/helpdesk/cases?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-CASE-009', { method: 'GET', path: '/api/helpdesk/cases/analytics/summary', expectStatus: 200 }),
  defineHttpCase('TC-API-CASE-010', { method: 'GET', path: '/api/helpdesk/cases/analytics/trends', expectStatus: 200 }),
  defineHttpCase('TC-API-ADM-007', { method: 'GET', path: '/api/admin/business-flow-templates', expectStatus: 200 }),
  defineHttpCase('TC-API-ITEM-004', { method: 'GET', path: '/api/items?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-CAT-001', { method: 'GET', path: '/api/catalog/price-books', expectStatus: 200 }),
  defineHttpCase('TC-API-RPT-001', { method: 'GET', path: '/api/reports?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-FRM-001', { method: 'GET', path: '/api/forms?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-INBOX-001', { method: 'GET', path: '/api/inbox?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-BOX-001', { method: 'GET', path: '/api/mailboxes?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-BH-001', { method: 'GET', path: '/api/business-hours/sets', expectStatus: 200 }),
  defineHttpCase('TC-API-SCH-001', { method: 'GET', path: '/api/scheduling/?limit=5', expectStatus: 200 }),
  defineHttpCase('TC-API-APT-001', { method: 'GET', path: '/api/appointments/stats', expectStatus: 200 }),
  defineHttpCase('TC-API-SET-001', { method: 'GET', path: '/api/settings/quotes', expectStatus: 200 }),

  defineCase('TC-API-QTE-002', async (ctx) => {
    const listRes = await ctx.authFetch('owner', '/api/quotes?limit=1');
    const list = await assertOk(listRes);
    const id = firstRecordId(list);
    if (!id) {
      const err = new Error('No quotes in org — create one for QTE-002');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/quotes/${id}`);
    await assertOk(res);
    ctx.store.lastQuoteId = id;
  }),

  defineCase('TC-API-QTE-003', async (ctx) => {
    const id = ctx.store.lastQuoteId;
    if (!id) {
      const err = new Error('Run TC-API-QTE-002 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/quotes/${id}/revisions`);
    await assertOk(res);
  }),
];
