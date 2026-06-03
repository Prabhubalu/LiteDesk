import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCase } from '../lib/httpAssert.mjs';
import { withAuthenticatedUi } from '../lib/uiRunner.mjs';
import { navigateToModule } from '../page-objects/NavigationPage.mjs';
import { expectMainContent } from '../page-objects/PlatformPage.mjs';

const ROUTES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage-ui-routes.json');

function loadRoutes() {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
}

function buildUiCases(routes) {
  return Object.entries(routes).map(([caseId, spec]) =>
    defineCase(caseId, async () => {
      if (!spec.path || spec.mode === 'skip') {
        const err = new Error('No automatable route — manual UI scenario');
        err.skip = true;
        throw err;
      }
      await withAuthenticatedUi(caseId, async (page) => {
        await navigateToModule(page, spec.path);
        if (page.url().includes('/login')) {
          throw new Error('Redirected to login');
        }
        await expectMainContent(page);
      });
    })
  );
}

export const uiCoverageGeneratedCases = buildUiCases(loadRoutes());
