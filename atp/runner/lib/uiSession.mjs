import { chromium } from 'playwright';
import { getConfig } from '../../shared/config.mjs';
import { getPersonaCredentials } from './authSession.mjs';

/** @type {import('playwright').Browser | null} */
let browser = null;

export async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.ATP_UI_HEADLESS !== '0',
    });
  }
  return browser;
}

export async function newBrowserContext() {
  const b = await getBrowser();
  const config = getConfig();
  return b.newContext({
    baseURL: config.sutClientUrl,
    viewport: { width: 1280, height: 720 },
  });
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [personaKey='owner']
 */
export async function fillLoginForm(page, personaKey = 'owner') {
  const creds = getPersonaCredentials(personaKey);
  if (!creds) {
    const err = new Error(`Persona "${personaKey}" not configured`);
    err.skip = true;
    throw err;
  }
  await page.goto('/login');
  await page.locator('#email').fill(creds.email);
  await page.locator('#password').fill(creds.password);
  return creds;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [personaKey='owner']
 */
export async function loginViaUi(page, personaKey = 'owner') {
  await fillLoginForm(page, personaKey);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/platform\/home/, { timeout: 20000 });
  await page.locator('a[href="/deals"], a[href="/people"]').first().waitFor({ state: 'visible', timeout: 20000 });
}

export async function readStoredUser(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
}

export async function readRedirectAfterLogin(page) {
  return page.evaluate(() => sessionStorage.getItem('arivu_redirect_after_login'));
}
