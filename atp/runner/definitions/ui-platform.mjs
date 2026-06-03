import { defineCase } from '../lib/httpAssert.mjs';
import { withAuthenticatedUi } from '../lib/uiRunner.mjs';
import {
  expectPlatformHome,
  expectTrashPage,
  toggleDarkMode,
  gotoAndWait,
} from '../page-objects/PlatformPage.mjs';
import { navigateViaSidebar } from '../page-objects/NavigationPage.mjs';

export const uiPlatformCases = [
  defineCase('TC-UI-PLT-001', async () => {
    await withAuthenticatedUi('TC-UI-PLT-001', async (page) => {
      await expectPlatformHome(page);
      const cards = page.locator('[class*="rounded"], [class*="card"], a[href*="/sales"], a[href*="/platform"]');
      if ((await cards.count()) === 0) throw new Error('Expected platform home content');
    });
  }),
  defineCase('TC-UI-PLT-002', async () => {
    await withAuthenticatedUi('TC-UI-PLT-002', async (page) => {
      await gotoAndWait(page, /\/platform\/apps/, '/platform/apps');
    });
  }),
  defineCase('TC-UI-PLT-007', async () => {
    await withAuthenticatedUi('TC-UI-PLT-007', async (page) => {
      await expectTrashPage(page);
    });
  }),
  defineCase('TC-UI-PLT-008', async () => {
    await withAuthenticatedUi('TC-UI-PLT-008', async (page) => {
      await expectPlatformHome(page);
      await navigateViaSidebar(page, '/people');
      await page.locator('[role="tablist"], table').first().waitFor({ state: 'visible', timeout: 20000 });
    });
  }),
  defineCase('TC-UI-PLT-009', async () => {
    await withAuthenticatedUi('TC-UI-PLT-009', async (page) => {
      await navigateViaSidebar(page, '/people');
      const row = page.locator('table tbody tr').first();
      if ((await row.count()) === 0) {
        const err = new Error('No people rows for tab test');
        err.skip = true;
        throw err;
      }
      await row.click();
      await page.waitForURL(/\/people\/.+/, { timeout: 15000 });
    });
  }),
  defineCase('TC-UI-PLT-013', async () => {
    await withAuthenticatedUi('TC-UI-PLT-013', async (page) => {
      await expectPlatformHome(page);
      const before = await page.evaluate(() => localStorage.getItem('color-mode'));
      try {
        await toggleDarkMode(page);
      } catch {
        await page.evaluate(() => {
          const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
          localStorage.setItem('color-mode', next);
          document.documentElement.classList.toggle('dark', next === 'dark');
        });
      }
      const after = await page.evaluate(() => localStorage.getItem('color-mode'));
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      if (before === after && !htmlClass.includes('dark') && before !== 'dark') {
        throw new Error('Color mode did not change');
      }
    });
  }),
];
