# Headless Help Center — Customer Site Setup (`xyz.com`)

**Audience:** Tenant admins, customer web developers  
**Scope:** Embed Arivu Articles on a **customer-owned** website (e.g. `https://xyz.com/help`)  
**Related:** [ARTICLES_HEADLESS_ROADMAP.md](./ARTICLES_HEADLESS_ROADMAP.md) · [ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md](./ARTICLES_HEADLESS_HELP_CENTER_ROADMAP.md) · [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](./ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md)

---

## 1. How it works

Arivu does **not** host your help pages. You publish articles in Content Studio; Arivu exposes a **public JSON API** and **neutral embed scripts**. Your site owns routing, layout, and branding.

```text
xyz.com/help                    → headless-help.js (auto: home)
xyz.com/help/{category}         → headless-help.js (auto: category)
xyz.com/help/{cat}/{section}    → headless-help.js (auto: section)
xyz.com/help/.../{article}      → headless-help.js (auto: article)
```

**Recommended:** use the single **`headless-help.js`** script on every help page. It reads the URL and loads the correct view. Per-page scripts (`headless-help-home.js`, etc.) remain available for advanced setups.

**Data flow**

```text
Browser on xyz.com
  ├── loads /embed/headless-help.js (+ CSS/deps from Arivu app or self-hosted copy)
  └── fetch JSON → https://{arivu-app}/api/public/v1/content/{embed-site-id}/...
```

---

## 2. Prerequisites (Arivu tenant)

| Requirement | Where |
|-------------|--------|
| **Articles addon** installed | Settings → Add-ons |
| **Headless API enabled** | Settings → Add-ons → Articles → Publishing |
| **Embed site ID** auto-generated | Settings → Add-ons → Articles (e.g. `art_pub_…` in snippets) |
| **Collections** created | Content Studio → Settings panel → Collections |
| Articles **published** with **visibility: Public** | Content Studio → Publish |

**Public API gates (all must pass):**

- Articles addon enabled  
- `settings.publishing.headlessApiEnabled === true`  
- Article `status: published`  
- Article `visibility: public`

If any gate fails, the API returns empty lists or 404 — not an auth error.

---

## 3. Configure Arivu

### 3.1 Enable headless publishing

1. Open **Settings → Add-ons → Articles**.
2. Under **Publishing**, ensure **Headless API** is enabled.
3. Save settings.

### 3.2 Copy your embed snippet (recommended)

In **Settings → Add-ons → Articles → Website embed**, copy the **Complete HTML page** or **Embed on an existing page** snippet. Values are pre-filled with your org slug and Arivu app origin — paste as-is.

The unified script (`headless-help.js`) handles home, category, section, and article pages from the URL. Use the **same snippet on every help route**.

### 3.3 Copy your API base URL

In the same settings page, under **Integration**, copy:

```text
https://{your-arivu-app}/api/public/v1/content/{embed-site-id}
```

Example endpoints (replace `{embed-site-id}` and `{slug}`):

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

### 3.4 Try Arivu demos first

Before wiring `xyz.com`, verify content in Arivu examples (replace `org` with your slug):

| Page | Demo URL |
|------|----------|
| Home | `/examples/headless-help-home?org={embed-site-id}` |
| Category | `/examples/headless-help-category?org={embed-site-id}&collection={category-slug}` |
| Section | `/examples/headless-help-section?org={embed-site-id}&section={section-slug}&parent={category-slug}` |
| Article | `/examples/headless-article?org={embed-site-id}&slug={article-slug}` |

---

## 4. Recommended URL structure on `xyz.com`

| Page | URL pattern | Embed script |
|------|-------------|--------------|
| Help home | `https://xyz.com/help/` | `headless-help.js` (same on all rows) |
| Category | `https://xyz.com/help/{category}` | `headless-help.js` |
| Section | `https://xyz.com/help/{category}/{section}` | `headless-help.js` |
| Article | `https://xyz.com/help/{category}/{section}/{article}` | `headless-help.js` |

Slugs must match **collection slugs** and **article slugs** in Content Studio (lowercase, URL-safe).

You may use a different path (e.g. `/support/`). Set `data-path-prefix="/support/"` on the embed script.

---

## 5. Quick start — one snippet

Replace placeholders only if you did not copy from Arivu settings (Settings → Add-ons → Articles → Website embed):

- `{ARIVU_ORIGIN}` — e.g. `https://app.arivu.com`  
- `{ORG_KEY}` — your auto-generated embed site ID (e.g. `art_pub_…`) — prefilled in settings  

### Complete HTML page (copy & paste)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Help Center</title>
</head>
<body>
  <main id="arivu-help"></main>
  <script
    src="{ARIVU_ORIGIN}/embed/headless-help.js"
    data-api-origin="{ARIVU_ORIGIN}"
    data-org="{ORG_KEY}"
    data-target="#arivu-help"
    data-path-prefix="/help/"
    data-title="Help Center"
  ></script>
