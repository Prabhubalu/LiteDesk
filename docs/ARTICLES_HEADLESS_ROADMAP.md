# Articles Headless Delivery — Completion Roadmap

**Status:** Complete (v1)  
**Date:** 2026-07-07  
**Scope:** Articles addon only — finish end-to-end before Blog  
**Parent:** [HEADLESS_CONTENT_ROADMAP.md](./HEADLESS_CONTENT_ROADMAP.md) · [CONTENT_STUDIO_ROADMAP.md](./CONTENT_STUDIO_ROADMAP.md)

---

## 1. Product promise (Articles)

Publish a **public** article in LiteDesk → fetch JSON from your website → render with **your** layout, CSS, and components. LiteDesk never injects branding on headless consumers.

**Out of scope for Articles v1:** Blog API, hosted help pages, iframe embed, custom domains, GraphQL, read API keys.

---

## 2. End-to-end flow

```
Author (Helpdesk → Articles)
  → visibility: public
  → Publish
LiteDesk
  → stores blocks JSON (ContentDocumentVersion)
  → POST webhook (optional)
  → serves GET /api/public/v1/content/:orgSlug/articles/:slug
Customer site (xyz.com)
  → fetch JSON
  → renderBlocks(blocks) with customer CSS
  → optional SSG rebuild on webhook
```

**Portal KB** (`/portal/knowledge`) stays a separate, authenticated, branded channel — not headless.

---

## 3. Baseline (done)

| Item | Status |
|------|--------|
| Tiptap block authoring | ✅ |
| `visibility: public` in Articles editor | ✅ |
| Publish / unpublish lifecycle | ✅ |
| Headless JSON API (`/articles`, `/articles/:slug`, `/help` aliases) | ✅ |
| Sitemap (`/sitemap.xml`) | ✅ |
| Asset URL resolution in blocks (`headlessContentShaper`) | ✅ |
| Gates: addon + `headlessApiEnabled` + published + public | ✅ |
| Publish config in **Settings → Addons → Articles** | ✅ |
| `content.published` webhook with `apiUrl` | ✅ |
| Hosted pages / embed / Content Publishing tab | ❌ Removed |
| Client fetch helpers (`usePublicHelp.js`) | ✅ |

---

## 4. Remaining work (Articles completion)

### A-1 — Client block renderer SDK · **P0** ✅

**Objective:** Customers render API `blocks` without hand-mapping every node type.

| Task | Location |
|------|----------|
| `renderBlocksToHtml`, `renderBlocksToElement`, `blocksToPlainText` | `client/src/modules/contentStudio/headless/renderBlocks.ts` |
| Semantic HTML only — no default CSS or LiteDesk classes | renderer |
| Optional `components` override map | renderer API |
| Unit tests for core block types | `headless/__tests__/renderBlocks.test.ts` |

**Exit criteria**

- [x] All editor v1 block types render or degrade gracefully
- [x] Vitest passes
- [x] Example HTML page renders a fixture article

---

### A-2 — Developer UX (Articles addon settings) · **P0** ✅

**Objective:** Admin integrates without support tickets.

| Task | Location |
|------|----------|
| Copy buttons for API URLs | `ArticlesAddonSettings.vue` |
| curl + fetch + renderBlocks snippets | settings integration section |
| “Send test webhook” button | settings UI + `POST .../articles/settings/test-webhook` |
| i18n (en + sync-keys) | `en/settings.json` |

**Exit criteria**

- [x] Admin copies working list/article API URL from settings
- [x] Test webhook delivers sample `content.published` payload
- [x] Code examples reference headless renderer import path

---

### A-3 — Webhook lifecycle · **P1** ✅

**Objective:** SSG rebuild loop on publish **and** unpublish.

| Task | Location |
|------|----------|
| `content.unpublished` event | `contentPublishingWebhookService.js` |
| Fire on unpublish (articles, public visibility) | `contentDocumentService.js` |
| Unit tests for payload shape | `__tests__/contentPublishingWebhookService.test.js` |

**Deferred (post–Articles v1):** HMAC signature, retry queue, webhook secret field.

**Exit criteria**

- [x] Unpublish fires `content.unpublished` with `apiUrl`
- [x] Tests pass

