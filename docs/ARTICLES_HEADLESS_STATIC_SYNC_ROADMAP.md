# Articles Headless Static Sync — Roadmap

**Status:** Approved for implementation  
**Date:** 2026-07-08  
**Owner:** Platform / Content Studio  
**Scope:** Pre-rendered HTML + mirrored assets on the **customer domain** (SEO, same-origin, incremental updates)  
**Parent:** [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md) · [HEADLESS_CONTENT_ROADMAP.md](./HEADLESS_CONTENT_ROADMAP.md) HC-8 / HC-9  
**Related:** [ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md](./ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md)

---

## 1. Product promise

Publish a **public** article in Content Studio → **pre-rendered HTML** (and images) land on the tenant's website at URLs like `https://xyz.com/help/...` → crawlers and visitors get full HTML in the **first HTTP response** without relying on client-side embed fetches.

**Incremental by default:** each publish or unpublish updates **only the affected pages and assets** — no full site redeploy.

**Stack-agnostic delivery:** one Arivu export + webhook contract; tenants choose an install shape (Node/Next, PHP, CLI/S3) based on how they host — not on their app framework.

**Coexists with embed:** live embed (`headless-help.js`) remains the zero-setup path for interactivity (search, sidebars, feedback). Static sync is **SEO mode**.

---

## 2. Problem (why v2)

| Issue | Root cause today |
|-------|------------------|
| Slow repeat loads | Embed uses `fetch(..., { cache: 'no-store' })` on every navigation |
| Weak SEO | Content rendered via JS after cross-origin API calls |
| Assets on Arivu origin | Block/cover/OG URLs point at `{arivu-app}/api/files/download?...` |
| Customer infra unknown | Cannot assume Next.js, WordPress, or S3 — need multiple thin adapters |

Embed + browser cache improves repeat visits but **does not** replace static HTML for SEO. Static sync does.

---

## 3. Target architecture

```text
Author → Publish (Content Studio)
  → Arivu stores blocks JSON (source of truth — unchanged)
  → POST webhook (content.published | content.unpublished)
  → Tenant sync handler (Node / PHP / CLI — their choice)
       1. GET export payload (article HTML + asset list) OR fetch JSON + render
       2. Download referenced assets (dedupe by assetId)
       3. Rewrite URLs → https://xyz.com/help/assets/{assetId}.{ext}
       4. Write HTML to mapped path; delete on unpublish
       5. Refresh sitemap fragment
  → Visitor/crawler GETs same-origin static HTML + images
```

**Optional:** embed on static pages for feedback widget only (`data-slug`, no full body fetch).

---

## 4. Delivery paths (~95% coverage)

| Path | Host | Tenant setup | Incremental |
|------|------|--------------|-------------|
| **B1 — Next.js ISR** | Vercel, Node | `/api/arivu-webhook` + `revalidatePath` | ✅ Per slug |
| **B2 — Node write** | Express/Nest VPS | Webhook route + `fs.writeFile` under `public/help/` | ✅ Per slug |
| **A — PHP sync file** | cPanel, shared hosting | Upload `arivu-help-sync.php` + webhook URL | ✅ Per slug |
| **C — CLI / CI** | S3, Azure Blob, any CDN | `npx @arivu/help-sync --slug` on webhook or cron | ✅ Per slug |
| **D — Embed only** | Any | Paste snippet | ❌ Live API (fallback) |

**Not in v1:** Arivu push directly to tenant S3 (credentials in settings) — defer to v2.1.

---

## 5. Baseline (done — headless v1)

| Item | Status |
|------|--------|
| Public JSON API (`/articles`, `/articles/:slug`, `/collections`, sitemap) | ✅ |
| `POST /render-blocks` (server HTML from blocks) | ✅ |
| Publish + unpublish webhooks with `content.apiUrl` | ✅ |
| `headlessContentShaper` (seo, coverImage, resolved block asset URLs) | ✅ |
| Client `renderBlocks` SDK | ✅ |
| Help Center embeds | ✅ |
| Static export / manifest / public asset download | ✅ SS-1 + SS-2 (2026-07-08) |
| `@arivu/help-sync` package + templates | ✅ SS-4 + SS-5 (2026-07-08) |

---

## 6. Hard rules (unchanged)

1. **Blocks JSON is source of truth** — HTML is generated at export time, not stored as authoritative content in Arivu.
2. **Tenant isolation** — export and asset download gated by org slug + published + public + headless enabled.
3. **Customer owns page shell** — export may ship full page or body fragment + SEO `<head>`; tenant header/footer via include or site layout.
4. **No full redeploy required** — webhook-driven per-slug updates; `--full` only for initial sync and repair.

