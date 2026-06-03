import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCase, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { MUT } from '../lib/batchHttp.mjs';

const FLEX = [200, 400, 401, 403, 404, 429, 503];
const ROUTES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage-public-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildPublicCases(routes) {
  return Object.entries(routes).map(([caseId, spec]) =>
    defineCase(caseId, async (ctx) => {
      const headers = { ...(spec.h || {}) };
      const res = await ctx.fetchSut(spec.p, {
        method: spec.m || 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: spec.m !== 'GET' ? JSON.stringify(spec.body || {}) : undefined,
      });
      await assertOneOfStatus(res, spec.s || FLEX);
    })
  );
}

export const publicCoverageGeneratedCases = buildPublicCases(loadRoutes());
