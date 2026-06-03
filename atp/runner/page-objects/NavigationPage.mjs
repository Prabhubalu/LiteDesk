import { expectMainContent } from './PlatformPage.mjs';

/** @param {import('playwright').Page} page */
export async function ensurePlatformHome(page) {
  if (!page.url().includes('/platform/home')) {
    await page.goto('/platform/home');
    await page.waitForURL(/\/platform\/home/, { timeout: 20000 });
  }
  await expectMainContent(page);
  await page.locator('a[href="/deals"], a[href="/people"], a[href="/dashboard/sales"]').first().waitFor({
    state: 'visible',
    timeout: 20000,
  });
}

/**
 * SPA cold `page.goto(module)` redirects to platform home — use sidebar links.
 * @param {import('playwright').Page} page
 * @param {string} href — e.g. `/people`, `/deals`
 */
export async function navigateViaSidebar(page, href) {
  const path = href.split('?')[0];
  await ensurePlatformHome(page);
  const link = page.locator(`a[href="${path}"], a[href^="${path}?"]`).first();
  if ((await link.count()) === 0) {
    throw new Error(`Sidebar link not found for ${path}`);
  }
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(path), { timeout: 20000 });
}

/** @param {import('playwright').Page} page */
export async function navigateToSalesDashboard(page) {
  await ensurePlatformHome(page);
  const link = page.locator('a[href="/dashboard/sales"], a[href="/sales/dashboard"]').first();
  if ((await link.count()) === 0) {
    throw new Error('Sales dashboard link not found on platform home');
  }
  await link.click();
  await page.waitForURL(/\/(sales\/dashboard|dashboard\/sales)/, { timeout: 20000 });
}

/** @param {import('playwright').Page} page @param {string} path */
export async function navigateToModule(page, path) {
  const base = path.split('?')[0];
  if (['/people', '/organizations', '/deals', '/tasks'].includes(base)) {
    await navigateViaSidebar(page, base);
    if (path.includes('?')) {
      await page.goto(path);
      await page.waitForURL((url) => url.pathname.startsWith(base), { timeout: 15000 });
    }
    return;
  }
  if (base === '/sales/dashboard') {
    await navigateToSalesDashboard(page);
    return;
  }
  if (base === '/groups') {
    await navigateViaSidebar(page, '/people');
    await page.goto('/groups');
    const ok = await page.waitForURL(/\/groups/, { timeout: 5000 }).then(() => true).catch(() => false);
    if (!ok) {
      const err = new Error('Groups route unavailable in this tenant nav');
      err.skip = true;
      throw err;
    }
    return;
  }
  await page.goto(path);
  await page.waitForURL((url) => url.pathname.startsWith(base), { timeout: 20000 });
}

/** @param {import('playwright').Page} page @param {RegExp} nameRe */
export async function clickPrimaryCreate(page, nameRe = /new|create/i) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
}