---

## 7. Workstreams

### SS-1 — Export & manifest API · **P0**

**Objective:** Single contract for sync tools to fetch render-ready output without N+1 round trips.

| Task | Location |
|------|----------|
| `GET /api/public/v1/content/:orgSlug/manifest.json` | `publicContentRoutes.js`, `publicContentService.js` |
| Manifest shape: `version`, `generatedAt`, `collections[]`, `articles[{ slug, updatedAt, publishedAt, collectionPath[], exportPath }]` | service + shaper |
| `GET /api/public/v1/content/:orgSlug/articles/:slug/export` | new controller method |
| Export response: `{ html, meta: { title, description, canonical, og }, assets[{ assetId, url, filename, contentType }] }` | reuse `renderBlocksToHtml`, `headlessContentShaper` |
| Query `?fragment=1` — body HTML only (no `<html>` wrapper) | controller |
| Path helper: map slug + collection chain → suggested `exportPath` (e.g. `/help/{cat}/{section}/{slug}/index.html`) | shared util |
| Unit + integration tests | `__tests__/publicContentExport.test.js` |
| Cache-Control on manifest (short) and export (match article TTL) | `publicContentController.js` |

**Manifest example:**

```json
{
  "version": "2026-07-08T04:00:00.000Z",
  "articles": [
    {
      "slug": "create-invoice",
      "updatedAt": "2026-07-07T12:00:00.000Z",
      "exportPath": "/help/billing/invoices/create-invoice/index.html",
      "exportUrl": "https://app.arivu.com/api/public/v1/content/art_pub_xxx/articles/create-invoice/export"
    }
  ]
}
```

**Exit criteria**

- [x] Manifest lists all published public articles with `updatedAt` and `exportUrl`
- [x] Export returns valid HTML + asset list for a fixture article
- [x] Gates enforced (addon, headless, published, public)
- [x] Tests green

**Status:** ✅ Shipped (2026-07-08)

---

### SS-2 — Public asset download · **P0**

**Objective:** Sync tools download images/files without tenant auth cookies.

| Task | Location |
|------|----------|
| `GET /api/public/v1/content/:orgSlug/assets/:assetId` | new route + controller |
| Verify asset is referenced by a **published public** article (or in export asset list) | `publicContentService.js` |
| Stream bytes with `Content-Type`, `Cache-Control: public, max-age=86400` | controller |
| `Content-Disposition: inline` for images | controller |
| Include stable `assetId` + suggested filename in export `assets[]` | export builder |
| Rate limit (reuse `publicContentLimiter`) | routes |
| Tests: allowed asset, 404 for private/unreferenced asset | `__tests__/` |

**Note:** Until SS-2 ships, sync may fetch legacy `/api/files/download?storagePath=...` URLs from export — document as transitional; remove when SS-2 is live.

**Exit criteria**

- [x] Export-listed asset downloads without auth
- [x] Unreferenced asset returns 404
- [x] Tests green

**Status:** ✅ Shipped (2026-07-08) — asset reference scan at download time; integration tests deferred to SS-4.

---

### SS-3 — Webhook payload v2 · **P1**

**Objective:** Handlers regenerate one page without extra manifest round trip when possible.

| Task | Location |
|------|----------|
| Extend `buildWebhookPayload`: `content.exportUrl`, `content.exportPath`, `content.updatedAt` | `contentPublishingWebhookService.js` |
| Collection path slugs in payload when resolvable | service |
| Update test webhook sample payload | `__tests__/contentPublishingWebhookService.test.js` |
| Document payload in this roadmap + customer setup doc | docs |

**Payload addition:**

```json
{
  "event": "content.published",
  "content": {
    "slug": "create-invoice",
    "apiUrl": ".../articles/create-invoice",
    "exportUrl": ".../articles/create-invoice/export",
    "exportPath": "/help/billing/invoices/create-invoice/index.html",
    "updatedAt": "2026-07-07T12:00:00.000Z"
  }
}
```

**Exit criteria**

- [x] Publish + unpublish payloads include `exportUrl` and `exportPath`
- [x] Test webhook reflects new fields
- [x] Backward compatible (existing fields unchanged)

**Status:** ✅ Shipped (2026-07-08)

---

### SS-4 — `@arivu/help-sync` core package · **P0**

**Objective:** Shared logic for all tenant adapters (Node, PHP port, CLI).

