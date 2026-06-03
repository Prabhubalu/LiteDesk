import { defineHttpCase, defineCase, assertOk, assertOneOfStatus } from '../lib/httpAssert.mjs';

/** Manual cron triggers exposed for UAT (digest, etc.). */
export const asyncCronCases = [
  defineCase('TC-ASYNC-010', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/digest/trigger/daily', { method: 'POST', body: '{}' });
    await assertOneOfStatus(res, [200, 202]);
  }),
  defineCase('TC-ASYNC-011', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/digest/trigger/weekly', { method: 'POST', body: '{}' });
    await assertOneOfStatus(res, [200, 202]);
  }),
];
