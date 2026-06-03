import { randomUUID } from 'node:crypto';

export class ApiTestError extends Error {
  constructor(message, { request, response } = {}) {
    super(message);
    this.name = 'ApiTestError';
    this.request = request;
    this.response = response;
  }
}

export async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text };
  }
}

export async function assertStatus(res, expected, ctx = {}) {
  const body = await readJson(res.clone());
  if (res.status !== expected) {
    throw new ApiTestError(`Expected HTTP ${expected}, got ${res.status}`, {
      request: ctx.request,
      response: { status: res.status, body },
    });
  }
  return body;
}

export async function assertOk(res, ctx = {}) {
  return assertStatus(res, 200, ctx);
}

export async function assertOneOfStatus(res, expectedList, ctx = {}) {
  const body = await readJson(res.clone());
  if (!expectedList.includes(res.status)) {
    throw new ApiTestError(`Expected one of [${expectedList.join(', ')}], got ${res.status}`, {
      request: ctx.request,
      response: { status: res.status, body },
    });
  }
  return body;
}

export function uid(prefix = 'atp') {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function uniqueEmail(prefix = 'atp') {
  return `${prefix}-${randomUUID().slice(0, 8)}@atp-test.local`;
}

/**
 * @param {string} caseId
 * @param {object} spec
 * @param {boolean} [spec.auth=true]
 * @param {string} [spec.persona='owner']
 * @param {string} spec.method
 * @param {string} spec.path
 * @param {object|function} [spec.body]
 * @param {number|number[]} spec.expectStatus
 * @param {(body: object, ctx: object) => void} [spec.assertBody]
 * @param {() => boolean|string|null} [spec.skipIf] — true or string reason
 */
export function defineHttpCase(caseId, spec) {
  return {
    caseId,
    documentation: spec.documentation || null,
    async run(ctx) {
      const skip = typeof spec.skipIf === 'function' ? spec.skipIf(ctx) : spec.skipIf;
      if (skip) {
        const msg = typeof skip === 'string' ? skip : 'Skipped by skipIf';
        const err = new Error(msg);
        err.skip = true;
        throw err;
      }

      const method = spec.method || 'GET';
      const path = typeof spec.path === 'function' ? spec.path(ctx) : spec.path;
      const bodyVal = typeof spec.body === 'function' ? spec.body(ctx) : spec.body;
      const requestMeta = { method, path, persona: spec.persona || 'owner' };

      let res;
      if (spec.auth === false) {
        res = await ctx.fetchSut(path, {
          method,
          body: bodyVal !== undefined ? JSON.stringify(bodyVal) : undefined,
        });
      } else {
        res = await ctx.authFetch(spec.persona || 'owner', path, {
          method,
          body: bodyVal !== undefined ? JSON.stringify(bodyVal) : undefined,
        });
      }

      const expected = spec.expectStatus ?? 200;
      const responseBody = Array.isArray(expected)
        ? await assertOneOfStatus(res, expected, { request: requestMeta })
        : await assertStatus(res, expected, { request: requestMeta });

      if (spec.assertBody) {
        spec.assertBody(responseBody, ctx);
      }

      if (spec.storeAs) {
        ctx.store[spec.storeAs] = responseBody;
      }
    },
  };
}

/**
 * @param {string} caseId
 * @param {(ctx: import('../context.mjs').RunContext) => Promise<void>} fn
 * @param {object} [meta]
 * @param {import('./caseDocumentation.mjs').CaseDocumentation} [meta.documentation]
 */
export function defineCase(caseId, fn, meta = {}) {
  return { caseId, documentation: meta.documentation || null, run: fn };
}
