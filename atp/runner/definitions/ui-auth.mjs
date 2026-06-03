import { defineCase } from '../lib/httpAssert.mjs';
import { withUiCase } from '../lib/uiRunner.mjs';
import {
  fillLoginForm,
  loginViaUi,
  readStoredUser,
  readRedirectAfterLogin,
} from '../lib/uiSession.mjs';
import {
  submitLogin,
  expectLoginError,
  expectOnLoginPage,
  expectAuthenticatedShell,
  logoutViaStorage,
} from '../page-objects/LoginPage.mjs';

export const uiAuthCases = [
  defineCase('TC-UI-AUTH-001', async () => {
    await withUiCase('TC-UI-AUTH-001', async (page) => {
      await loginViaUi(page, 'owner');
      await expectAuthenticatedShell(page);
      const user = await readStoredUser(page);
      if (!user?.email) throw new Error('User email missing from session');
    });
  }),
  defineCase('TC-UI-AUTH-002', async () => {
    await withUiCase('TC-UI-AUTH-002', async (page) => {
      await page.goto('/login');
      await page.locator('#email').fill('invalid-atp@atp-test.local');
      await page.locator('#password').fill('wrong-password-xyz');
      await submitLogin(page);
      await expectLoginError(page);
      await expectOnLoginPage(page);
      const user = await readStoredUser(page);
      if (user?.token) throw new Error('Unexpected session token after failed login');
    });
  }),
  defineCase('TC-UI-AUTH-003', async () => {
    await withUiCase('TC-UI-AUTH-003', async (page) => {
      await page.goto('/deals');
      await expectOnLoginPage(page);
      const saved = await readRedirectAfterLogin(page);
      if (!saved || !saved.includes('/deals')) {
        throw new Error(`Expected saved redirect to /deals, got: ${saved}`);
      }
      await fillLoginForm(page, 'owner');
      await submitLogin(page);
      await page.waitForURL(/\/(platform\/home|deals)/, { timeout: 20000 });
      const user = await readStoredUser(page);
      if (!user?.token) throw new Error('Expected session after protected-route login');
    });
  }),
  defineCase('TC-UI-AUTH-004', async () => {
    await withUiCase('TC-UI-AUTH-004', async (page) => {
      await loginViaUi(page, 'owner');
      await logoutViaStorage(page);
      const user = await readStoredUser(page);
      if (user?.token) throw new Error('Token should be cleared after logout');
      await page.goto('/platform/home');
      await expectOnLoginPage(page);
    });
  }),
  defineCase('TC-UI-AUTH-005', async () => {
    await withUiCase('TC-UI-AUTH-005', async (page) => {
      await loginViaUi(page, 'owner');
      await page.locator('nav, [role="navigation"], header').first().waitFor({ state: 'visible', timeout: 15000 });
      const user = await readStoredUser(page);
      if (!user?.token) throw new Error('Session missing after cold-start login');
    });
  }),
];

export const uiPublicCases = [
  defineCase('TC-UI-PUB-001', async () => {
    await withUiCase('TC-UI-PUB-001', async (page) => {
      await page.goto('/login');
      await expectOnLoginPage(page);
      await fillLoginForm(page, 'owner');
      await submitLogin(page);
      await page.waitForURL(/\/platform\/home/, { timeout: 20000 });
    });
  }),
  defineCase('TC-UI-PUB-002', async () => {
    await withUiCase('TC-UI-PUB-002', async (page) => {
      await page.goto('/demo');
      await page.waitForURL(/\/demo/, { timeout: 10000 });
      await page.getByRole('heading', { name: /demo/i }).waitFor({ state: 'visible' });
      await page.locator('form, input[type="email"], input').first().waitFor({ state: 'visible' });
    });
  }),
];
