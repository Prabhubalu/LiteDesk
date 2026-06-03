import { defineCase, assertOk } from '../lib/httpAssert.mjs';

/** Wraps server/scripts/helpdeskSmokeChecks.js endpoints as ATP cases. */
export const e2eHelpdeskSmokeCases = [
  defineCase('TC-E2E-HD-011', async (ctx) => {
    const paths = [
      '/api/helpdesk/cases?limit=5',
      '/api/helpdesk/cases/analytics/summary',
      '/api/helpdesk/cases/analytics/trends',
    ];
    for (const path of paths) {
      const res = await ctx.authFetch('owner', path);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        throw new Error(`Helpdesk smoke failed ${path}: HTTP ${res.status}`);
      }
    }
  }),
];

/** Wraps server/scripts/quotesSmokeChecks.js (authenticated portion). */
export const e2eQuotesSmokeCases = [
  defineCase('TC-E2E-QTE-001', async (ctx) => {
    const listRes = await ctx.authFetch('owner', '/api/quotes?limit=5');
    await assertOk(listRes);
    const settingsRes = await ctx.authFetch('owner', '/api/settings/quotes');
    await assertOk(settingsRes);
    const list = await listRes.json();
    const id = list?.data?.[0]?._id;
    if (id) {
      for (const path of [`/api/quotes/${id}`, `/api/quotes/${id}/revisions`]) {
        const res = await ctx.authFetch('owner', path);
        await assertOk(res);
      }
    }
  }),
  defineCase('TC-E2E-QTE-005', async (ctx) => {
    const token = process.env.ATP_PUBLIC_QUOTE_TOKEN;
    if (!token) {
      const err = new Error('Set ATP_PUBLIC_QUOTE_TOKEN for public quote share flow');
      err.skip = true;
      throw err;
    }
    const viewRes = await ctx.fetchSut(`/api/public/quotes/${token}/view`);
    await assertOk(viewRes);
  }),
];

/** Wraps server/scripts/mailroomSmokeChecks.js (settings + evaluate). */
export const e2eMailroomSmokeCases = [
  defineCase('TC-E2E-MRM-003', async (ctx) => {
    const settingsRes = await ctx.authFetch('owner', '/api/settings/automation/mailroom');
    const settings = await settingsRes.json().catch(() => ({}));
    if (!settingsRes.ok || settings?.success === false) {
      throw new Error(`mailroom_settings failed: HTTP ${settingsRes.status}`);
    }
    const evalRes = await ctx.authFetch('owner', '/api/settings/automation/mailroom/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          channel: 'email',
          direction: 'inbound',
          subject: 'ATP mailroom evaluate',
          body: 'Policy evaluation smoke',
          participants: { from: 'atp@atp-test.local', to: ['support@atp-test.local'] },
        },
        candidates: { conversations: [], messages: [], openCases: [], recentCases: [] },
      }),
    });
    const evalBody = await evalRes.json().catch(() => ({}));
    if (!evalRes.ok || evalBody?.success === false || !evalBody?.data?.ingest) {
      throw new Error(`mailroom_evaluate failed: HTTP ${evalRes.status}`);
    }
  }),
];
