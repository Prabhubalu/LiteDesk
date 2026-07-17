# Headless Content Delivery Roadmap

**Status:** Approved for implementation  
**Date:** 2026-07-07  
**Owner:** Platform / Content Studio  
**Parent:** [CONTENT_STUDIO_ROADMAP.md](./CONTENT_STUDIO_ROADMAP.md) CS-3 · [CONTENT_STUDIO_ARCHITECTURE.md](./adr/CONTENT_STUDIO_ARCHITECTURE.md)  
**Articles completion track:** [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md)

---

## 1. Goal

Deliver **Sanity-style headless content**: LiteDesk owns authoring and structured storage; **customer websites own all presentation** (layout, CSS, typography, chrome).

**Product promise:** Publish once in Content Studio → fetch JSON from any stack (Next.js, Astro, Vue, WordPress, vanilla HTML) → render with the tenant's existing design system. No iframe, no LiteDesk-branded shell, no injected CSS on headless consumers.

---

## 2. Separation doctrine (locked)

| Layer | LiteDesk owns | Customer site owns |
|-------|---------------|-------------------|
| Authoring | Tiptap editor, blocks, versions, publish workflow | — |
| Storage | `ContentDocument` + `ContentDocumentVersion.blocks` | — |
| Headless API | JSON payload (metadata + blocks + asset URLs) | — |
| Presentation | — | HTML, CSS, components, nav, page shell |
| Portal KB | Branded HTML in authenticated portal | — |

**Hosted public pages, custom domains, iframe embeds, and Content Publishing brand profiles are removed (2026-07-07).**

**Hard rules**

1. **Never store HTML as source of truth** — blocks JSON only.
2. **Public API returns JSON only** — no `bodyHtml`, `appearance`, or branding.
3. **One publish, multiple read channels** — `portal_kb` (portal) + `headless_json` (public API) from the same published version.
4. **Tenant isolation** — all public APIs scoped by org slug; only `status: published` + `visibility: public`.
5. **Reuse existing services** — extend `publicContentService`, `headlessContentShaper`; no parallel CMS stack.

---

## 3. Current state (baseline)

| Area | Status |
|------|--------|
| Block authoring (Tiptap) | ✅ Done |
| `ContentDocument` / versions | ✅ Done |
| Public articles API (`/articles`, `/articles/:slug`) | ✅ JSON only |
| Publish webhook (`content.published`) | ✅ Done |
| `content.unpublished` webhook | ✅ Done |
| Client block renderer SDK | ✅ Done (`client/src/modules/contentStudio/headless`) |
| Articles settings integration UX (copy, examples, test webhook) | ✅ Done |
| Help Center embeds (home, category, section, sidebars) | ❌ See [ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md](./ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md) |
| Hosted pages / embed / custom domain | ❌ Removed |
| Blog public API | ✅ `/blog`, `/blog/:slug`, `/blog/rss.xml` |
| JSON embed (non-iframe) | ❌ Missing |
| Public asset URL transforms | ❌ Missing |

---

## 4. Target API contract

### 4.1 Endpoints

```
GET /api/public/v1/content/:orgSlug/help
GET /api/public/v1/content/:orgSlug/help/:slug
GET /api/public/v1/content/:orgSlug/articles          (alias — Articles headless)
GET /api/public/v1/content/:orgSlug/articles/:slug  (alias — Articles headless)
GET /api/public/v1/content/:orgSlug/blog
GET /api/public/v1/content/:orgSlug/blog/:slug
GET /api/public/v1/content/:orgSlug/blog/rss.xml
GET /api/public/v1/content/:orgSlug/sitemap.xml
GET /api/public/v1/assets/:assetId          (Phase 4)
```

Legacy alias: `/api/public/content/...` (keep for backward compatibility).

### 4.1.1 Articles delivery gates

| Mode | Required settings |
|------|-------------------|
| **Headless JSON** | Articles addon enabled + `headlessApiEnabled` (default on) |
| **Portal** | `portalPublishing` on Articles addon — separate portal API, branded HTML |

### 4.2 Query parameters

| Param | Values | Default | Notes |
|-------|--------|---------|-------|
| `format` | `json` · `html` | `json` when `publishingTarget=headless`; else `html` for web surfaces | Controls payload shape |
| `surface` | `api` · `web` | `api` | `web` blocked when target is headless-only |
| `page`, `limit`, `search` | — | list endpoints | Existing pagination |
| `collection` | slug/id | — | Articles collections filter (Phase 1) |

