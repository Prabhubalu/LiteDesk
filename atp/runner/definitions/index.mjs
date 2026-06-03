import { authCases } from './auth.mjs';
import { userCases, roleCases, groupCases, uiCases } from './users.mjs';
import { peopleCases } from './people.mjs';
import { dealCases } from './deals.mjs';
import { taskCases } from './tasks.mjs';
import { organizationCases, configCases, trashCases, searchCases } from './organization.mjs';
import { preferenceCases } from './preferences.mjs';
import { uiAuthCases, uiPublicCases } from './ui-auth.mjs';
import { uiPlatformCases } from './ui-platform.mjs';
import { uiSalesCases, uiInboxCases } from './ui-sales.mjs';
import { securityCases, healthCases } from './security.mjs';
import { e2eBootCases } from './e2e-boot.mjs';
import { e2eSalesCases } from './e2e-sales.mjs';
import { publicCases } from './public.mjs';
import { e2eHelpdeskSmokeCases, e2eQuotesSmokeCases, e2eMailroomSmokeCases } from './e2e-wrapped.mjs';
import { importCases } from './imports.mjs';
import { asyncCronCases } from './async-cron.mjs';
import { apiModuleCases } from './api-modules.mjs';
import { apiCoverageGeneratedCases } from './api-coverage-generated.mjs';
import { uiCoverageGeneratedCases } from './ui-coverage-generated.mjs';
import { e2eCoverageGeneratedCases } from './e2e-coverage-generated.mjs';
import { publicCoverageGeneratedCases } from './public-coverage-generated.mjs';
import { securityCoverageGeneratedCases } from './security-coverage-generated.mjs';
import { asyncCoverageGeneratedCases } from './async-coverage-generated.mjs';
import { loadPerfCases } from './load-perf.mjs';

/** Hand-written executors (excludes *-coverage-generated loaders). */
export const handDefinitions = [
  ...authCases,
  ...healthCases,
  ...securityCases,
  ...userCases,
  ...roleCases,
  ...groupCases,
  ...uiCases,
  ...peopleCases,
  ...dealCases,
  ...taskCases,
  ...organizationCases,
  ...configCases,
  ...trashCases,
  ...searchCases,
  ...preferenceCases,
  ...uiAuthCases,
  ...uiPublicCases,
  ...uiPlatformCases,
  ...uiSalesCases,
  ...uiInboxCases,
  ...e2eBootCases,
  ...e2eSalesCases,
  ...publicCases,
  ...e2eHelpdeskSmokeCases,
  ...e2eQuotesSmokeCases,
  ...e2eMailroomSmokeCases,
  ...importCases,
  ...asyncCronCases,
  ...apiModuleCases,
  ...loadPerfCases,
];

/** @type {{ caseId: string, run: Function }[]} */
export const allDefinitions = [
  ...handDefinitions,
  ...apiCoverageGeneratedCases,
  ...uiCoverageGeneratedCases,
  ...e2eCoverageGeneratedCases,
  ...publicCoverageGeneratedCases,
  ...securityCoverageGeneratedCases,
  ...asyncCoverageGeneratedCases,
];

export const handDefinitionIds = new Set(handDefinitions.map((d) => d.caseId));
export const definitionsById = new Map(allDefinitions.map((d) => [d.caseId, d]));
