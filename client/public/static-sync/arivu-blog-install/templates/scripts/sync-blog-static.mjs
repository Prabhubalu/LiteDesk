import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvFiles } = require(path.join(__dirname, '../help-sync/lib/loadEnv.js'));
loadEnvFiles();

const { syncFull } = require(path.join(__dirname, '../help-sync/lib/sync.js'));

const org = process.env.ARIVU_BLOG_ORG || process.env.ARIVU_ORG || '';
const apiOrigin = process.env.ARIVU_API_ORIGIN || '';
const dest = process.env.ARIVU_SYNC_DEST || './public';
const pathPrefix = process.env.BLOG_URL_PREFIX || '/blog/';
const siteOrigin = process.env.SITE_ORIGIN || '';
const syncMode = process.env.ARIVU_SYNC_MODE || 'hybrid';

if (syncMode === 'layout') {
  console.log('[arivu-blog-sync] Layout mode — pages built via Next.js using your site layout (no static HTML write)');
  process.exit(0);
}

if (!org || !apiOrigin) {
  if (syncMode === 'static' || syncMode === 'hybrid') {
    console.error('[arivu-blog-sync] ARIVU_BLOG_ORG (or ARIVU_ORG) and ARIVU_API_ORIGIN are required for static/hybrid sync');
    process.exit(1);
  }
  console.warn('[arivu-blog-sync] Skipping blog static sync: set ARIVU_BLOG_ORG (or ARIVU_ORG) and ARIVU_API_ORIGIN');
  process.exit(0);
}

if (syncMode === 'hybrid') {
  console.log('[arivu-blog-sync] Hybrid mode — writing static HTML; App Router serves it when present, else live embed');
}

const result = await syncFull({
  apiOrigin,
  org,
  dest,
  pathPrefix,
  siteOrigin,
  addon: 'blog',
  mirrorAssets: process.env.ARIVU_MIRROR_ASSETS !== '0',
});

console.log(`[arivu-blog-sync] Wrote ${result.count} pages to ${dest} (manifest ${result.version || 'unknown'})`);