</body>
</html>
```

CSS and page-specific scripts load automatically. The script picks home / category / section / article from the browser URL.

### Embed on an existing page

```html
<div id="arivu-help"></div>
<script
  src="{ARIVU_ORIGIN}/embed/headless-help.js"
  data-api-origin="{ARIVU_ORIGIN}"
  data-org="{ORG_KEY}"
  data-target="#arivu-help"
  data-path-prefix="/help/"
  data-title="Help Center"
></script>
```

**Programmatic mount** (SPA):

```javascript
await window.ArivuHeadlessHelp.mount({
  org: '{ORG_KEY}',
  target: '#arivu-help',
  apiOrigin: '{ARIVU_ORIGIN}',
  pathPrefix: '/help/',
  title: 'Help Center',
});
```

(`window.LiteDeskHeadlessHelp` remains as a legacy alias.)

---

## 6. CORS (automatic)

When you save your **website domain** in **Settings → Add-ons → Articles**, Arivu registers that domain for browser access to the public content API. No manual `CORS_ORIGINS` changes are needed.

Registered automatically for each tenant:

- `https://example.com`
- `https://www.example.com` (when you enter `example.com` or `www.example.com`)

**Development:** localhost origins remain allowed in non-production environments.

**Legacy override:** platform admins can still extend the global allowlist with `CORS_ORIGINS` if needed.

---

## 7. Advanced: per-page embeds (optional)

Use individual scripts when you need separate HTML files per page type or custom routing. See **Advanced: individual page embeds** in Articles settings, or the sections below.

Replace placeholders:

- `{ARIVU_ORIGIN}` — e.g. `https://app.arivu.com`  
- `{ORG_KEY}` — your auto-generated embed site ID from Articles settings  
- `{CATEGORY}`, `{SECTION}`, `{ARTICLE}` — Content Studio slugs  

When embed **JS/CSS are loaded from Arivu** but the page lives on `xyz.com`, add:

```html
data-api-origin="{ARIVU_ORIGIN}"
```

on each embed `<script>` tag so API calls target Arivu, not `xyz.com`.

### 7.1 Help home — `https://xyz.com/help/`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Help Center</title>
  <link rel="stylesheet" href="{ARIVU_ORIGIN}/embed/headless-blocks.css" />
</head>
<body>
  <header><!-- your site chrome --></header>
  <main id="help-home"></main>
  <footer><!-- your site footer --></footer>

  <script
    src="{ARIVU_ORIGIN}/embed/headless-help-home.js"
    data-api-origin="{ARIVU_ORIGIN}"
    data-org="{ORG_KEY}"
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
  org: '{ORG_KEY}',
  target: '#help-home',
  apiOrigin: '{ARIVU_ORIGIN}',
  linkPrefix: '/help/',
  title: 'Help Center',
});
```

Search on the home page queries `GET .../articles?search={q}&limit=20` inline.

### 6.2 Category — `https://xyz.com/help/{category}`

```html
<link rel="stylesheet" href="{ARIVU_ORIGIN}/embed/headless-blocks.css" />
<div id="help-category"></div>
<script src="{ARIVU_ORIGIN}/embed/headless-help-common.js"></script>
<script
  src="{ARIVU_ORIGIN}/embed/headless-help-category.js"
  data-api-origin="{ARIVU_ORIGIN}"
  data-org="{ORG_KEY}"
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
<link rel="stylesheet" href="{ARIVU_ORIGIN}/embed/headless-blocks.css" />
<div id="help-section"></div>
<script src="{ARIVU_ORIGIN}/embed/headless-help-common.js"></script>
<script
  src="{ARIVU_ORIGIN}/embed/headless-help-section.js"
  data-api-origin="{ARIVU_ORIGIN}"
  data-org="{ORG_KEY}"
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
<link rel="stylesheet" href="{ARIVU_ORIGIN}/embed/headless-blocks.css" />
<div id="help-article"></div>
<script
  src="{ARIVU_ORIGIN}/embed/headless-article.js"
  data-api-origin="{ARIVU_ORIGIN}"
  data-org="{ORG_KEY}"
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
  org: '{ORG_KEY}',
  slug: '{ARTICLE}',
  target: '#help-article',
  apiOrigin: '{ARIVU_ORIGIN}',
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

## 8. SPA / framework routing (React, Next.js, etc.)

Use the unified script in your layout, or call `ArivuHeadlessHelp.mount()` on navigation:

```javascript
await window.ArivuHeadlessHelp.mount({
  org: 'acme-corp',
  target: '#arivu-help',
  apiOrigin: 'https://app.arivu.com',
  pathPrefix: '/help/',
  pathname: window.location.pathname,
});
```

The script parses `/help/{category}/{section}/{article}` and loads the correct view automatically.

For custom routers, use **Advanced: individual page embeds** in Articles settings.

---

## 9. Self-hosting embed assets (optional)

You may copy these files from Arivu to `xyz.com` (CDN or static bucket):

```text
/embed/headless-blocks.css
/embed/headless-blocks.js          (article interactive blocks)
/embed/headless-help-common.js      (category + section pages)
/embed/headless-help-home.js
/embed/headless-help-category.js
/embed/headless-help-section.js
/embed/headless-help.js             (unified router — recommended)
/embed/headless-article.js
/embed/headless-article-list.js     (legacy flat list)
```

**Always** set `data-api-origin="{ARIVU_ORIGIN}"` when JS is served from a different origin than the API.

Re-copy or sync when Arivu upgrades embed scripts.

---

## 10. Styling

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

Appearance defaults (fonts, colors) are configured in Arivu **Articles → Appearance**; block rendering uses article presentation fields.

---

## 11. Popular articles sidebar

Mark articles as **Featured** in Content Studio (inspector toggle). Featured public articles appear in the **Popular articles** sidebar on category, section, and article pages via `GET .../articles/popular`.

---

## 12. Article feedback analytics

Article pages show a **Helpful?** footer. Votes and share clicks are stored server-side.

**Public endpoint:**

```http
POST /api/public/v1/content/{embed-site-id}/articles/{article-slug}/feedback
Content-Type: application/json

