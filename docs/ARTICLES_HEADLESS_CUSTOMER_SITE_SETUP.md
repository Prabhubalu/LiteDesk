# Headless Help Center — Customer Site Setup (`xyz.com`)

**Audience:** Tenant admins, customer web developers  
**Scope:** Embed LiteDesk Articles on a **customer-owned** website (e.g. `https://xyz.com/help`)  
**Related:** [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md) · [ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md](./ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md)

---

## 1. How it works

LiteDesk does **not** host your help pages. You publish articles in Content Studio; LiteDesk exposes a **public JSON API** and **neutral embed scripts**. Your site owns routing, layout, and branding.

```text
xyz.com/help                    → headless-help-home.js      → GET /collections
xyz.com/help/{category}         → headless-help-category.js  → collections + sidebars
xyz.com/help/{cat}/{section}    → headless-help-section.js   → articles + tree
xyz.com/help/.../{article}      → headless-article.js        → article + render-blocks
```

**Data flow**

```text
Browser on xyz.com
  ├── loads /embed/*.js + headless-blocks.css (from LiteDesk app or self-hosted copy)
  └── fetch JSON → https://{litedesk-app}/api/public/v1/content/{org-slug}/...
```

---

## 2. Prerequisites (LiteDesk tenant)

| Requirement | Where |
|-------------|--------|
| **Articles addon** installed | Settings → Add-ons |
| **Headless API enabled** | Settings → Add-ons → Articles → Publishing |
| **Organization slug** known | e.g. `acme-corp` (used as `{org-slug}` in API URLs) |
| **Collections** created | Content Studio → Settings panel → Collections |
| Articles **published** with **visibility: Public** | Content Studio → Publish |

**Public API gates (all must pass):**

- Articles addon enabled  
- `settings.publishing.headlessApiEnabled === true`  
- Article `status: published`  
- Article `visibility: public`

If any gate fails, the API returns empty lists or 404 — not an auth error.

---

## 3. Configure LiteDesk

### 3.1 Enable headless publishing

1. Open **Settings → Add-ons → Articles**.
2. Under **Publishing**, ensure **Headless API** is enabled.
3. Save settings.

### 3.2 Copy your API base URL

In the same settings page, under **Integration**, copy:

```text
https://{your-litedesk-app}/api/public/v1/content/{org-slug}
```

Example endpoints (replace `{org-slug}` and `{slug}`):

| Endpoint | Purpose |
|----------|---------|
| `GET .../collections` | Category/section tree |
| `GET .../articles?search=&collection=&page=&limit=` | Article list / search |
| `GET .../articles/recent` | Recent sidebar |
| `GET .../articles/popular` | Featured (“popular”) sidebar |
| `GET .../articles/{slug}` | Single article JSON |
| `POST .../articles/{slug}/feedback` | Helpful vote / share analytics |
| `POST .../render-blocks` | Render ProseMirror blocks → HTML |
| `GET .../sitemap.xml` | SEO sitemap for public articles + collections |

Legacy alias: `/api/public/content/...` (same routes).

### 3.3 Copy embed snippets

Still in **Articles addon settings**, use the **Embed** section. Copy the snippet for each page type:

- Help home  
- Category  
- Section  
- Article  
- Flat list (legacy)

Snippets are pre-filled with your org slug and LiteDesk app origin.

### 3.4 Try LiteDesk demos first

Before wiring `xyz.com`, verify content in LiteDesk examples (replace `org` with your slug):

| Page | Demo URL |
|------|----------|
| Home | `/examples/headless-help-home?org={org-slug}` |
| Category | `/examples/headless-help-category?org={org-slug}&collection={category-slug}` |
| Section | `/examples/headless-help-section?org={org-slug}&section={section-slug}&parent={category-slug}` |
| Article | `/examples/headless-article?org={org-slug}&slug={article-slug}` |

---

## 4. Recommended URL structure on `xyz.com`

| Page | URL pattern | Embed script |
|------|-------------|--------------|
| Help home | `https://xyz.com/help/` | `headless-help-home.js` |
| Category | `https://xyz.com/help/{category}` | `headless-help-category.js` |
| Section | `https://xyz.com/help/{category}/{section}` | `headless-help-section.js` |
| Article | `https://xyz.com/help/{category}/{section}/{article}` | `headless-article.js` |

