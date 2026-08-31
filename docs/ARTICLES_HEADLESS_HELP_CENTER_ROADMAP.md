# Articles Headless Help Center — Roadmap

**Status:** Approved for implementation  
**Date:** 2026-07-07  
**Owner:** Platform / Content Studio  
**Scope:** Customer-site `/help` UX (categories, sections, sidebars) — **not** Arivu-hosted pages  
**Parent:** [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md) (v1 complete) · [HEADLESS_CONTENT_ROADMAP.md](./HEADLESS_CONTENT_ROADMAP.md)

---

## 1. Product promise

A tenant publishes **public** articles in Content Studio. Their website (`xyz.com/help`) shows a **full help center**:

- KB home with **category grid**
- **Category / section** pages with article lists
- **Article** pages with block content, breadcrumbs, and sidebar widgets
- **Search** across published public articles

Arivu delivers **JSON + neutral embed scripts**. The customer owns layout, CSS, and routing.

**Reference UX:** [Zoho CRM KB](https://help.zoho.com/portal/en/kb/crm/getting-started/articles/welcome-to-zoho-crm) — hierarchical collections, section tree, popular/recent sidebars, in-article anchors.

**Hard rules (unchanged from headless v1)**

1. No Arivu-hosted `/help` pages, custom domains, or iframe shell.
2. Public API returns JSON only — no `bodyHtml`, no `appearance`.
3. Reuse `ContentCollection`, `ContentDocument`, `publicContentService` — no parallel CMS.
4. Gates: Articles addon · `headlessApiEnabled` · `status: published` · `visibility: public`.

---

## 2. Customer URL model (recommended)

Customer implements routes; Arivu embeds/API accept slugs via `data-*` attrs or query params.

**Nested collections (Zoho-style)**

```
/help                                    → KB home (root collections)
/help/{collectionSlug}                   → category (child sections + sidebar)
/help/{parentSlug}/{sectionSlug}       → section (articles + section tree)
/help/{parentSlug}/{sectionSlug}/{articleSlug}  → article
```

**Single-level KB (simpler tenants)**

```
/help
/help/{sectionSlug}
/help/{sectionSlug}/{articleSlug}
```

Article anchors: `.../{articleSlug}#{headingAnchorId}` (already supported in blocks).

---

## 3. Page components (target)

| Page | Main column | Sidebar |
|------|-------------|---------|
| **KB home** | Search, root collection cards (`N Articles · M Sections`) | — |
| **Category** | Child section rows with counts | Category title/description, popular, recent |
| **Section** | Article list | Section info, expandable **KB sections** tree |
| **Article** | `headless-article.js` body (TOC, FAQ, tabs, related blocks) | Breadcrumbs, section tree, popular, recent |

---

## 4. Baseline (done — headless v1 + session work)

| Item | Status |
|------|--------|
| `ContentCollection` (`parentId`, `slug`, `description`, `sortOrder`) | ✅ |
| Articles assigned to `collectionId` | ✅ |
| Public list/detail JSON API | ✅ |
| `headless-article.js` (single article embed) | ✅ |
| `headless-article-list.js` (flat list + search) | ✅ |
| Presentation chrome (overlap, table widths) in embed | ✅ |
| Portal KB with collections (`/portal/knowledge`) | ✅ (auth, separate channel) |
| Public **collections** API | ❌ |
| Collection-filtered public list | ❌ |
| Recent / popular endpoints | ❌ |
| Category grid / section tree embeds | ❌ |
| Article page breadcrumbs + sidebar | ❌ |
| `viewCount` or `featured` for popular | ❌ |

**Reuse from portal (adapt gates to `visibility: public`):**

- `contentStudioPortalService.listPortalCollections` — counts aggregation
- `PortalKnowledge.vue` — UX reference for chips, cards, search

---

## 5. Phases

### HC-H1 — Public collections API · **P0**

**Objective:** Customer site can build category/section navigation from JSON.

| Task | Location |
|------|----------|
| `listPublicHelpCollections({ orgSlug })` — tree + counts | `publicContentService.js` |
| Shape: `id`, `name`, `slug`, `description`, `parentId`, `articleCount`, `sectionCount`, `children[]` | `headlessContentShaper.js` or inline |
| `GET /:orgSlug/collections` | `publicContentRoutes.js`, `publicContentController.js` |
| `GET /:orgSlug/articles?collection={slug}` — filter by collection (include descendants: optional query `deep=1`) | `publicContentService.js` |
| Extend list summary: `collectionSlug`, `collectionName` | `shapeHeadlessArticleSummary` |
| Rate limit + cache headers (match existing public routes) | controller |
| Unit tests | `server/services/contentStudio/__tests__/publicHelpCollections.test.js` |

**Exit criteria**

- [ ] `GET .../collections` returns nested tree with `articleCount` and `sectionCount` per node
- [ ] Empty collections omitted (match portal behavior) or included with zero counts (document choice in PR)
- [ ] `GET .../articles?collection=getting-started` returns only public published articles in that collection
- [ ] Tests pass in CI

---

### HC-H2 — Recent articles API · **P0**

**Objective:** Sidebar “Recent articles” without client-side sorting of full catalog.

| Task | Location |
|------|----------|
| `GET /:orgSlug/articles/recent?limit=5&collection={slug}` | `publicContentService.js`, routes, controller |
| Sort: `publishedAt` desc, fallback `updatedAt` | query |
| Same gates as list endpoint | existing `buildPublicArticlesQuery` |

**Exit criteria**

- [ ] Returns summary shape only (no `blocks`)
- [ ] Optional `collection` scope
- [ ] Tests pass

---

### HC-H3 — Help home embed · **P0**

**Objective:** `xyz.com/help` shows category grid without custom fetch code.

| Task | Location |
|------|----------|
| `headless-help-home.js` — fetch collections + render grid | `client/public/embed/` |
| CSS: `.ld-help-home`, `.ld-help-home__card`, stats line | `headless-blocks.css` |
| Attrs: `data-org`, `data-target`, `data-api-origin`, `data-link-prefix="/help/"` | embed script |
| Global search → redirect or inline filter (v1: form submits to `/help/search?q=` or customer hook) | embed |
| `window.ArivuHeadlessHelpHome.mount()` | embed API |
| Example page | `HeadlessHelpHomeExample.vue`, route `/examples/headless-help-home` |
| Settings snippet | `ArticlesAddonSettings.vue` |
| i18n (en + sync-keys) | `en/settings.json`, `en/contentStudio.json` |

**Exit criteria**

- [ ] Demo page renders collection cards from public API
- [ ] Card links use `data-link-prefix` (no leading-slash slug bugs)
- [ ] Copy snippet in Articles addon settings

---

### HC-H4 — Category & section embeds · **P0**

**Objective:** Intermediate pages between home and article.

| Task | Location |
|------|----------|
| `headless-help-category.js` — sections list + breadcrumbs | `client/public/embed/` |
| `headless-help-section.js` — article list + section tree sidebar | embed |
| Attrs: `data-collection`, `data-parent`, `data-section` | embed |
| Fetch recent (+ popular when HC-H6 exists) for sidebar | embed |
| CSS for breadcrumbs, section rows, tree nav | `headless-blocks.css` |
| Example pages or single demo with query params | `client/src/views/` |

**Exit criteria**

- [ ] Category page lists child sections with article/section counts
- [ ] Section page lists articles; sidebar shows expandable collection tree
- [ ] Breadcrumbs reflect collection hierarchy

---

### HC-H5 — Article page chrome · **P1**

**Objective:** Article embed matches Zoho article context (nav, not just body).

| Task | Location |
|------|----------|
| Extend `headless-article.js` or add `headless-help-article-chrome.js` wrapper | embed |
| Breadcrumbs from collection chain (fetch collections once, cache) | embed |
| Optional sidebar: section tree, recent | embed |
| `data-show-sidebar="true"`, `data-collection`, `data-section` | attrs |
| Link related-articles block URLs to customer `data-link-prefix` | `contentStudioBlockRenderer.js` + headless blocks init |

**Exit criteria**

- [ ] Article page demo shows breadcrumbs + body + sidebar widgets
- [ ] Heading anchor links work (`#{anchorId}`)

---

### HC-H6 — Popular articles · **P1**

**Objective:** “Popular articles” sidebar on category/section/article pages.

**Option A (recommended v1):** Editor `featured` boolean on `ContentDocument` — no analytics pipeline.

| Task | Location |
|------|----------|
| `featured: Boolean` on model (default false) | `ContentDocument.js` |
| Inspector toggle in Articles editor | `ContentStudioInspector.vue` |
| `GET .../articles/popular?limit=5&collection=` | `publicContentService.js` |
| Sort: featured first, then `publishedAt` | query |

**Option B (later):** `viewCount` + anonymous `POST .../articles/:slug/view` beacon.

**Exit criteria**

- [ ] Popular endpoint returns at least featured articles
- [ ] Sidebar embed shows popular block

---

### HC-H7 — Developer UX & docs · **P1**

| Task | Location |
|------|----------|
| Settings: embed snippets for home, category, section, article | `ArticlesAddonSettings.vue` |
| Integration examples (fetch collections + render) | settings section |
| Update [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md) §8 with new endpoints | docs |
| Sitemap: optional collection URL entries | `buildPublicHelpSitemapXml` |

**Exit criteria**

- [ ] Admin can copy all embed snippets from settings
- [ ] Example URLs documented for each page type

---

### HC-H8 — Polish · **P2**

| Task | Notes |
|------|-------|
| Collection `iconUrl` or emoji field | Optional card icon on home grid |
| `usePublicHelp.js` helpers for collections/recent/popular | Client composable parity |
| PostHog: `headless_help_viewed` module events | Merge checklist |
| Non-EN i18n complete | `i18n:sync-keys` |

---

## 6. API reference (target)

All under `/api/public/v1/content/:orgSlug` (legacy alias `/api/public/content/...`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/collections` | Nested collection tree + counts |
| GET | `/articles` | List (existing); add `?collection={slug}&search=&page=&limit=` |
| GET | `/articles/recent` | Recent summaries; `?limit=&collection=` |
| GET | `/articles/popular` | Popular/featured summaries (HC-H6) |
| GET | `/articles/:slug` | Detail + blocks (existing) |
| GET | `/help`, `/help/:slug` | Aliases (existing) |
| GET | `/sitemap.xml` | Existing; extend with collection paths (HC-H7) |
| POST | `/render-blocks` | Existing |

**Collection summary shape**

```json
{
  "id": "...",
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "...",
  "parentId": "...",
  "parentSlug": "crm",
  "articleCount": 4,
  "sectionCount": 0,
  "children": []
}
```

---

## 7. Embed scripts inventory (target)

| Script | Customer page | API calls |
|--------|---------------|-----------|
| `headless-help-home.js` | `/help` | collections, search → articles |
| `headless-help-category.js` | `/help/{collection}` | collections, recent, popular |
| `headless-help-section.js` | `/help/{parent}/{section}` | collections, articles?collection=, recent, popular |
| `headless-article.js` | `.../{articleSlug}` | articles/:slug, render-blocks |
| `headless-article-list.js` | Legacy flat list (keep) | articles |
| `headless-blocks.css` | All pages | — |
| `headless-blocks.js` | Article pages | interactive blocks |

---

## 8. Out of scope

- Arivu-hosted help center pages or custom domains
- Portal features on public site (follow/subscribe, Add Request, Add Topic)
- Full-text search engine / Algolia (use existing Mongo `$regex` / `searchText` until CS-4)
- Blog collections on `/help` (Blog addon separate track)
- Multi-locale KB routing (`/en/kb/...`) — customer routing concern; API may add `?lang=` later
- Agent-only or internal articles on public endpoints

---

## 9. Implementation order

```
HC-H1 (collections API + collection filter)
  → HC-H2 (recent)
  → HC-H3 (help home embed)
  → HC-H4 (category + section embeds)
  → HC-H5 (article chrome)
  → HC-H6 (popular / featured)
  → HC-H7 (settings + docs)
  → HC-H8 (polish)
```

**First shippable milestone:** Public collections API + `headless-help-home.js` → `xyz.com/help` shows category grid with working links to section pages.

**Customer site setup:** [ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md](./ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md)

---

## 10. Exit checklist (Help Center v1)

- [ ] `xyz.com/help` pattern documented and demoed
- [ ] Collections tree public API live
- [ ] Home, category, section, article embeds shipped
- [ ] Recent sidebar on category/section/article
- [ ] Popular or featured articles on sidebar
- [ ] Breadcrumbs on section and article pages
- [ ] Search works from KB home
- [ ] Settings snippets for all embed types
- [ ] Server + embed tests green
- [ ] No hosted Arivu pages introduced

---

## 11. Related code (start here)

| Area | Path |
|------|------|
| Public content service | `server/services/contentStudio/publicContentService.js` |
| Portal collections (mirror logic) | `server/services/contentStudio/contentStudioPortalService.js` |
| Collection model | `server/models/ContentCollection.js` |
| Article embed | `client/public/embed/headless-article.js` |
| Flat list embed | `client/public/embed/headless-article-list.js` |
| Portal KB UI reference | `client/src/views/portal/PortalKnowledge.vue` |
| Articles settings | `client/src/components/settings/ArticlesAddonSettings.vue` |
