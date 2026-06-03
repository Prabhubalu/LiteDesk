import { defineCase, assertOk } from '../lib/httpAssert.mjs';

export const preferenceCases = [
  defineCase('TC-API-PREF-001', async (ctx) => {
    const layout = { widgets: [{ id: 'atp-test', type: 'metrics', x: 0, y: 0 }] };
    const saveRes = await ctx.authFetch('owner', '/api/user-preferences/widget-layout', {
      method: 'POST',
      body: JSON.stringify(layout),
    });
    await assertOk(saveRes);
    const getRes = await ctx.authFetch('owner', '/api/user-preferences/widget-layout');
    await assertOk(getRes);
  }),
  defineCase('TC-API-PREF-002', async (ctx) => {
    const config = { metrics: [{ key: 'deals', enabled: true }] };
    const saveRes = await ctx.authFetch('owner', '/api/user-preferences/metrics-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    await assertOk(saveRes);
    const getRes = await ctx.authFetch('owner', '/api/user-preferences/metrics-config');
    await assertOk(getRes);
  }),
];
