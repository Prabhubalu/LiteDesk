/** @param {import('playwright').Page} page */
export async function expectMainContent(page) {
  await page.locator('main, [role="main"], .mx-auto, #app').first().waitFor({ state: 'visible', timeout: 20000 });
}

/** @param {import('playwright').Page} page @param {RegExp|string} urlPattern */
export async function gotoAndWait(page, urlPattern, path) {
  await page.goto(path);
  if (urlPattern instanceof RegExp) {
    await page.waitForURL(urlPattern, { timeout: 20000 });
  } else {
    await page.waitForURL((url) => url.pathname.startsWith(urlPattern), { timeout: 20000 });
  }
  await expectMainContent(page);
}

/** @param {import('playwright').Page} page */
export async function expectPlatformHome(page) {
  await page.waitForURL(/\/platform\/home/, { timeout: 20000 });
  await expectMainContent(page);
}

/** @param {import('playwright').Page} page */
export async function expectTrashPage(page) {
  await gotoAndWait(page, /\/trash/, '/trash');
  await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible' });
}

/** @param {import('playwright').Page} page */
export async function openUserMenu(page) {
  const trigger = page.locator('button').filter({ has: page.locator('img[alt], img[src*="avatar"]') }).first();
  await trigger.click({ timeout: 10000 });
}

/** @param {import('playwright').Page} page */
export async function toggleDarkMode(page) {
  await openUserMenu(page);
  const themeBtn = page.getByRole('button', { name: /dark|light|theme/i }).first();
  if (await themeBtn.isVisible().catch(() => false)) {
    await themeBtn.click();
    return;
  }
  await page.locator('text=/dark mode|light mode|appearance/i').first().click({ timeout: 5000 });
}

/** @param {import('playwright').Page} page @param {string} hrefPrefix */
export async function clickSidebarLink(page, hrefPrefix) {
  const link = page.locator(`a[href="${hrefPrefix}"], a[href^="${hrefPrefix}?"]`).first();
  await link.waitFor({ state: 'visible', timeout: 15000 });
  await link.click();
  await page.waitForURL((url) => url.pathname.startsWith(hrefPrefix), { timeout: 20000 });
}