{ "helpful": true }
```

```http
{ "action": "share", "platform": "facebook" }
```

Platforms: `facebook`, `x`, `linkedin`.

**Agent view:** Content Studio → open a published article → **Settings** panel → **Article analytics** (helpful counts, rate, shares).

---

## 13. SEO

- Use your own `<title>` / meta tags on each customer page (article JSON includes `seo.metaTitle`, `seo.metaDescription`).
- Arivu sitemap for crawlers that can read API URLs:

```text
GET {ARIVU_ORIGIN}/api/public/v1/content/{embed-site-id}/sitemap.xml
```

Point `robots.txt` or your SEO tool at this URL, or merge entries into your main sitemap.

---

## 14. Webhooks (optional)

Configure **Publish webhook URL** in Articles settings to receive:

| Event | When |
|-------|------|
| `content.published` | Article published |
| `content.unpublished` | Article unpublished |

Payload includes `content.apiUrl` for the headless article endpoint. Use this to invalidate CDN cache or trigger incremental static sync on `xyz.com`.

**Static SEO mode (recommended for crawlers):** pre-rendered HTML + mirrored assets on your domain, updated incrementally per publish — see [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](./ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md) and [examples/static-sync](../examples/static-sync/README.md).

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty category grid | No collections or no public articles in tree | Add collections; publish public articles |
| 404 on article | Wrong slug or not public/published | Check slug, status, visibility |
| Blank page, console CORS error | Website domain not saved in Articles settings | Add your domain under Website domain for embed |
| API returns empty `data` | Headless API disabled | Enable in Articles publishing settings |
| Links go to wrong paths | Mismatched `data-*-prefix` | Align prefixes with your router |
| Sidebar empty (popular) | No featured articles | Toggle **Featured** on articles |
| Styles missing | CSS not loaded | Include `headless-blocks.css` |
| Feedback not recorded | Article not public/published | Same gates as article API |

**Quick API test (terminal):**

```bash
curl -s "https://{arivu-app}/api/public/v1/content/{embed-site-id}/collections" | jq .
curl -s "https://{arivu-app}/api/public/v1/content/{embed-site-id}/articles/{slug}" | jq .
```

---

## 16. Checklist — go live on `xyz.com`

- [ ] Articles addon + headless API enabled  
- [ ] Collections and public published articles ready  
- [ ] Website domain saved in Articles settings (CORS auto-registered)  
- [ ] `/help/` routes use one `headless-help.js` snippet (same on every page)  
- [ ] `data-api-origin` and `data-path-prefix` set correctly  
- [ ] Arivu demos verified with your org slug  
- [ ] Article feedback footer tested; analytics visible in Content Studio  
- [ ] Sitemap or meta strategy for SEO  

---

## 17. Related files (Arivu repo)

| Area | Path |
|------|------|
| Embed scripts | `client/public/embed/headless-help.js`, `headless-help-*.js`, `headless-article.js` |
| Styles | `client/public/embed/headless-blocks.css` |
| Public API | `server/routes/publicContentRoutes.js` |
| Settings UI | `client/src/components/settings/ArticlesAddonSettings.vue` |
| Example pages | `client/src/views/HeadlessHelp*Example.vue`, `HeadlessArticleExample.vue` |
