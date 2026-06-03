import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newBrowserContext, loginViaUi } from './uiSession.mjs';
import { recordUiTiming } from './requestTiming.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.resolve(__dirname, '../../artifacts');

/** Set by engine.mjs during TC-UI / TC-E2E UI steps for timing metrics. */
let activeUiStore = null;

export function bindUiStore(store) {
  activeUiStore = store || null;
}

function caseArtifactDir(caseId) {
  const safe = caseId.replace(/[^\w-]/g, '_');
  return path.join(ARTIFACTS_DIR, safe);
}

/**
 * @param {string} caseId
 * @param {(page: import('playwright').Page) => Promise<void>} run
 */
export async function withUiCase(caseId, run, options = {}) {
  const context = await newBrowserContext();
  const store = options.store || activeUiStore;
  const traceEnabled = process.env.ATP_UI_TRACE === '1';
  if (traceEnabled) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  const page = await context.newPage();
  const timed = async (action, fn) => {
    const start = performance.now();
    await fn();
    if (store) {
      recordUiTiming(store, {
        path: page.url(),
        action,
        ms: Math.round(performance.now() - start),
      });
    }
  };
  try {
    await run(page, { timed });
    if (traceEnabled) {
      const dir = caseArtifactDir(caseId);
      fs.mkdirSync(dir, { recursive: true });
      await context.tracing.stop({ path: path.join(dir, 'trace.zip') });
    }
  } catch (err) {
    const dir = caseArtifactDir(caseId);
    fs.mkdirSync(dir, { recursive: true });
    const screenshotPath = path.join(dir, 'failure.png');
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    err.artifactPath = screenshotPath;
    if (traceEnabled) {
      await context.tracing.stop({ path: path.join(dir, 'trace-failure.zip') }).catch(() => {});
    }
    throw err;
  } finally {
    await context.close();
  }
}

/**
 * @param {string} caseId
 * @param {(page: import('playwright').Page) => Promise<void>} run
 * @param {string} [personaKey='owner']
 */
export async function withAuthenticatedUi(caseId, run, personaKey = 'owner', options = {}) {
  await withUiCase(
    caseId,
    async (page, helpers) => {
      await helpers.timed('login', () => loginViaUi(page, personaKey));
      await run(page, helpers);
    },
    options
  );
}

export { ARTIFACTS_DIR };