### 4.3 Headless JSON response (`format=json`)

```json
{
  "success": true,
  "organization": { "slug": "acme", "name": "Acme Inc" },
  "publishing": { "target": "headless", "headlessApiEnabled": true },
  "data": {
    "id": "...",
    "slug": "reset-password",
    "title": "Reset your password",
    "subtitle": "",
    "summary": "...",
    "publishedAt": "2026-07-01T12:00:00.000Z",
    "updatedAt": "2026-07-06T09:00:00.000Z",
    "seo": {
      "metaTitle": "",
      "metaDescription": "",
      "canonicalUrl": "",
      "ogImageUrl": "https://..."
    },
    "coverImage": {
      "url": "https://...",
      "alt": "",
      "width": 1200,
      "height": 630
    },
    "authorName": "Jane Doe",
    "collectionName": "Account",
    "readMinutes": 3,
    "plainText": "...",
    "blocks": {
      "type": "doc",
      "content": []
    }
  }
}
```

**Excluded from headless JSON:** `bodyHtml`, `appearance`, `branding`, presentation colors/fonts.

### 4.4 Hosted HTML response (`format=html`)

Current behavior preserved for portal, hosted subdomain, custom domain, and iframe embed consumers.

### 4.5 Webhook payload (enhanced)

```json
{
  "event": "content.published",
  "occurredAt": "2026-07-07T10:00:00.000Z",
  "organization": { "slug": "acme" },
  "content": {
    "id": "...",
    "addonKey": "articles",
    "contentType": "knowledge_article",
    "slug": "reset-password",
    "title": "Reset your password",
    "publishedAt": "...",
    "apiUrl": "https://app.../api/public/v1/content/acme/help/reset-password?format=json",
    "publicUrl": "https://help.acme.com/help/reset-password"
  }
}
```

Phase 3 adds: `content.unpublished`, HMAC signature header, retry queue.

---

## 5. Render channels

| Channel | `format` | Consumer | Output |
|---------|----------|----------|--------|
| `portal_kb` | `html` | Customer portal | Branded HTML + portal shell |
| `blog_web` | `html` | Hosted blog / custom domain | Branded HTML + `PublicHelpShell` |
| `headless_json` | `json` | External websites | Blocks + metadata only |
| `email_excerpt` | — | Campaign bridge (later) | Plain text / minimal HTML |

Implementation: channel-aware shaper in `publicContentService`; renderer split in `contentStudioBlockRenderer`.

---

## 6. Implementation phases

### HC-1 — Headless JSON API (Articles) · **Start here** · 1–2 weeks

**Objective:** External sites can fetch published help articles as raw blocks.

| Task | Files / area |
|------|----------------|
| Add `resolvePublicFormat(req, org)` helper | `publicContentController.js`, `publicContentService.js` |
| Create `headlessContentShaper.js` | `server/services/contentStudio/headlessContentShaper.js` |
| Split `shapePublicArticleDetail` by channel | `publicContentService.js` |
| Walk blocks tree; resolve `assetId` → public URLs | `headlessContentShaper.js`, reuse `contentAssetService` |
| Respect `publishingTarget` + `headlessApiEnabled` gates | existing `getPublicPublishingContext` |
| Add `?format=json|html` query support | controller + service |
| Unit tests: JSON shape, no branding leakage, asset resolution | `__tests__/headlessContentShaper.test.js`, extend public tests |
| Update OpenAPI-style examples in settings copy | i18n keys only if UI text changes |

**Exit criteria**

- [ ] `GET .../help/:slug?format=json` returns `blocks` + metadata; no `bodyHtml` / `appearance`
- [ ] `GET .../help/:slug?format=html` unchanged for hosted consumers
- [ ] `publishingTarget=headless` rejects `surface=web` list/detail
- [ ] Images in blocks expose public URLs
- [ ] Tests pass in CI

---

### HC-2 — Blog public API · 1 week

**Objective:** Blog addon has parity with Articles on public delivery.

| Task | Files / area |
|------|----------------|
| `listPublicBlogPosts`, `getPublicBlogPost` | `publicContentService.js` |
| Routes: `/blog`, `/blog/:slug` | `publicContentRoutes.js`, `publicContentController.js` |
| Blog visibility query (`addonKey: blog`, `contentType: blog_post`, `visibility: public`) | service |
| RSS feed (`/blog/rss.xml`) | new `publicBlogRssService.js` or extend sitemap service |
| Extend sitemap for blog URLs | `publicContentService.js` |
| Gate on blog addon + public publishing settings | mirror articles addon checks |

