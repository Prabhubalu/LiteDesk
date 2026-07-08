import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  syncIncremental,
  syncFullWithState,
  syncFromWebhookPayload,
} = require(path.join(__dirname, '../help-sync/lib/syncIncremental.js'));

const org = process.env.ARIVU_ORG || '';
const apiOrigin = process.env.ARIVU_API_ORIGIN || '';
const dest = process.env.ARIVU_SYNC_DEST || './public';
const pathPrefix = process.env.HELP_URL_PREFIX || '/help/';
const siteOrigin = process.env.SITE_ORIGIN || '';
const syncMode = process.env.ARIVU_SYNC_MODE || 'layout';
const mirrorAssets = process.env.ARIVU_MIRROR_ASSETS !== '0';

const baseOptions = {
  apiOrigin,
  org,
  dest,
  pathPrefix,
  siteOrigin,
  mirrorAssets,
};

if (syncMode === 'layout') {
  console.log('[arivu-sync] Layout mode — pages built via Next.js using your site layout');
  process.exit(0);
}

if (!org || !apiOrigin) {
  if (syncMode === 'static') {
    console.error('[arivu-sync] ARIVU_ORG and ARIVU_API_ORIGIN are required for static SEO mode');
    process.exit(1);
  }
  console.warn('[arivu-sync] Skipping help static sync: set ARIVU_ORG and ARIVU_API_ORIGIN');
  process.exit(0);
}

let result;

if (process.env.ARIVU_SYNC_FULL === '1') {
  result = await syncFullWithState(baseOptions);
  console.log(`[arivu-sync] Full sync wrote ${result.count} pages to ${dest} (manifest ${result.version || 'unknown'})`);
} else if (process.env.ARIVU_WEBHOOK_PAYLOAD) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(process.env.ARIVU_WEBHOOK_PAYLOAD, 'base64').toString('utf8'));
  } catch {
    console.error('[arivu-sync] Invalid ARIVU_WEBHOOK_PAYLOAD');
    process.exit(1);
  }
  result = await syncFromWebhookPayload({ ...baseOptions, payload });
  console.log(`[arivu-sync] Webhook sync updated ${result.slug || result.exportPath || 'help pages'} in ${dest}`);
} else {
  result = await syncIncremental(baseOptions);
  console.log(
    `[arivu-sync] Incremental sync wrote ${result.count} pages to ${dest}`
    + ` (${result.changedArticles} article(s), ${result.refreshedPages} listing page(s))`,
  );
}
