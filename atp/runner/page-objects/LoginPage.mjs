/** @param {import('playwright').Page} page */
export async function submitLogin(page) {
  await page.locator('form button[type="submit"]').click();
}

/** @param {import('playwright').Page} page */
export async function expectLoginError(page) {
  await page.locator('form .error').waitFor({ state: 'visible', timeout: 10000 });
}

/** @param {import('playwright').Page} page */
export async function expectOnLoginPage(page) {
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

/** @param {import('playwright').Page} page */
export async function expectAuthenticatedShell(page) {
  await page.waitForURL(/\/platform\/home/, { timeout: 20000 });
  const user = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
  if (!user?.token) {
    throw new Error('Expected authenticated session in localStorage');
  }
}

/** @param {import('playwright').Page} page */
export async function logoutViaStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    sessionStorage.clear();
  });
  await page.goto('/login');
  await expectOnLoginPage(page);
}
