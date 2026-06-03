import { defineCase, assertOk, assertOneOfStatus, uid } from '../lib/httpAssert.mjs';
import { extractRecordId, firstRecordId } from '../lib/responseHelpers.mjs';

export const taskCases = [
  defineCase('TC-API-TASK-001', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/tasks/stats/summary');
    await assertOk(res);
  }),
  defineCase('TC-API-TASK-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/tasks/summary');
    await assertOk(res);
  }),
  defineCase('TC-API-TASK-003', async (ctx) => {
    const listRes = await ctx.authFetch('owner', '/api/tasks/');
    await assertOk(listRes);
    const createRes = await ctx.authFetch('owner', '/api/tasks/', {
      method: 'POST',
      body: JSON.stringify({
        title: `ATP Task ${uid()}`,
        status: 'todo',
        priority: 'medium',
      }),
    });
    const body = await assertOneOfStatus(createRes, [200, 201]);
    ctx.store.lastTaskId = extractRecordId(body);
  }),
  defineCase('TC-API-TASK-004', async (ctx) => {
    let id = ctx.store.lastTaskId;
    if (!id) {
      const createRes = await ctx.authFetch('owner', '/api/tasks/', {
        method: 'POST',
        body: JSON.stringify({ title: `ATP Task ${uid()}`, status: 'todo' }),
      });
      const body = await assertOneOfStatus(createRes, [200, 201]);
      id = extractRecordId(body);
    }
    const getRes = await ctx.authFetch('owner', `/api/tasks/${id}`);
    await assertOk(getRes);
    const putRes = await ctx.authFetch('owner', `/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: `ATP Task Updated ${uid()}` }),
    });
    await assertOk(putRes);
    ctx.store.lastTaskId = id;
  }),
  defineCase('TC-API-TASK-005', async (ctx) => {
    const id = ctx.store.lastTaskId;
    if (!id) {
      const err = new Error('No task id — run TC-API-TASK-003 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    });
    await assertOneOfStatus(res, [200, 400]);
  }),
  defineCase('TC-API-TASK-013', async (ctx) => {
    const id = ctx.store.lastTaskId;
    if (!id) {
      const err = new Error('No task id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/tasks/${id}/activity-logs`);
    await assertOk(res);
  }),
  defineCase('TC-API-TASK-011', async (ctx) => {
    const id = ctx.store.lastTaskId;
    if (!id) {
      const err = new Error('No task id');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/tasks/${id}/description-versions`);
    await assertOneOfStatus(res, [200, 404]);
  }),
];
