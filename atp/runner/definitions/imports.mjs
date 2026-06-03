import {
  defineCase,
  defineHttpCase,
  assertOk,
  assertOneOfStatus,
  uniqueEmail,
  readJson,
} from '../lib/httpAssert.mjs';
import { pollUntilTerminal, extractImportStatus, extractImportId } from '../lib/asyncPoll.mjs';

function contactsImportPayload(email) {
  const csv = `first_name,last_name,email\nATP,Import,${email}\n`;
  return {
    csvData: csv,
    fileName: 'atp-import.csv',
    fieldMapping: { first_name: 'first_name', last_name: 'last_name', email: 'email' },
    shouldCheckDuplicates: false,
    updateExisting: false,
  };
}

export const importCases = [
  defineHttpCase('TC-API-IMP-001', { method: 'GET', path: '/api/imports?limit=10', expectStatus: 200 }),
  defineHttpCase('TC-API-IMP-002', { method: 'GET', path: '/api/imports/stats/summary', expectStatus: 200 }),
  defineHttpCase('TC-API-CSV-005', { method: 'GET', path: '/api/csv/export/contacts', expectStatus: 200 }),

  defineCase('TC-ASYNC-004', async (ctx) => {
    const email = uniqueEmail('async-import');
    const res = await ctx.authFetch('owner', '/api/csv/import/contacts', {
      method: 'POST',
      body: JSON.stringify(contactsImportPayload(email)),
    });
    const accepted = await assertOneOfStatus(res, [200, 201, 202]);
    const importId = extractImportId(accepted);
    if (!importId) {
      throw new Error('Import response missing importId');
    }
    ctx.store.lastImportId = importId;

    const terminal = await pollUntilTerminal(async () => {
      const detailRes = await ctx.authFetch('owner', `/api/imports/${importId}`);
      const body = await readJson(detailRes);
      const status = extractImportStatus(body);
      if (!detailRes.ok && detailRes.status !== 404) {
        throw new Error(`Import poll failed: HTTP ${detailRes.status}`);
      }
      return { status, body };
    });

    if (terminal.status === 'failed') {
      throw new Error(`Import job failed: ${JSON.stringify(terminal.body?.data?.lastError || terminal.body)}`);
    }
  }),

  defineCase('TC-E2E-IMP-001', async (ctx) => {
    const id = ctx.store.lastImportId;
    if (!id) {
      const err = new Error('Run async-import suite from TC-ASYNC-004 first');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/imports/${id}`);
    const body = await assertOk(res);
    const status = extractImportStatus(body);
    if (!['completed', 'partial'].includes(status)) {
      throw new Error(`Expected completed import, got ${status}`);
    }
  }),

  defineCase('TC-API-IMP-003', async (ctx) => {
    const id = ctx.store.lastImportId;
    if (!id) {
      const err = new Error('No import id in store');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/imports/${id}`);
    await assertOk(res);
  }),

  defineCase('TC-API-IMP-004', async (ctx) => {
    const id = ctx.store.lastImportId;
    if (!id) {
      const err = new Error('No import id in store');
      err.skip = true;
      throw err;
    }
    const res = await ctx.authFetch('owner', `/api/imports/${id}/records/created?limit=5`);
    await assertOk(res);
  }),
];