Slugs must match **collection slugs** and **article slugs** in Content Studio (lowercase, URL-safe).

You may use a different path (e.g. `/support/`). Set `data-link-prefix`, `data-home-prefix`, `data-category-prefix`, `data-section-prefix`, and `data-article-prefix` accordingly on every embed.

---

## 5. CORS (required for browser embeds)

Embed scripts call the LiteDesk API from the **visitor’s browser**. The customer origin must be allowed by LiteDesk CORS.

**Production:** add the customer site to the LiteDesk server env:

```bash
CORS_ORIGINS=https://xyz.com,https://www.xyz.com
```

Wildcard subdomain patterns are supported, e.g. `https://*.xyz.com`.

**Development:** localhost origins are allowed by default.

**If CORS is not configured:** browser requests from `xyz.com` to the LiteDesk API will fail. Options:

1. Add the domain to `CORS_ORIGINS` (recommended).  
2. Build a **server-side proxy** on `xyz.com` that fetches JSON from LiteDesk and injects HTML (custom integration; embed scripts not used).

---

## 6. Page setup on `xyz.com`

Replace placeholders:

- `{LITEDESK_ORIGIN}` — e.g. `https://app.litedesk.com`  
- `{ORG_SLUG}` — your tenant slug  
- `{CATEGORY}`, `{SECTION}`, `{ARTICLE}` — Content Studio slugs  

When embed **JS/CSS are loaded from LiteDesk** but the page lives on `xyz.com`, add:

```html
data-api-origin="{LITEDESK_ORIGIN}"
```

on each embed `<script>` tag so API calls target LiteDesk, not `xyz.com`.

### 6.1 Help home — `https://xyz.com/help/`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Help Center</title>
  <link rel="stylesheet" href="{LITEDESK_ORIGIN}/embed/headless-blocks.css" />
</head>
<body>
  <header><!-- your site chrome --></header>
  <main id="help-home"></main>
  <footer><!-- your site footer --></footer>

  <script
    src="{LITEDESK_ORIGIN}/embed/headless-help-home.js"
    data-api-origin="{LITEDESK_ORIGIN}"
    data-org="{ORG_SLUG}"
    data-target="#help-home"
    data-link-prefix="/help/"
    data-title="Help Center"
  ></script>
</body>
</html>
```

**Programmatic mount** (SPA):

```javascript
await window.LiteDeskHeadlessHelpHome.mount({
  org: '{ORG_SLUG}',
  target: '#help-home',
  apiOrigin: '{LITEDESK_ORIGIN}',
  linkPrefix: '/help/',
  title: 'Help Center',
});
```

Search on the home page queries `GET .../articles?search={q}&limit=20` inline.

### 6.2 Category — `https://xyz.com/help/{category}`

```html
<link rel="stylesheet" href="{LITEDESK_ORIGIN}/embed/headless-blocks.css" />
<div id="help-category"></div>
<script src="{LITEDESK_ORIGIN}/embed/headless-help-common.js"></script>
<script
  src="{LITEDESK_ORIGIN}/embed/headless-help-category.js"
  data-api-origin="{LITEDESK_ORIGIN}"
  data-org="{ORG_SLUG}"
  data-collection="{CATEGORY}"
  data-target="#help-category"
  data-home-prefix="/help/"
  data-link-prefix="/help/"
  data-section-prefix="/help/"
  data-article-prefix="/help/"
></script>
```

### 6.3 Section — `https://xyz.com/help/{category}/{section}`

```html
<link rel="stylesheet" href="{LITEDESK_ORIGIN}/embed/headless-blocks.css" />
<div id="help-section"></div>
<script src="{LITEDESK_ORIGIN}/embed/headless-help-common.js"></script>
<script
  src="{LITEDESK_ORIGIN}/embed/headless-help-section.js"
  data-api-origin="{LITEDESK_ORIGIN}"
  data-org="{ORG_SLUG}"
  data-section="{SECTION}"
  data-parent="{CATEGORY}"
  data-target="#help-section"
  data-home-prefix="/help/"
  data-category-prefix="/help/"
  data-section-prefix="/help/"
  data-article-prefix="/help/"
></script>
```