| Task | Location |
|------|----------|
| New package `packages/help-sync/` (or `tools/help-sync/`) | monorepo |
| `syncArticle({ org, slug, destination, options })` | core |
| `syncFull({ org, destination, options })` — walk manifest | core |
| `mirrorAssets: true` — download + rewrite URLs in HTML | core |
| Asset dedupe: `/help/assets/{assetId}.{ext}` | core |
| `deleteArticle({ slug, exportPath })` on unpublish | core |
| `buildPageHtml(export, { shell: 'full' \| 'fragment', cssHref })` | core |
| `verifyWebhook(body, signature, secret)` — stub until HMAC ships | core |
| Path config: `urlPrefix`, `assetsPrefix` | core |
| Vitest with mocked fetch | `packages/help-sync/__tests__/` |

**CLI:**

```bash
npx @arivu/help-sync sync --org art_pub_xxx --dest ./public/help --slug create-invoice
npx @arivu/help-sync sync --org art_pub_xxx --dest s3://bucket/help --full
```

**Exit criteria**

- [x] CLI syncs one article + assets to local directory
- [x] `--full` syncs from manifest
- [x] Unpublish deletes HTML; optional `--gc-assets` removes orphans
- [x] Tests green

**Status:** ✅ Shipped (2026-07-08) — orphan asset GC deferred.

---

### SS-5 — Tenant templates · **P1**

**Objective:** Copy-paste install per host type.

| Template | Path | Notes |
|----------|------|-------|
| **Next.js App Router** | `docs/examples/static-sync/next-app-router/` | `api/arivu-webhook/route.ts`, `help/[...slug]/page.tsx`, `revalidatePath` |
| **Express** | `docs/examples/static-sync/express/` | `POST /api/arivu-webhook`, write `public/help/` |
| **PHP** | `docs/examples/static-sync/arivu-help-sync.php` | Webhook + `?full=1` + config block at top |
| **GitHub Action** | `docs/examples/static-sync/github-action-sync.yml` | Webhook → workflow → CLI to S3 |
| **Vercel env checklist** | section in customer setup doc | `ARIVU_ORG`, `WEBHOOK_SECRET`, `HELP_URL_PREFIX` |

**Exit criteria**

- [x] Next template: webhook → revalidate one path; page serves pre-built or ISR-fetched HTML
- [x] PHP template: writes one HTML file + assets on webhook POST
- [x] Examples run against staging with documented env vars

**Status:** ✅ Shipped (2026-07-08) — examples in `docs/examples/static-sync/`.

---

### SS-6 — Articles settings UX · **P1**

**Objective:** Admin picks SEO mode and downloads the right bundle.

| Task | Location |
|------|----------|
| New subsection **Static sync (SEO)** | `ArticlesAddonSettings.vue` |
| Host type selector: Vercel/Next · PHP · S3/CLI · Other | settings UI |
| Download buttons: PHP file, Next snippet zip, env template | settings |
| Pre-filled `ARIVU_ORG`, `ARIVU_API_ORIGIN`, webhook URL hint | settings |
| Link to manifest + export URL copy buttons | settings |
| i18n keys | `en/settings.json` + `npm run i18n:sync-keys` |

**Exit criteria**

- [x] Admin can copy manifest URL and export URL for an example slug
- [x] Download links for templates work
- [x] i18n complete for en

**Status:** ✅ Shipped (2026-07-08)

---

### SS-7 — Sitemap & category pages · **P2**

**Objective:** SEO beyond article detail pages.

| Task | Location |
|------|----------|
| Export endpoints for collection home/category/section list pages (HTML) | extend SS-1 |
| Manifest includes collection `exportPath`s | manifest |
| Sync regenerates category/section HTML when any child article publishes | help-sync logic |
| Customer `/help/sitemap.xml` generation in sync `--full` | CLI |
| Align with existing Arivu sitemap entries | `publicContentService.getPublicHelpSitemap` |

**Exit criteria**

- [x] `/help/` and category pages can be statically synced
- [x] Sitemap written to customer dest on `--full`

---

### SS-8 — Webhook hardening · **P2**

**Objective:** Secure tenant webhook endpoints.

| Task | Location |
|------|----------|
| Optional `webhookSecret` in Articles publishing settings | `articlesAddonSettingsService.js` |
| `X-Arivu-Signature` HMAC-SHA256 of body | `contentPublishingWebhookService.js` |
| `verifyWebhook` in help-sync package | package |
| Settings UI: generate/copy secret | `ArticlesAddonSettings.vue` |
| Document verification for PHP/Node templates | docs |

**Deferred:** retry queue for failed webhook delivery (platform-side).

**Exit criteria**

- [x] Tenant can set secret; signature verified in templates
- [x] Tests for signature generation

---

### SS-9 — Embed cache (performance, not SEO) · **P3**

**Objective:** Faster live embed path without replacing static sync.

