import { defineHttpCase, defineCase, assertOk, assertOneOfStatus, uid } from '../lib/httpAssert.mjs';
import { extractRecordId, firstRecordId } from '../lib/responseHelpers.mjs';
import { activityLogBody } from '../lib/payloads.mjs';

export const organizationCases = [
  defineHttpCase('TC-API-ORG-001', { method: 'GET', path: '/api/organization/', expectStatus: 200 }),
  defineHttpCase('TC-API-ORG-003', { method: 'GET', path: '/api/organization/stats', expectStatus: 200 }),
  defineHttpCase('TC-API-ORG-004', { method: 'GET', path: '/api/organization/subscription', expectStatus: 200 }),
  defineHttpCase('TC-API-ORGV2-002', { method: 'GET', path: '/api/v2/organization/', expectStatus: 200 }),
  defineCase('TC-API-ORGV2-001', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/v2/organization/', {
      method: 'POST',
      body: JSON.stringify({
        name: `ATP Account ${uid()}`,
        types: ['Customer'],
      }),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.lastCompanyId = extractRecordId(body);
  }),
  defineCase('TC-API-ORGV2-003', async (ctx) => {
    let id = ctx.store.lastCompanyId;
    if (!id) {
      const listRes = await ctx.authFetch('owner', '/api/v2/organization/');
      const list = await assertOk(listRes);
      id = firstRecordId(list);
    }
    if (!id) {
      const err = new Error('No company account');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/v2/organization/${id}`);
    await assertOk(res);
    ctx.store.lastCompanyId = id;
  }),
  defineCase('TC-API-ORGV2-006', async (ctx) => {
    const id = ctx.store.lastCompanyId;
    if (!id) {
      const err = new Error('No company id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/v2/organization/${id}/surface`);
    await assertOk(res);
  }),
  defineCase('TC-API-ORGV2-004', async (ctx) => {
    const id = ctx.store.lastCompanyId;
    if (!id) {
      const err = new Error('No company id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/v2/organization/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: `ATP Account Updated ${uid()}` }),
    });
    await assertOk(res);
  }),
  defineCase('TC-API-ORGV2-007', async (ctx) => {
    const id = ctx.store.lastCompanyId;
    if (!id) {
      const err = new Error('No company id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/v2/organization/${id}/activity-logs`);
    await assertOk(res);
  }),
  defineCase('TC-API-ORGV2-008', async (ctx) => {
    const id = ctx.store.lastCompanyId;
    if (!id) {
      const err = new Error('No company id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/v2/organization/${id}/activity-logs`, {
      method: 'POST',
      body: JSON.stringify(activityLogBody({ action: 'added a note' })),
    });
    await assertOneOfStatus(res, [200, 201]);
  }),
  defineHttpCase('TC-API-ORGS-005', {
    method: 'GET',
    path: (ctx) => `/api/organizations/${ctx.store.lastCompanyId}/surface`,
    skipIf: (ctx) => !ctx.store.lastCompanyId && 'Requires TC-API-ORGV2-001',
    expectStatus: 200,
  }),
  defineCase('TC-API-ORG-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/organization/', {
      method: 'PUT',
      body: JSON.stringify({ name: `ATP Tenant ${uid()}` }),
    });
    await assertOneOfStatus(res, [200, 400, 403]);
  }),
  defineHttpCase('TC-API-ORGS-002', {
    method: 'GET',
    path: (ctx) => `/api/organizations/${ctx.store.lastCompanyId || 'skip'}`,
    skipIf: (ctx) => !ctx.store.lastCompanyId && 'Requires TC-API-ORGV2-001',
    expectStatus: 200,
  }),
];

export const configCases = [
  defineHttpCase('TC-API-CFG-001', { method: 'GET', path: '/api/config-registry/entity-types/people', expectStatus: 200 }),
  defineHttpCase('TC-API-CFG-004', { method: 'GET', path: '/api/config-registry/pipelines', expectStatus: 200 }),
  defineHttpCase('TC-API-CFG-007', { method: 'GET', path: '/api/config-registry/configuration/people', expectStatus: 200 }),
  defineHttpCase('TC-API-CFG-008', { method: 'GET', path: '/api/config-registry/configuration', expectStatus: 200 }),
];

export const trashCases = [
  defineHttpCase('TC-API-TRSH-001', { method: 'GET', path: '/api/trash/stats', expectStatus: 200 }),
  defineHttpCase('TC-API-TRSH-002', { method: 'GET', path: '/api/trash/', expectStatus: 200 }),
];

export const searchCases = [
  defineCase('TC-API-SRCH-001', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/search/?q=test');
    await assertOneOfStatus(res, [200, 400]);
  }),
];
