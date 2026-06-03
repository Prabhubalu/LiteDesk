import { defineE2eFlow, e2eStep } from '../lib/e2eFlow.mjs';
import { defineCase, assertOk, assertOneOfStatus, uid, uniqueEmail } from '../lib/httpAssert.mjs';
import { extractRecordId } from '../lib/responseHelpers.mjs';
import { dealCreateBody, activityLogBody } from '../lib/payloads.mjs';

function salesPersonCreateBody(email) {
  return {
    appKey: 'SALES',
    role: 'Lead',
    formData: {
      first_name: 'ATP',
      last_name: `Lead ${uid()}`,
      email,
    },
  };
}

export const e2eSalesCases = [
  defineE2eFlow('TC-E2E-SLS-001', [
    {
      name: 'create-lead',
      async run(ctx) {
        const email = uniqueEmail('e2e-lead');
        const res = await ctx.authFetch('owner', '/api/people/create', {
          method: 'POST',
          body: JSON.stringify(salesPersonCreateBody(email)),
        });
        const body = await assertOneOfStatus(res, [200, 201]);
        ctx.store.e2eLeadId = extractRecordId(body);
        ctx.store.e2eLeadEmail = email;
      },
    },
    {
      name: 'activity-log',
      async run(ctx) {
        const id = ctx.store.e2eLeadId;
        if (!id) throw new Error('Missing e2eLeadId from create-lead step');
        const res = await ctx.authFetch('owner', `/api/people/${id}/activity-logs`, {
          method: 'POST',
          body: JSON.stringify(activityLogBody({ action: 'qualified lead in ATP' })),
        });
        await assertOneOfStatus(res, [200, 201]);
      },
    },
  ]),

  defineCase('TC-E2E-SLS-003', async (ctx) => {
    const id = ctx.store.e2eLeadId;
    if (!id) {
      const err = new Error('Run e2e-critical from TC-E2E-SLS-001 — needs e2eLeadId');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/people/${id}/convert-lead-to-contact`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await assertOneOfStatus(res, [200, 201, 400]);
    ctx.store.e2eContactId = id;
  }),

  defineCase('TC-E2E-SLS-004', async (ctx) => {
    const res = await ctx.authFetch('owner', '/api/v2/organization/', {
      method: 'POST',
      body: JSON.stringify({ name: `ATP E2E Account ${uid()}`, types: ['Customer'] }),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.e2eAccountId = extractRecordId(body);
  }),

  defineCase('TC-E2E-SLS-005', async (ctx) => {
    const personId = ctx.store.e2eContactId || ctx.store.e2eLeadId;
    const accountId = ctx.store.e2eAccountId;
    const payload = dealCreateBody({ name: `ATP E2E Deal ${uid()}` });
    if (personId) payload.contactId = personId;
    if (accountId) payload.accountId = accountId;
    const res = await ctx.authFetch('owner', '/api/deals/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const body = await assertOneOfStatus(res, [200, 201]);
    ctx.store.e2eDealId = extractRecordId(body);
  }),

  defineCase('TC-E2E-SLS-006', async (ctx) => {
    const id = ctx.store.e2eDealId;
    if (!id) {
      const err = new Error('Run TC-E2E-SLS-005 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Qualification' }),
    });
    await assertOneOfStatus(res, [200, 400]);
  }),

  defineCase('TC-E2E-SLS-008', async (ctx) => {
    const dealId = ctx.store.e2eDealId;
    if (!dealId) {
      const err = new Error('Run TC-E2E-SLS-005 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', '/api/tasks/', {
      method: 'POST',
      body: JSON.stringify({
        title: `ATP E2E Task ${uid()}`,
        status: 'todo',
        relatedTo: { module: 'deals', id: dealId },
      }),
    });
    await assertOneOfStatus(res, [200, 201]);
  }),

  defineE2eFlow('TC-E2E-SLS-002', [
    {
      name: 'qualify-lead',
      async run(ctx) {
        await e2eStep(ctx, 'ensure-lead', async (c) => {
          if (c.store.e2eLeadId) return;
          const email = uniqueEmail('e2e-qual');
          const res = await c.authFetch('owner', '/api/people/create', {
            method: 'POST',
            body: JSON.stringify(salesPersonCreateBody(email)),
          });
          const body = await assertOneOfStatus(res, [200, 201]);
          c.store.e2eLeadId = extractRecordId(body);
        });
        const res = await ctx.authFetch('owner', `/api/people/${ctx.store.e2eLeadId}`, {
          method: 'PUT',
          body: JSON.stringify({ last_name: `Qualified ${uid()}` }),
        });
        await assertOk(res);
      },
    },
  ]),
];
