'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let browserPromise = null;

const SYSTEM_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : null,
  process.platform === 'darwin'
    ? '/Applications/Chromium.app/Contents/MacOS/Chromium'
    : null,
  process.platform === 'linux' ? '/usr/bin/google-chrome-stable' : null,
  process.platform === 'linux' ? '/usr/bin/google-chrome' : null,
  process.platform === 'linux' ? '/usr/bin/chromium-browser' : null,
  process.platform === 'linux' ? '/usr/bin/chromium' : null,
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : null,
  process.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    : null
].filter(Boolean);

function resolveChromeExecutablePath() {
  for (const candidate of SYSTEM_CHROME_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const puppeteer = require('puppeteer');
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      return bundled;
    }
  } catch (_) {
    // bundled browser not installed
  }

  return null;
}

function buildChromeNotFoundError() {
  const cacheDir = process.env.PUPPETEER_CACHE_DIR
    || path.join(os.homedir(), '.cache', 'puppeteer');

  return new Error(
    'Chrome is required for PDF rendering but was not found. '
    + 'Install Puppeteer Chrome (`cd server && npm run puppeteer:install-chrome`), '
    + 'or set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary. '
    + `Expected cache: ${cacheDir}`
  );
}

async function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require('puppeteer');
    const executablePath = resolveChromeExecutablePath();

    if (!executablePath) {
      throw buildChromeNotFoundError();
    }

    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
    });
  }
  return browserPromise;
}

/**
 * @param {string} html
 * @param {object} [options]
 */
async function renderHtmlToPdf(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfOptions = {
      printBackground: true,
      preferCSSPageSize: true
    };

    if (options.paperSize && options.paperSize !== 'Custom') {
      pdfOptions.format = options.paperSize;
    } else if (options.paperSize === 'Custom' && options.dimensions) {
      pdfOptions.width = `${options.dimensions.width}mm`;
      pdfOptions.height = `${options.dimensions.height}mm`;
    }

    if (options.orientation === 'landscape') {
      pdfOptions.landscape = true;
    }

    return Buffer.from(await page.pdf(pdfOptions));
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

module.exports = {
  renderHtmlToPdf,
  closeBrowser,
  resolveChromeExecutablePath
};
