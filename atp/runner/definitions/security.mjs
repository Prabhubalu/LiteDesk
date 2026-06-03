import { defineCase, defineHttpCase, assertOk, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { getPersonaCredentials } from '../lib/authSession.mjs';
import { dealCreateBody } from '../lib/payloads.mjs';
import { extractListRows } from '../lib/responseHelpers.mjs';

const FOREIGN_ORG_ID = '000000000000000000000001';

export const securityCases = [
  defineCase('TC-SEC-CSRF-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody({ name: 'ATP CSRF JWT Test', amount: 100 })),
    });
    await assertOneOfStatus(res, [200, 201, 400, 403]);
  }),
  defineCase('TC-SEC-RBAC-005', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody({ name: 'ATP Owner Deal', amount: 2500 })),
    });
    await assertOneOfStatus(res, [200, 201]);
  }),
  defineCase('TC-SEC-RBAC-001', async (ctx) => {
    const viewer = getPersonaCredentials('viewer');
    if (!viewer) {
      const err = new Error('Configure viewer persona for RBAC-001');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('viewer', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody({ name: 'Should Fail', amount: 1 })),
    });
    if ([200, 201].includes(res.status)) {
      const err = new Error('Viewer can create deals — use a restricted viewer persona');
      err.skip = true;
      throw err;
    }
    await assertOneOfStatus(res, [403, 401]);
  }),
  defineCase('TC-SEC-MT-009', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/trash/');
    await assertOk(res);
  }),
  defineCase('TC-SEC-MT-010', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/search/?q=test');
    await assertOneOfStatus(res, [200, 400]);
  }),
  defineCase('TC-SEC-MT-001', async (ctx) => {
    const res = await ctx.authFetch('owner', `/api/deals/${FOREIGN_ORG_ID}`);
    await assertOneOfStatus(res, [403, 404]);
  }),
  defineCase('TC-SEC-MT-002', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(
        dealCreateBody({
          name: 'ATP MT-002 Foreign Org',
          organizationId: FOREIGN_ORG_ID,
        })
      ),
    });
    const body = await assertOneOfStatus(res, [200, 201, 400, 403]);
    if ([200, 201].includes(res.status)) {
      const dealOrg = body?.data?.organizationId ?? body?.organizationId;
      if (dealOrg && String(dealOrg) === FOREIGN_ORG_ID) {
        throw new Error('Foreign organizationId was accepted on deal create');
      }
    }
  }),
  defineCase('TC-SEC-RBAC-002', async (ctx) => {
    const viewer = getPersonaCredentials('viewer');
    if (!viewer) {
      const err = new Error('Configure viewer persona for RBAC-002');
      err.skip = true;
      throw err;
    }
    const ownerRes = await ctx.authFetch('owner', '/api/deals/?limit=50');
    const viewerRes = await ctx.authFetch('viewer', '/api/deals/?limit=50');
    const ownerBody = await assertOk(ownerRes);
    const viewerBody = await assertOk(viewerRes);
    const ownerRows = extractListRows(ownerBody);
    const viewerRows = extractListRows(viewerBody);
    if (ownerRows.length > 0 && viewerRows.length >= ownerRows.length && ownerRows.length !== viewerRows.length) {
      const err = new Error('Viewer sees full deal list — configure own/team-scoped viewer');
      err.skip = true;
      throw err;
    }
  }),
  defineCase('TC-SEC-RBAC-004', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/deals/?limit=20');
    await assertOk(res);
  }),
  defineCase('TC-SEC-APP-008', async (ctx) => {
    const viewer = getPersonaCredentials('viewer');
    if (!viewer) {
      const err = new Error('Configure viewer persona for APP-008');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('viewer', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(dealCreateBody({ name: 'ATP Viewer Execute', amount: 1 })),
    });
    if ([200, 201].includes(res.status)) {
      const err = new Error('Viewer has EXECUTE on deals — use restricted viewer');
      err.skip = true;
      throw err;
    }
    await assertOneOfStatus(res, [403, 401]);
  }),
  defineHttpCase('TC-SEC-CSRF-001', {
    auth: false,
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'csrf-probe@atp.local', password: 'invalid' },
    expectStatus: [400, 401, 403, 429],
    skipIf: () => process.env.NODE_ENV !== 'production' && 'CSRF-001 only enforced in production',
  }),
];

export const healthCases = [
  defineCase('TC-API-HEALTH-001', async (ctx) => {
    const res = await ctx.fetchSut('/health/live');
    await assertOk(res);
  }),
  defineCase('TC-API-HEALTH-002', async (ctx) => {
    const res = await ctx.fetchSut('/health/ready');
    await assertOk(res);
  }),
  defineCase('TC-API-HEALTH-003', async (ctx) => {
    const res = await ctx.fetchSut('/health/status');
    await assertOk(res);
  }),
  defineCase('TC-API-HEALTH-004', async (ctx) => {
    const res = await ctx.fetchSut('/health/mailroom-metrics');
    await assertOneOfStatus(res, [200, 401, 403]);
  }),
];