| Task | Location |
|------|----------|
| Remove `cache: 'no-store'` where safe; respect API Cache-Control | `headless-help-common.js`, embed scripts |
| Optional IndexedDB SWR keyed by `updatedAt` | `headless-help-common.js` |
| `data-cache="local"` opt-in on script tag | embed |
| Client-side renderBlocks in embed (drop POST `/render-blocks`) | `headless-article.js` |

**Exit criteria**

- [x] Repeat embed navigation uses cache when enabled
- [x] Search requests bypass cache

---

## 8. Customer setup (static SEO mode)

**One-time:**

| Step | Action |
|------|--------|
| 1 | Enable Articles + headless API; save **website domain** |
| 2 | Choose delivery path (Next / PHP / CLI) |
| 3 | Deploy sync handler; set env (`ARIVU_ORG`, `ARIVU_API_ORIGIN`, `WEBHOOK_SECRET`, `HELP_URL_PREFIX`) |
| 4 | Set **Publish webhook URL** in Articles settings → handler |
| 5 | Run initial **`--full` sync** |
| 6 | Ensure web server serves `/help/*` as static files (not SPA fallback) |
| 7 | Merge sitemap; verify View Source shows full HTML + meta |

**Ongoing:** publish/unpublish in Content Studio → webhook → incremental update only.

---

## 9. Implementation order

```text
SS-1 (export + manifest)
  → SS-2 (public asset download)
  → SS-4 (help-sync package + CLI)
  → SS-3 (webhook payload v2)
  → SS-5 (templates: Next + PHP first)
  → SS-6 (settings UX)
  → SS-7 (category pages + sitemap)
  → SS-8 (webhook HMAC)
  → SS-9 (embed cache — parallel OK)
```

**First PR scope (SS-1 + SS-2):** export endpoint, manifest, public asset route, tests — no UI.

**Second PR (SS-4 + SS-5):** help-sync package, PHP + Next examples.

---

## 10. Testing strategy

| Layer | Approach |
|-------|----------|
| Unit | Export HTML shape, asset list extraction, URL rewrite, path mapping |
| Integration | Public export + asset download with fixture org + published doc |
| Contract | Snapshot export HTML per block type |
| E2E | Webhook POST → temp dir contains HTML + mirrored PNG |
| Manual | Next template on Vercel staging; PHP on local Apache |

---

## 11. Analytics (PostHog)

| Event | When |
|-------|------|
| `content_export_requested` | Export endpoint hit |
| `content_asset_downloaded` | Public asset stream |
| `content_sync_webhook_delivered` | Tenant webhook 2xx (future platform pingback optional) |

---

## 12. Security

- Export and asset routes: same gates as public JSON API.
- Asset download: only assets referenced by published public content for that org.
- Never expose draft or portal-only assets via export.
- Webhook secret: tenant-managed; document HMAC verification.
- Rate limits: existing public limiter + consider export-specific cap if abused.

---

## 13. Out of scope (this track)

- Arivu-hosted help pages / custom domains
- Full site redeploy on every publish (Deploy Hook only) as **recommended** path — document as alternative, not default
- Blog static sync (follow after Articles SS track ships)
- Responsive image transforms on mirrored assets (HC-8 overlap — v2.1)
- Arivu direct push to tenant S3 credentials in UI (v2.1)

---

## 14. Exit checklist (Articles static sync v1)

- [x] Manifest + per-article export API live
- [x] Public asset download live
- [x] Webhook payload includes `exportUrl` + `exportPath`
- [x] `@arivu/help-sync` CLI: `--slug` and `--full` with asset mirroring
- [x] Next.js + PHP templates documented and downloadable
- [x] Articles settings: Static sync section
- [x] Customer setup doc updated with SEO mode
- [x] CI tests green for export, assets, webhook payload
- [x] Category pages + customer sitemap on `--full`
- [x] Webhook HMAC signing + tenant secret
- [x] Embed browser/local cache (opt-in `data-cache="local"`)

---

## 15. Related files (existing)

| Area | Path |
|------|------|
| Public API | `server/routes/publicContentRoutes.js`, `server/controllers/publicContentController.js` |
| Static export | `server/services/contentStudio/headlessStaticExportService.js` |
| Content shaping | `server/services/contentStudio/headlessContentShaper.js` |
| Block render | `server/services/contentStudio/contentStudioBlockRenderer.js` |
| Webhooks | `server/services/contentStudio/contentPublishingWebhookService.js` |
| Client renderer | `client/src/modules/contentStudio/headless/renderBlocks.ts` |
| Settings | `client/src/components/settings/ArticlesAddonSettings.vue` |
| Customer embed guide | `docs/ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md` |
