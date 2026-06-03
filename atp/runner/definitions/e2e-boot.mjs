import { defineE2eFlow } from '../lib/e2eFlow.mjs';
import { assertOk } from '../lib/httpAssert.mjs';

export const e2eBootCases = [
  defineE2eFlow('TC-E2E-BOOT-001', [
    {
      name: 'ui-registry',
      async run(ctx) {
        const res = await ctx.authFetch('owner', '/api/ui/registry');
        await assertOk(res);
      },
    },
    {
      name: 'ui-sidebar',
      async run(ctx) {
        const res = await ctx.authFetch('owner', '/api/ui/sidebar');
        await assertOk(res);
      },
    },
    {
      name: 'ui-routes',
      async run(ctx) {
        const res = await ctx.authFetch('owner', '/api/ui/routes');
        await assertOk(res);
      },
    },
    {
      name: 'profile',
      async run(ctx) {
        const res = await ctx.authFetch('owner', '/api/users/profile');
        await assertOk(res);
      },
    },
  ]),
];
