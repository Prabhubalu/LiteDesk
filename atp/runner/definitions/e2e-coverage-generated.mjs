import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCase, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { MUT } from '../lib/batchHttp.mjs';

const ROUTES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage-e2e-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildE2eCases(routes) {
  return Object.entries(routes).map(([caseId, spec]) =>
    defineCase(caseId, async (ctx) => {
      for (const step of spec.steps || []) {
        const res = await ctx.authFetch('owner', step.p, {
          method: step.m || 'GET',
          body: step.m !== 'GET' && step.m !== 'DELETE' ? JSON.stringify(step.body || {}) : undefined,
        });
        const expected = step.s || (step.m === 'GET' ? 200 : MUT);
        await assertOneOfStatus(res, expected);
      }
    })
  );
}

export const e2eCoverageGeneratedCases = buildE2eCases(loadRoutes());