**Exit criteria**

- [ ] Blog list/detail JSON + HTML formats work
- [ ] RSS validates (W3C feed validator)
- [ ] Sitemap includes blog URLs when blog addon enabled

---

### HC-3 — Channel renderer split · 1 week

**Objective:** Single block source; explicit channel outputs.

| Task | Files / area |
|------|----------------|
| Add `renderChannel` param to block renderer | `contentStudioBlockRenderer.js` |
| `headless_json`: skip presentation attrs (headingColor, etc.) in HTML path | renderer |
| Ensure portal vs blog_web theme application stays isolated | `publicPublishingResolver.js`, `articlesAppearanceService.js` |
| Document channel matrix in ADR addendum | optional one-paragraph update to ADR |

**Exit criteria**

- [ ] Renderer tests cover `headless_json` vs `blog_web` output differences
- [ ] No LiteDesk CSS classes in headless JSON path

---

### HC-4 — Client block renderer SDK · 2 weeks

**Objective:** Customers render blocks without hand-rolling every block type.

| Task | Files / area |
|------|----------------|
| Extract DOM renderer from server block walker | `client/src/modules/contentStudio/headless/renderBlocks.ts` |
| Semantic HTML only; zero default CSS | renderer |
| Optional `components` override map (heading, callout, image, …) | API design |
| Vanilla usage docs + example in settings integration tab | `ContentPublishingSettings.vue` (HC-6) |
| Mirror critical block types from `CONTENT_STUDIO_PROSEMIRROR_NODE_TYPES` | renderer + tests |
| Package boundary decision: in-repo module first; npm `@arivu/content-blocks` later | doc only in v1 |

**Exit criteria**

- [ ] Example page renders full article from API JSON using SDK
- [ ] Block types in editor v1 all map to semantic output or graceful fallback
- [ ] Unit tests for renderer parity with server block types

---

### HC-5 — JSON embed v2 · 3–5 days

**Objective:** WordPress/Squarespace integration without iframe.

| Task | Files / area |
|------|----------------|
| Extend `client/public/embed/content.js` | support `data-format="json"`, `data-slug`, `data-collection="help|blog"` |
| Fetch headless API → call `renderBlocks` into mount node | embed script |
| Keep existing iframe mode as `data-mode="iframe"` (default for backward compat) | embed script |
| Update embed snippet generator | `contentPublishingService.js` `buildEmbedSnippet` |

**Exit criteria**

- [ ] JSON embed injects content into customer div with no iframe
- [ ] Customer CSS can style `#arivu-content` descendants
- [ ] iframe embed still works unchanged

---

### HC-6 — Developer experience (Settings + docs) · 1 week

**Objective:** Tenant admin can integrate without support tickets.

| Task | Files / area |
|------|----------------|
| Integration tab: API examples (curl, fetch, Next.js) | `ContentPublishingSettings.vue` |
| Copy buttons for endpoints + sample JSON | settings UI |
| "Send test webhook" button | new settings API route |
| Route `?view=api` deep link | router + settings |
| i18n for all new strings | `settings.json` + `npm run i18n:sync-keys` |

**Exit criteria**

- [ ] Admin copies working API URL and sample response from settings
- [ ] Test webhook delivers to configured URL
- [ ] i18n check passes

---

### HC-7 — Webhook hardening · 3–5 days

