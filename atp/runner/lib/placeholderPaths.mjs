import { assertOk } from './httpAssert.mjs';
import { firstRecordId } from './responseHelpers.mjs';

const PLACEHOLDER_RESOLVERS = {
  __RECORD__: async (ctx) => {
    if (ctx.store.coveragePersonId) return ctx.store.coveragePersonId;
    const res = await ctx.authFetch('owner', '/api/people/?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coveragePersonId = id;
    return id;
  },
  __CASE__: async (ctx) => {
    if (ctx.store.coverageCaseId) return ctx.store.coverageCaseId;
    const res = await ctx.authFetch('owner', '/api/helpdesk/cases?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageCaseId = id;
    return id;
  },
  __QUOTE__: async (ctx) => {
    if (ctx.store.coverageQuoteId) return ctx.store.coverageQuoteId;
    const res = await ctx.authFetch('owner', '/api/quotes?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageQuoteId = id;
    return id;
  },
  __FORM__: async (ctx) => {
    if (ctx.store.coverageFormId) return ctx.store.coverageFormId;
    const res = await ctx.authFetch('owner', '/api/forms?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageFormId = id;
    return id;
  },
  __EVENT__: async (ctx) => {
    if (ctx.store.coverageEventId) return ctx.store.coverageEventId;
    const res = await ctx.authFetch('owner', '/api/events/?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageEventId = id;
    return id;
  },
  __DEAL__: async (ctx) => {
    if (ctx.store.coverageDealId) return ctx.store.coverageDealId;
    const res = await ctx.authFetch('owner', '/api/deals/?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageDealId = id;
    return id;
  },
  __SCH__: async (ctx) => {
    if (ctx.store.coverageSchId) return ctx.store.coverageSchId;
    const res = await ctx.authFetch('owner', '/api/scheduling/?limit=1');
    const body = await assertOk(res);
    const id = firstRecordId(body);
    if (id) ctx.store.coverageSchId = id;
    return id;
  },
  __IMPORT__: async (ctx) => {
    if (ctx.store.lastImportId) return ctx.store.lastImportId;
    const res = await ctx.authFetch('owner', '/api/imports?limit=1');
    const body = await assertOk(res);
    return firstRecordId(body);
  },
};

export async function resolvePlaceholderPath(template, ctx) {
  let resolved = template;
  const tokens = [...template.matchAll(/__(RECORD|CASE|QUOTE|FORM|EVENT|DEAL|SCH|IMPORT)__/g)];
  for (const match of tokens) {
    const key = `__${match[1]}__`;
    const resolver = PLACEHOLDER_RESOLVERS[key];
    const id = resolver ? await resolver(ctx) : null;
    if (!id) {
      const err = new Error(`No record for placeholder ${key}`);
      err.skip = true;
      throw err;
    }
    resolved = resolved.replace(key, id);
  }
  return resolved;
}

export function pathHasPlaceholder(path) {
  return /__\w+__/.test(path);
}
