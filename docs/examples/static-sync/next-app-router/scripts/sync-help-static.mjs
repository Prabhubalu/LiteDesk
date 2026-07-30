import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvFiles } = require(path.join(__dirname, '../help-sync/lib/loadEnv.js'));
loadEnvFiles();

const { syncFull } = require(path.join(__dirname, '../help-sync/lib/sync.js'));

const org = process.env.ARIVU_ORG || '';
const apiOrigin = process.env.ARIVU_API_ORIGIN || '';
const dest = process.env.ARIVU_SYNC_DEST || './public';
const pathPrefix = process.env.HELP_URL_PREFIX || '/help/';
const siteOrigin = process.env.SITE_ORIGIN || '';

if (!org || !apiOrigin) {
  if (process.env.ARIVU_SYNC_MODE === 'static') {
    console.error('[arivu-sync] ARIVU_ORG and ARIVU_API_ORIGIN are required for static SEO mode');
    process.exit(1);
  }
  console.warn('[arivu-sync] Skipping help static sync: set ARIVU_ORG and ARIVU_API_ORIGIN');
  process.exit(0);
}

const result = await syncFull({
  apiOrigin,
  org,
  dest,
  pathPrefix,
  siteOrigin,
  mirrorAssets: process.env.ARIVU_MIRROR_ASSETS !== '0',
});

console.log(`[arivu-sync] Wrote ${result.count} pages to ${dest} (manifest ${result.version || 'unknown'})`);
