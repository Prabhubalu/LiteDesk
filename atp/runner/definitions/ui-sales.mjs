import { defineCase } from '../lib/httpAssert.mjs';
import { withAuthenticatedUi } from '../lib/uiRunner.mjs';
import {
  expectSalesDashboard,
  expectPeopleList,
  expectPeopleCreateForm,
  expectOrganizationsList,
  expectOrganizationsCreate,
  expectTasksList,
  expectGroupsList,
} from '../page-objects/SalesModulePage.mjs';
import {
  expectDealsKanbanAndListToggle,
  gotoDeals,
  openFirstDealCard,
} from '../page-objects/DealsPage.mjs';
import { gotoAndWait } from '../page-objects/PlatformPage.mjs';
import { navigateViaSidebar } from '../page-objects/NavigationPage.mjs';

export const uiSalesCases = [
  defineCase('TC-UI-SLS-001', async () => {
    await withAuthenticatedUi('TC-UI-SLS-001', async (page) => {
      await expectSalesDashboard(page);
    });
  }),
  defineCase('TC-UI-SLS-002', async () => {
    await withAuthenticatedUi('TC-UI-SLS-002', async (page) => {
      await expectPeopleList(page);
    });
  }),
  defineCase('TC-UI-SLS-003', async () => {
    await withAuthenticatedUi('TC-UI-SLS-003', async (page) => {
      await expectPeopleCreateForm(page);
    });
  }),
  defineCase('TC-UI-SLS-004', async () => {
    await withAuthenticatedUi('TC-UI-SLS-004', async (page) => {
      await navigateViaSidebar(page, '/people');
      const row = page.locator('table tbody tr').first();
      if ((await row.count()) === 0) {
        const err = new Error('No people records');
        err.skip = true;
        throw err;
      }
      await row.click();
      await page.waitForURL(/\/people\/[^/]+/, { timeout: 15000 });
    });
  }),
  defineCase('TC-UI-SLS-005', async () => {
    await withAuthenticatedUi('TC-UI-SLS-005', async (page) => {
      await expectOrganizationsList(page);
    });
  }),
  defineCase('TC-UI-SLS-006', async () => {
    await withAuthenticatedUi('TC-UI-SLS-006', async (page) => {
      await expectOrganizationsCreate(page);
    });
  }),
  defineCase('TC-UI-SLS-007', async () => {
    await withAuthenticatedUi('TC-UI-SLS-007', async (page) => {
      await navigateViaSidebar(page, '/organizations');
      const row = page.locator('table tbody tr').first();
      if ((await row.count()) === 0) {
        const err = new Error('No organization records');
        err.skip = true;
        throw err;
      }
      await row.click();
      await page.waitForURL(/\/organizations\/[^/]+/, { timeout: 15000 });
    });
  }),
  defineCase('TC-UI-SLS-009', async () => {
    await withAuthenticatedUi('TC-UI-SLS-009', async (page) => {
      await expectDealsKanbanAndListToggle(page);
    });
  }),
  defineCase('TC-UI-SLS-010', async () => {
    await withAuthenticatedUi('TC-UI-SLS-010', async (page) => {
      await gotoDeals(page);
      await openFirstDealCard(page);
      await page.waitForURL(/\/deals\/[^/]+/, { timeout: 15000 });
    });
  }),
  defineCase('TC-UI-SLS-011', async () => {
    await withAuthenticatedUi('TC-UI-SLS-011', async (page) => {
      await expectTasksList(page);
    });
  }),
  defineCase('TC-UI-SLS-012', async () => {
    await withAuthenticatedUi('TC-UI-SLS-012', async (page) => {
      await navigateViaSidebar(page, '/tasks');
      const row = page.locator('table tbody tr, .kanban-board [draggable="true"]').first();
      if ((await row.count()) === 0) {
        const err = new Error('No tasks');
        err.skip = true;
        throw err;
      }
      await row.click();
      await page.waitForURL(/\/tasks\/[^/]+/, { timeout: 15000 });
    });
  }),
  defineCase('TC-UI-SLS-032', async () => {
    await withAuthenticatedUi('TC-UI-SLS-032', async (page) => {
      await expectGroupsList(page);
    });
  }),
  defineCase('TC-UI-SLS-033', async () => {
    await withAuthenticatedUi('TC-UI-SLS-033', async (page) => {
      const { navigateToModule } = await import('../page-objects/NavigationPage.mjs');
      await navigateToModule(page, '/groups');
      const row = page.locator('table tbody tr').first();
      if ((await row.count()) === 0) {
        const err = new Error('No groups');
        err.skip = true;
        throw err;
      }
      await row.click();
      await page.waitForURL(/\/groups\/[^/]+/, { timeout: 15000 });
    });
  }),
];

export const uiInboxCases = [
  defineCase('TC-UI-PLT-004', async () => {
    await withAuthenticatedUi('TC-UI-PLT-004', async (page) => {
      await gotoAndWait(page, /\/inbox/, '/inbox');
    });
  }),
  defineCase('TC-UI-PLT-005', async () => {
    await withAuthenticatedUi('TC-UI-PLT-005', async (page) => {
      await gotoAndWait(page, /\/approvals/, '/approvals');
    });
  }),
];
