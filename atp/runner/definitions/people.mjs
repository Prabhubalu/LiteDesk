import { defineHttpCase, defineCase, assertOk, assertOneOfStatus, uid, uniqueEmail } from '../lib/httpAssert.mjs';
import { extractRecordId, extractListRows, firstRecordId } from '../lib/responseHelpers.mjs';
import { activityLogBody } from '../lib/payloads.mjs';

function salesPersonCreateBody(email) {
  return {
    appKey: 'SALES',
    role: 'Lead',
    formData: {
      first_name: 'ATP',
      last_name: `Person ${uid()}`,
      email,
    },
  };
}

export const peopleCases = [
  defineCase('TC-API-PEO-001', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/people/resolve-context', {
      method: 'POST',
      body: JSON.stringify({ appKey: 'SALES' }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/people/resolve-types', {
      method: 'POST',
      body: JSON.stringify({ appKey: 'SALES' }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-003', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/people/resolve-quick-create', {
      method: 'POST',
      body: JSON.stringify({ appKey: 'SALES' }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-004', async (ctx) => {
    const email = uniqueEmail('person');
    const res = await ctx.authFetch('owner', '/api/people/create', {
      method: 'POST',
      body: JSON.stringify(salesPersonCreateBody(email)),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.lastPersonId = extractRecordId(body);
    ctx.store.lastPersonEmail = email;
  }),
  defineCase('TC-API-PEO-013', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/people/', {
      method: 'POST',
      body: JSON.stringify({
        first_name: 'Legacy',
        last_name: `ATP ${uid()}`,
        email: uniqueEmail('legacy'),
      }),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.legacyPersonId = extractRecordId(body);
  }),
  defineHttpCase('TC-API-PEO-012', { method: 'GET', path: '/api/people/?limit=5', expectStatus: 200 }),
  defineCase('TC-API-PEO-014', async (ctx) => {
    let id = ctx.store.lastPersonId;
    if (!id) {
      const listRes = await ctx.authFetch('owner', '/api/people/?limit=1');
      const list = await assertOk(listRes);
      id = firstRecordId(list);
    }
    if (!id) {
      const err = new Error('No people records — run TC-API-PEO-004 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}`);
    await assertOk(res);
    ctx.store.lastPersonId = id;
  }),
  defineCase('TC-API-PEO-015', async (ctx) => {
    const id = ctx.store.lastPersonId;
    if (!id) {
      const err = new Error('No person id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ last_name: `Updated ${uid()}` }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-009', async (ctx) => {
    const id = ctx.store.lastPersonId;
    if (!id) {
      const err = new Error('No person id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}/profile`);
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-010', async (ctx) => {
    const id = ctx.store.lastPersonId;
    if (!id) {
      const err = new Error('No person id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}/update-core`, {
      method: 'PUT',
      body: JSON.stringify({ formData: { first_name: 'ATPUpdated' } }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-016', async (ctx) => {
    const email = uniqueEmail('trash-person');
    const createRes = await ctx.authFetch('owner', '/api/people/create', {
      method: 'POST',
      body: JSON.stringify(salesPersonCreateBody(email)),
    });
    const created = await assertStatus(createRes, [200, 201]);
    const id = extractRecordId(created);
    const delRes = await ctx.authFetch('owner', `/api/people/${id}`, { method: 'DELETE' });
    await assertOneOfStatus(delRes, [200, 204]);
  }),
  defineCase('TC-API-PEO-017', async (ctx) => {
    const id = ctx.store.lastPersonId;
    if (!id) {
      const err = new Error('No person id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}/activity-logs`);
    await assertOk(res);
  }),
  defineCase('TC-API-PEO-018', async (ctx) => {
    const id = ctx.store.lastPersonId;
    if (!id) {
      const err = new Error('No person id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}/activity-logs`, {
      method: 'POST',
      body: JSON.stringify(activityLogBody({ action: 'added a note' })),
    });
    await assertOneOfStatus(res, [200, 201]);
  }),
];