### 6.4 Article — `https://xyz.com/help/.../{article}`

```html
<link rel="stylesheet" href="{LITEDESK_ORIGIN}/embed/headless-blocks.css" />
<div id="help-article"></div>
<script
  src="{LITEDESK_ORIGIN}/embed/headless-article.js"
  data-api-origin="{LITEDESK_ORIGIN}"
  data-org="{ORG_SLUG}"
  data-slug="{ARTICLE}"
  data-target="#help-article"
  data-show-sidebar="true"
  data-show-breadcrumbs="true"
  data-home-prefix="/help/"
  data-category-prefix="/help/"
  data-section-prefix="/help/"
  data-article-prefix="/help/"
  data-collection="{CATEGORY}"
  data-section="{SECTION}"
></script>
```

Article pages include:

- Breadcrumbs and section tree (when sidebar enabled)  
- Popular + recent sidebars  
- **Helpful?** feedback footer and social share buttons (stored in Article analytics)

**Programmatic mount:**

```javascript
await window.LiteDeskHeadlessArticle.mount({
  org: '{ORG_SLUG}',
  slug: '{ARTICLE}',
  target: '#help-article',
  apiOrigin: '{LITEDESK_ORIGIN}',
  showSidebar: true,
  showBreadcrumbs: true,
  homePrefix: '/help/',
  categoryPrefix: '/help/',
  sectionPrefix: '/help/',
  articlePrefix: '/help/',
  collection: '{CATEGORY}',
  section: '{SECTION}',
  helpfulLabel: 'Helpful?',
  shareLabel: 'Share :',
});
```

---

## 7. SPA / framework routing (React, Next.js, etc.)

Use one HTML shell per route. On navigation, call the global `mount()` with slugs parsed from the URL.

**Example (pseudo-code):**

```javascript
const LITEDESK = 'https://app.litedesk.com';
const ORG = 'acme-corp';

function parseHelpPath(pathname) {
  // /help/crm/getting-started/welcome
  const parts = pathname.replace(/^\/help\/?/, '').split('/').filter(Boolean);
  return {
    category: parts[0] || '',
    section: parts[1] || '',
    article: parts[2] || '',
  };
}

async function renderHelpPage(pathname) {
  const { category, section, article } = parseHelpPath(pathname);
  if (article) {
    return window.LiteDeskHeadlessArticle.mount({
      org: ORG,
      slug: article,
      target: '#help-root',
      apiOrigin: LITEDESK,
      showSidebar: true,
      collection: category,
      section: section,
      homePrefix: '/help/',
      articlePrefix: '/help/',
    });
  }
  if (section) {
    await loadScript(`${LITEDESK}/embed/headless-help-common.js`);
    return window.LiteDeskHeadlessHelpSection.mount({
      org: ORG,
      section,
      parent: category,
      target: '#help-root',
      apiOrigin: LITEDESK,
      homePrefix: '/help/',
    });
  }
  if (category) {
    await loadScript(`${LITEDESK}/embed/headless-help-common.js`);
    return window.LiteDeskHeadlessHelpCategory.mount({
      org: ORG,
      collection: category,
      target: '#help-root',
      apiOrigin: LITEDESK,
      linkPrefix: '/help/',
    });
  }
  return window.LiteDeskHeadlessHelpHome.mount({
    org: ORG,
    target: '#help-root',
    apiOrigin: LITEDESK,
    linkPrefix: '/help/',
  });
}
```

Load embed scripts once per page type (or use `<script>` tags in your layout).

---

## 8. Self-hosting embed assets (optional)

You may copy these files from LiteDesk to `xyz.com` (CDN or static bucket):

```text
/embed/headless-blocks.css
/embed/headless-blocks.js          (article interactive blocks)
/embed/headless-help-common.js      (category + section pages)
/embed/headless-help-home.js
/embed/headless-help-category.js
/embed/headless-help-section.js
/embed/headless-article.js
/embed/headless-article-list.js     (legacy flat list)
```

**Always** set `data-api-origin="{LITEDESK_ORIGIN}"` when JS is served from a different origin than the API.

Re-copy or sync when LiteDesk upgrades embed scripts.

---

## 9. Styling

