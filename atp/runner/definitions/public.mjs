import { defineHttpCase, defineCase, assertOk, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { getPublicFixture } from '../lib/publicFixtures.mjs';

export const publicCases = [
  defineHttpCase('TC-PUB-FRM-003', {
    auth: false,
    method: 'GET',
    path: '/api/public/forms/atp-nonexistent-slug-404',
    expectStatus: 404,
  }),
  defineHttpCase('TC-PUB-BOOK-002', {
    auth: false,
    method: 'GET',
    path: '/api/public/book/atp-invalid-booking-slug/slots',
    expectStatus: 404,
  }),
  defineHttpCase('TC-PUB-WH-001', {
    auth: false,
    method: 'GET',
    path: '/api/webhooks/arivu/inbound-email/health',
    expectStatus: 200,
    assertBody: (body) => {
      if (body?.ok !== true) throw new Error('Expected ok:true in webhook health');
    },
  }),
  defineCase('TC-PUB-WH-002', async (ctx) => {
    const payload = JSON.stringify({
      event: 'email.received',
      messageId: 'atp-msg-1',
      tenantId: 'atp-tenant',
      mailboxId: 'atp-mailbox',
    });
    const res = await ctx.fetchSut('/api/webhooks/arivu/inbound-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arivu-Signature': 'sha256=invalid-atp-signature',
      },
      body: payload,
    });
    await assertOneOfStatus(res, [401, 400, 503]);
  }),
  defineCase('TC-PUB-CHAT-007', async (ctx) => {
    const res = await ctx.fetchSut('/api/embed/chat/config', {
      headers: { 'X-Instance-Key': 'atp-invalid-instance-key' },
    });
    await assertOneOfStatus(res, [401, 403, 404]);
  }),
  defineCase('TC-PUB-CHAT-001', async (ctx) => {
    const key = getPublicFixture('ATP_EMBED_INSTANCE_KEY');
    if (!key) {
      const err = new Error('Set ATP_EMBED_INSTANCE_KEY or fixtures/public.json');
      err.skip = true;
      throw err;
    }
    const res = await ctx.fetchSut('/api/embed/chat/config', {
      headers: { 'X-Instance-Key': key },
    });
    await assertOk(res);
  }),
  defineCase('TC-PUB-QTE-001', async (ctx) => {
    const token = getPublicFixture('ATP_PUBLIC_QUOTE_TOKEN');
    if (!token) {
      const err = new Error('Set ATP_PUBLIC_QUOTE_TOKEN for public quote view');
      err.skip = true;
      throw err;
    }
    const res = await ctx.fetchSut(`/api/public/quotes/${token}/view`);
    await assertOk(res);
  }),
  defineCase('TC-PUB-QTE-006', async (ctx) => {
    const res = await ctx.fetchSut('/api/public/quotes/atp-revoked-token-xyz/view');
    await assertOneOfStatus(res, [404, 400, 410]);
  }),
  defineHttpCase('TC-PUB-APT-005', {
    auth: false,
    method: 'GET',
    path: '/api/public/appointments/manage/atp-invalid-token',
    expectStatus: 404,
  }),
];
