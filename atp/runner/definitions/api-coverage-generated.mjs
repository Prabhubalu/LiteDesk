import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCase, defineHttpCase, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { MUT } from '../lib/batchHttp.mjs';
import { resolvePlaceholderPath } from '../lib/placeholderPaths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = path.join(__dirname, 'coverage-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildCasesFromRoutes(routes) {
  const cases = [];
  for (const [caseId, spec] of Object.entries(routes)) {
    const method = spec.m || 'GET';
    const expectStatus = spec.s || (method === 'GET' ? 200 : MUT);
    const pathTemplate = spec.p;

    if (pathTemplate.includes('__')) {
      cases.push(
        defineCase(caseId, async (ctx) => {
          const resolvedPath = await resolvePlaceholderPath(pathTemplate, ctx);
          const res = await ctx.authFetch('owner', resolvedPath, {
            method,
            body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify({}) : undefined,
          });
          await assertOneOfStatus(res, expectStatus);
        })
      );
    } else {
      cases.push(
        defineHttpCase(caseId, {
          method,
          path: pathTemplate,
          expectStatus,
          body: method !== 'GET' && method !== 'DELETE' ? {} : undefined,
        })
      );
    }
  }
  return cases;
}

export const apiCoverageGeneratedCases = buildCasesFromRoutes(loadRoutes());