- Base styles: `headless-blocks.css` (typography, help layout, article blocks, feedback footer).
- Override with your site CSS using classes such as `.ld-help-home`, `.ld-help-page`, `.ld-article`, `.ld-article__footer`.
- CSS variables on a wrapper (e.g. `.ld-help-page`):

```css
.ld-help-page {
  --ld-accent: #2563eb;
  --ld-text: #111827;
  --ld-muted: #6b7280;
  --ld-border: #e5e7eb;
  --ld-radius: 0.5rem;
}
```

Appearance defaults (fonts, colors) are configured in LiteDesk **Articles → Appearance**; block rendering uses article presentation fields.

---

## 10. Popular articles sidebar

Mark articles as **Featured** in Content Studio (inspector toggle). Featured public articles appear in the **Popular articles** sidebar on category, section, and article pages via `GET .../articles/popular`.

---

## 11. Article feedback analytics

Article pages show a **Helpful?** footer. Votes and share clicks are stored server-side.

**Public endpoint:**

```http
POST /api/public/v1/content/{org-slug}/articles/{article-slug}/feedback
Content-Type: application/json

{ "helpful": true }
```

```http
{ "action": "share", "platform": "facebook" }
```

Platforms: `facebook`, `x`, `linkedin`.

**Agent view:** Content Studio → open a published article → **Settings** panel → **Article analytics** (helpful counts, rate, shares).

---

## 12. SEO

- Use your own `<title>` / meta tags on each customer page (article JSON includes `seo.metaTitle`, `seo.metaDescription`).
- LiteDesk sitemap for crawlers that can read API URLs:

```text
GET {LITEDESK_ORIGIN}/api/public/v1/content/{org-slug}/sitemap.xml
```

Point `robots.txt` or your SEO tool at this URL, or merge entries into your main sitemap.

---

## 13. Webhooks (optional)

Configure **Publish webhook URL** in Articles settings to receive:

| Event | When |
|-------|------|
| `content.published` | Article published |
| `content.unpublished` | Article unpublished |

Payload includes `content.apiUrl` for the headless article endpoint. Use this to invalidate CDN cache or trigger rebuilds on `xyz.com`.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty category grid | No collections or no public articles in tree | Add collections; publish public articles |
| 404 on article | Wrong slug or not public/published | Check slug, status, visibility |
| Blank page, console CORS error | `xyz.com` not in `CORS_ORIGINS` | Add customer domain to LiteDesk env |
| API returns empty `data` | Headless API disabled | Enable in Articles publishing settings |
| Links go to wrong paths | Mismatched `data-*-prefix` | Align prefixes with your router |
| Sidebar empty (popular) | No featured articles | Toggle **Featured** on articles |
| Styles missing | CSS not loaded | Include `headless-blocks.css` |
| Feedback not recorded | Article not public/published | Same gates as article API |

**Quick API test (terminal):**

```bash
curl -s "https://{litedesk-app}/api/public/v1/content/{org-slug}/collections" | jq .
curl -s "https://{litedesk-app}/api/public/v1/content/{org-slug}/articles/{slug}" | jq .
```

---

## 15. Checklist — go live on `xyz.com`

- [ ] Articles addon + headless API enabled  
- [ ] Collections and public published articles ready  
- [ ] `CORS_ORIGINS` includes `https://xyz.com` (and `www`)  
- [ ] `/help/` home page with `headless-help-home.js`  
- [ ] Category / section / article routes with matching embeds  
- [ ] `data-api-origin` set if scripts loaded cross-origin  
- [ ] `data-link-prefix` matches your URL scheme  
- [ ] LiteDesk demos verified with your org slug  
- [ ] Article feedback footer tested; analytics visible in Content Studio  
- [ ] Sitemap or meta strategy for SEO  

---

## 16. Related files (LiteDesk repo)

| Area | Path |
|------|------|
| Embed scripts | `client/public/embed/headless-help-*.js`, `headless-article.js` |
| Styles | `client/public/embed/headless-blocks.css` |
| Public API | `server/routes/publicContentRoutes.js` |
| Settings UI | `client/src/components/settings/ArticlesAddonSettings.vue` |
| Example pages | `client/src/views/HeadlessHelp*Example.vue`, `HeadlessArticleExample.vue` |
