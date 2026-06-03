import { defineHttpCase, defineCase, assertOk, assertOneOfStatus, uid, uniqueEmail } from '../lib/httpAssert.mjs';

export const userCases = [
  defineHttpCase('TC-API-USER-001', { method: 'GET', path: '/api/users/profile', expectStatus: 200 }),
  defineHttpCase('TC-API-USER-007', { method: 'GET', path: '/api/users/list', expectStatus: 200 }),
  defineHttpCase('TC-API-USER-008', { method: 'GET', path: '/api/users/add-capabilities', expectStatus: 200 }),
  defineHttpCase('TC-API-USER-009', { method: 'GET', path: '/api/users/', expectStatus: 200 }),
  defineCase('TC-API-USER-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName: 'ATP', lastName: `User ${uid()}` }),
    });
    await assertOk(res, { request: { method: 'PUT', path: '/api/users/profile' } });
  }),
];

export const roleCases = [
  defineHttpCase('TC-API-ROLE-001', { method: 'GET', path: '/api/roles/modules', expectStatus: 200 }),
  defineHttpCase('TC-API-ROLE-002', { method: 'GET', path: '/api/roles/hierarchy', expectStatus: 200 }),
  defineHttpCase('TC-API-ROLE-003', { method: 'GET', path: '/api/roles/', expectStatus: 200 }),
  defineCase('TC-API-ROLE-004', async (ctx) => {
    const listRes = await ctx.authFetch('owner', '/api/roles/');
    const list = await assertOk(listRes);
    const first = Array.isArray(list) ? list[0] : list?.roles?.[0] || list?.data?.[0];
    const roleId = first?._id || first?.id;
    if (!roleId) {
      const err = new Error('No roles to fetch detail');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/roles/${roleId}`);
    await assertOk(res);
  }),
];

export const groupCases = [
  defineCase('TC-API-GRP-001', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/groups/', {
      method: 'POST',
      body: JSON.stringify({ name: `ATP Group ${uid()}`, description: 'ATP test group' }),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.lastGroupId = body?._id || body?.group?._id || body?.data?._id;
  }),
  defineHttpCase('TC-API-GRP-002', { method: 'GET', path: '/api/groups/', expectStatus: 200 }),
  defineCase('TC-API-GRP-003', async (ctx) => {
    const listRes = await ctx.authFetch('owner', '/api/groups/');
    const list = await assertOk(listRes);
    const first = Array.isArray(list) ? list[0] : list?.groups?.[0] || list?.data?.[0];
    const id = ctx.store.lastGroupId || first?._id;
    if (!id) {
      const err = new Error('No groups available');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/groups/${id}`);
    await assertOk(res);
  }),
];

export const uiCases = [
  defineHttpCase('TC-API-UI-001', { method: 'GET', path: '/api/ui/registry', expectStatus: 200 }),
  defineHttpCase('TC-API-UI-002', { method: 'GET', path: '/api/ui/apps', expectStatus: 200 }),
  defineHttpCase('TC-API-UI-003', { method: 'GET', path: '/api/ui/sidebar', expectStatus: 200 }),
  defineHttpCase('TC-API-UI-004', { method: 'GET', path: '/api/ui/routes', expectStatus: 200 }),
];