---

### A-4 — Authoring clarity · **P2** ✅

**Objective:** Authors understand why headless API may not return their article.

| Task | Location |
|------|----------|
| Publish confirmation when `visibility !== public` | `ContentStudioEditorPage.vue` |
| Inspector helper text for `visibilityPublic` | `ContentStudioInspector.vue` + i18n |

**Exit criteria**

- [x] Public visibility requirement visible before/during publish

---

### A-5 — Integration example · **P1** ✅

**Objective:** Prove fetch → render on a static page.

| Task | Location |
|------|----------|
| Static HTML example (fetch + `renderBlocksToHtml`) | `docs/examples/headless-article.html`, `client/public/examples/headless-article.html` |
| Link from Articles addon settings | settings integration section |

**Exit criteria**

- [x] Example runs against staging API with org slug + slug placeholders

---

### A-6 — Public asset transforms · **P3 (defer)**

Responsive `?w=&h=` on public assets — see HC-8 in parent roadmap. Not required for Articles v1 launch.

---

## 5. Implementation order

```
A-1 (renderBlocks SDK)
  → A-2 (settings DX)
  → A-3 (unpublish webhook)
  → A-5 (example page)
  → A-4 (authoring hints)
  → A-6 (later)
```

**Blog headless** starts only after A-1–A-3 exit criteria are checked off.

---

## 6. Articles v1 exit checklist

Before marking Articles headless **complete**:

- [x] Public API returns JSON for published + public articles
- [x] Headless API disabled when `headlessApiEnabled` is off
- [x] `renderBlocks` SDK shipped with tests
- [x] Settings show API URLs, copy buttons, and code examples
- [x] Test webhook works
- [x] Publish + unpublish webhooks fire with `apiUrl`
- [x] Static integration example documented
- [x] CI: shaper, public access, sitemap, renderer tests green (verify in PR)

---

## 7. API reference (Articles headless)

```
GET /api/public/v1/content/:orgSlug/collections
GET /api/public/v1/content/:orgSlug/articles
GET /api/public/v1/content/:orgSlug/articles/recent
GET /api/public/v1/content/:orgSlug/articles/popular
GET /api/public/v1/content/:orgSlug/articles/:slug
GET /api/public/v1/content/:orgSlug/help          (alias — list)
GET /api/public/v1/content/:orgSlug/help/:slug    (alias — detail)
GET /api/public/v1/content/:orgSlug/help/recent   (alias)
GET /api/public/v1/content/:orgSlug/help/popular  (alias)
GET /api/public/v1/content/:orgSlug/sitemap.xml
POST /api/public/v1/content/render-blocks
```

Query params:

- `GET /articles` — `page`, `limit`, `search`, `collection`, `deep=1`
- `GET /articles/recent` — `limit`, `collection`, `deep=1`
- `GET /articles/popular` — `limit`, `collection`, `deep=1` (featured articles only)

Legacy: `/api/public/content/...`

**Gates:** Articles addon enabled · `settings.publishing.headlessApiEnabled` · `status: published` · `visibility: public`

**Response:** JSON only — `blocks`, metadata, `seo`, `coverImage`, `plainText`. No `bodyHtml`, no `appearance`.

**Help Center v2 (customer `/help` UX):** [ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md](./ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md) — collections tree, category/section embeds, sidebars, featured popular articles.

**Customer URL model (recommended):**

| Page | Customer URL |
|------|----------------|
| Home | `/help/` |
| Category | `/help/{category}` |
| Section | `/help/{category}/{section}` |
| Article | `/help/{category}/{section}/{article}` |

Use website embed snippets in Articles addon settings (`headless-help-home.js`, `headless-help-category.js`, `headless-help-section.js`, `headless-article.js`).

**Customer site setup guide:** [ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md](./ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md) — full `xyz.com/help` wiring (CORS, routes, embed snippets, SPA pattern).

---

## 8. Webhook events

| Event | When |
|-------|------|
| `content.published` | Article published (`addonKey: articles`) |
| `content.unpublished` | Article unpublished |
| Test payload | `POST /api/settings/addons/articles/settings/test-webhook` |

Payload includes `content.apiUrl` pointing at the headless article endpoint.
