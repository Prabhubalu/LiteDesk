import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineHttpCase } from '../lib/httpAssert.mjs';
import { FLEX } from '../lib/batchHttp.mjs';

const ROUTES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage-async-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildAsyncCases(routes) {
  return Object.entries(routes).map(([caseId, spec]) =>
    defineHttpCase(caseId, {
      method: spec.m || 'GET',
      path: spec.p,
      expectStatus: spec.s || (spec.m === 'POST' ? [200, 202, 400] : FLEX),
      body: spec.m === 'POST' ? {} : undefined,
    })
  );
}

export const asyncCoverageGeneratedCases = buildAsyncCases(loadRoutes());
