import { navigateToModule } from './NavigationPage.mjs';

/** @param {import('playwright').Page} page */
export async function gotoDeals(page) {
  await navigateToModule(page, '/deals?view=kanban');
}

/** @param {import('playwright').Page} page */
export async function expectKanbanView(page) {
  await page.locator('.kanban-board').waitFor({ state: 'visible', timeout: 30000 });
}

/** @param {import('playwright').Page} page */
export async function expectListView(page) {
  await page.waitForURL((url) => url.searchParams.get('view') === 'list', { timeout: 15000 });
}

/** @param {import('playwright').Page} page @param {'list'|'kanban'} mode */
export async function switchDealsView(page, mode) {
  const current = new URL(page.url());
  current.searchParams.set('view', mode);
  await page.goto(`${current.pathname}?${current.searchParams.toString()}`);
  await page.waitForURL((url) => url.searchParams.get('view') === mode, { timeout: 15000 });
  if (mode === 'kanban') await expectKanbanView(page);
}

/** @param {import('playwright').Page} page */
export async function expectDealsKanbanAndListToggle(page) {
  await gotoDeals(page);
  await expectKanbanView(page);
  await switchDealsView(page, 'list');
  await switchDealsView(page, 'kanban');
}

/** @param {import('playwright').Page} page */
export async function openFirstDealCard(page) {
  if (await page.locator('.kanban-board').isVisible()) {
    const cards = page.locator('.kanban-board [draggable="true"], .kanban-board .cursor-pointer');
    if ((await cards.count()) === 0) {
      const err = new Error('No deal cards in kanban');
      err.skip = true;
      throw err;
    }
    await cards.first().click();
  } else {
    const row = page.locator('table tbody tr').first();
    if ((await row.count()) === 0) {
      const err = new Error('No deals to open');
      err.skip = true;
      throw err;
    }
    await row.click();
  }
  await page.waitForURL(/\/deals\/[^/?#]+/, { timeout: 15000 });
}
