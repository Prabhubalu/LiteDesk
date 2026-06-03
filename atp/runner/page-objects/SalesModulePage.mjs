import { navigateToModule, clickPrimaryCreate } from './NavigationPage.mjs';

/** @param {import('playwright').Page} page */
export async function waitForAppReady(page) {
  await page.waitForFunction(
    () => {
      const app = document.querySelector('#app');
      return app && (app.innerText?.length ?? 0) > 50;
    },
    { timeout: 30000 },
  );
}

/** @param {import('playwright').Page} page */
export async function expectPeopleList(page) {
  await navigateToModule(page, '/people');
  await page.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 20000 });
}

/** @param {import('playwright').Page} page */
export async function expectOrganizationsList(page) {
  await navigateToModule(page, '/organizations');
  await page.locator('table, h1').first().waitFor({ state: 'visible', timeout: 20000 });
}

/** @param {import('playwright').Page} page */
export async function expectPeopleCreateForm(page) {
  await navigateToModule(page, '/people');
  await clickPrimaryCreate(page);
  await page.locator('[role="dialog"][aria-modal="true"]').first().waitFor({ state: 'attached', timeout: 10000 });
}

/** @param {import('playwright').Page} page */
export async function expectOrganizationsCreate(page) {
  await navigateToModule(page, '/organizations');
  await clickPrimaryCreate(page);
  await page.locator('[role="dialog"][aria-modal="true"]').first().waitFor({ state: 'attached', timeout: 10000 });
}

/** @param {import('playwright').Page} page */
export async function expectTasksList(page) {
  await navigateToModule(page, '/tasks');
  await page.locator('table, .kanban-board, [data-view]').first().waitFor({ state: 'visible', timeout: 20000 });
}

/** @param {import('playwright').Page} page */
export async function expectGroupsList(page) {
  await navigateToModule(page, '/groups');
  await page.locator('h1, table, [table-id="groups-table"]').first().waitFor({ state: 'visible', timeout: 20000 });
}

/** @param {import('playwright').Page} page */
export async function expectSalesDashboard(page) {
  await navigateToModule(page, '/sales/dashboard');
  await waitForAppReady(page);
}