**Objective:** Reliable SSG rebuild loop (Sanity's primary DX pattern).

| Task | Files / area |
|------|----------------|
| Add `apiUrl` to webhook payload | `contentPublishingWebhookService.js` |
| Add `content.unpublished` event | `contentDocumentService.js` unpublish path |
| Optional webhook secret + `X-Arivu-Signature` HMAC | org `contentPublishing.webhookSecret` |
| Retry failed webhooks (job queue or scheduled retry) | new lightweight service |
| Tests for signature + payload shape | `__tests__/contentPublishingWebhookService.test.js` |

**Exit criteria**

- [ ] Publish/unpublish fire correct events with `apiUrl`
- [ ] HMAC verification documented for customers
- [ ] Failed webhook retried at least once

---

### HC-8 — Public asset transforms · 1 week

**Objective:** Responsive images without full-size originals.

| Task | Files / area |
|------|----------------|
| `GET /api/public/v1/assets/:assetId?w=&h=&fit=` | new route + controller |
| Signed or org-scoped public access | reuse asset service |
| Helper in SDK: `buildAssetUrl(id, { w, h, fit })` | headless module |
| Resolve transforms in block walker for `image` nodes | `headlessContentShaper.js` |

**Exit criteria**

- [ ] Image URLs in API accept width/height params
- [ ] CDN/cache headers set appropriately

---

### HC-9 — Enterprise headless (future · CS-6 overlap)

Deferred until HC-1–HC-7 ship and tenants adopt:

- GraphQL read API
- Read API keys + rate-limit tiers
- Multi-site / locale variants per tenant
- Edge CDN cache invalidation
- Custom block SDK for tenant-defined block types
- Static export (ZIP of JSON + assets)

**Articles static sync (incremental HTML + assets on customer domain):** active track — [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](./ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md) (implements export API, public asset download, `@arivu/help-sync`, Next/PHP templates; overlaps HC-8 asset transforms and HC-9 ZIP export).

---

## 7. Implementation order

```
HC-1 (Articles JSON API)
  → HC-2 (Blog public API)
  → HC-3 (Channel renderer split)
  → HC-4 (Client SDK)
  → HC-5 (JSON embed)
  → HC-6 (Developer UX)
  → HC-7 (Webhooks)
  → HC-8 (Asset transforms)
  → HC-9 (Enterprise — later)
```

**First PR scope (HC-1):** `headlessContentShaper.js`, `format` query param, tests, no UI changes required.

---

## 8. Testing strategy

| Layer | Approach |
|-------|----------|
| Unit | Shaper output shape, asset resolution, format gating |
| Integration | Public routes with mock org + published doc |
| Contract | Snapshot JSON fixtures per block type |
| Manual | Next.js or static HTML page fetching staging API |
| Regression | Hosted HTML + iframe embed unchanged (`format=html`) |

---

## 9. Analytics (PostHog)

| Event | When |
|-------|------|
| `content_headless_api_request` | Public API `format=json` (sampled) |
| `content_webhook_delivered` | Webhook 2xx |
| `content_webhook_failed` | Webhook error after retries |
| `content_embed_json_mounted` | JSON embed script success |

---

## 10. Security & permissions

- Public API: no auth for published public content; org slug + hostname resolution unchanged.
- Rate limit: existing `publicContentLimiter` (120/min); revisit after launch.
- Webhook secret: optional HMAC; never log secret.
- Asset URLs: public only for assets referenced in published public documents.
- `headlessApiEnabled=false` → return 403 on `format=json` requests.

---

## 11. Success metrics

| Metric | Target (90 days post HC-1) |
|--------|---------------------------|
| Tenants with `publishingTarget=headless` | ≥ 5 pilot tenants |
| Headless API requests/week | Tracked; baseline TBD |
| Support tickets "embed breaks my CSS" | Decrease vs iframe-only |
| Time to first external render | < 30 min with settings docs |

---

## 12. References

| Doc | Role |
|-----|------|
| [CONTENT_STUDIO_ARCHITECTURE.md](./adr/CONTENT_STUDIO_ARCHITECTURE.md) | Block model, channels, addon gates |
| [CONTENT_STUDIO_ROADMAP.md](./CONTENT_STUDIO_ROADMAP.md) | CS-3 tenant publishing, CS-6 enterprise |
| [ContentEngine.md](./ContentEngine.md) | Product spec |
| `server/services/contentStudio/publicContentService.js` | Current public API |
| `server/services/contentStudio/contentPublishingWebhookService.js` | Webhooks |
| `client/public/embed/content.js` | Current iframe embed |

---

## 13. HC-1 task checklist (immediate next steps)

Use this checklist for the first implementation PR:

- [ ] Create `headlessContentShaper.js` with `shapeHeadlessArticleDetail(doc, blocks)`
- [ ] Add `resolveAssetUrlsInBlocks(blocks, organizationId)`
- [ ] Add `resolvePublicFormat(req, publishingSettings)` → `'json' | 'html'`
- [ ] Wire `format` in `publicContentController` + `publicContentService`
- [ ] Headless list endpoint: summary only (no blocks); detail includes blocks
- [ ] Tests: JSON excludes branding; HTML unchanged; headless-only org blocks web surface
- [ ] No breaking change: default `format=html` for existing web fetches (`surface=web`)

**Suggested branch:** `feat/headless-content-hc1`
