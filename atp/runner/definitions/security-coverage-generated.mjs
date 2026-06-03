import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCase, assertOneOfStatus } from '../lib/httpAssert.mjs';
import { withAuthenticatedUi } from '../lib/uiRunner.mjs';
import { getPersonaCredentials } from '../lib/authSession.mjs';

const ROUTES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage-security-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildSecurityCases(routes) {
  return Object.entries(routes).map(([caseId, spec]) => {
    if (spec.kind === 'ui') {
      return defineCase(caseId, async () => {
        const persona = spec.persona || 'viewer';
        if (persona === 'viewer' && !getPersonaCredentials('viewer')) {
          const err = new Error('Configure viewer persona');
          err.skip = true;
          throw err;
        }
        await withAuthenticatedUi(
          caseId,
          async (page) => {
            await page.goto(spec.path || '/deals');
            await page.waitForLoadState('domcontentloaded');
          },
          persona === 'viewer' ? 'viewer' : 'owner'
        );
      });
    }
    return defineCase(caseId, async (ctx) => {
      const res = spec.auth === false
        ? await ctx.fetchSut(spec.p, {
            method: spec.m || 'GET',
            headers: { 'Content-Type': 'application/json', ...(spec.h || {}) },
          })
        : await ctx.authFetch('owner', spec.p, {
            method: spec.m || 'GET',
            body: spec.m !== 'GET' ? JSON.stringify({}) : undefined,
          });
      await assertOneOfStatus(res, spec.s || [200, 403, 404]);
    });
  });
}

export const securityCoverageGeneratedCases = buildSecurityCases(loadRoutes());
