import { defineHttpCase, defineCase, assertOk, assertOneOfStatus, uid } from '../lib/httpAssert.mjs';
import { extractRecordId, firstRecordId } from '../lib/responseHelpers.mjs';
import { dealCreateBody } from '../lib/payloads.mjs';

export const dealCases = [
  defineHttpCase('TC-API-DEAL-001', { method: 'GET', path: '/api/deals/dashboard/metrics', expectStatus: 200 }),
  defineHttpCase('TC-API-DEAL-002', { method: 'GET', path: '/api/deals/pipeline/summary', expectStatus: 200 }),
  defineHttpCase('TC-API-DEAL-003', { method: 'GET', path: '/api/deals/', expectStatus: 200 }),
  defineCase('TC-API-DEAL-004', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody()),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.lastDealId = extractRecordId(body);
  }),
  defineCase('TC-API-DEAL-005', async (ctx) => {
    let id = ctx.store.lastDealId;
    if (!id) {
      const listRes = await ctx.authFetch('owner', '/api/deals/');
      const list = await assertOk(listRes);
      id = firstRecordId(list);
    }
    if (!id) {
      const err = new Error('No deals — run TC-API-DEAL-004 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/deals/${id}`);
    await assertOk(res);
    ctx.store.lastDealId = id;
  }),
  defineCase('TC-API-DEAL-006', async (ctx) => {
    const id = ctx.store.lastDealId;
    if (!id) {
      const err = new Error('No deal id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: `ATP Deal Updated ${uid()}` }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-DEAL-008', async (ctx) => {
    const id = ctx.store.lastDealId;
    if (!id) {
      const err = new Error('No deal id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Qualification' }),
    });
    await assertOneOfStatus(res, [200, 400, 404]);
  }),
  defineCase('TC-API-DEAL-007', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody({ name: `ATP Trash Deal ${uid()}`, amount: 500 })),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    const id = extractRecordId(body);
    const delRes = await ctx.authFetch('owner', `/api/deals/${id}`, { method: 'DELETE' });
    await assertOneOfStatus(delRes, [200, 204]);
  }),
  defineCase('TC-API-DEAL-012', async (ctx) => {
    const id = ctx.store.lastDealId;
    if (!id) {
      const err = new Error('No deal id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/deals/${id}/activity-logs`);
    await assertOk(res);
  }),
];
