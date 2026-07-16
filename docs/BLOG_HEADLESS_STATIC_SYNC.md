# Blog headless static sync

SEO-oriented static HTML export for the Blog addon. Mirrors the Articles static-sync model with Blog-specific routes and `--addon blog`.

## Status (v1)

| Piece | Status |
| --- | --- |
| Export API (manifest, post, home, sitemap, collections) | Shipped |
| CLI sync (`--addon blog`) | Shipped |
| PHP webhook / full sync | Shipped |
| Settings UI (host type: embed / next / php / cli) | Shipped |
| Full Next.js install kit (`app/blog` pages + webhook) | Shipped |

## Public export routes

Base: `GET /api/public/content/:orgKey/...` (same org key / CORS gates as headless JSON).

| Path | Purpose |
| --- | --- |
| `/blog/manifest.json` | Sync manifest |
| `/blog/:slug/export` | Single post HTML export |
| `/blog/export/home` | Blog index / home export |
| `/blog/export/sitemap.xml` | Static sitemap |
| `/blog/export/collections/:slug` | Collection page export |

Integration payload fields (settings): `manifestUrl`, `exampleBlogPostExportUrl`, `homeExportUrl`, `staticSitemapUrl`, `exportPathPrefix`.

## CLI

Repo-local (until `@arivu/help-sync` publish covers Blog):

```bash
node tools/help-sync/bin/arivu-help-sync.js sync --addon blog --full \
  --org <orgKey> --dest ./public/blog --api-origin <https://app.example.com>
```

Published package (when available):

```bash
npx @arivu/help-sync sync --addon blog --full \
  --org <orgKey> --dest ./public/blog --api-origin <https://app.example.com>
```

Install helper (docs + ready-to-run sync command):

```bash
curl -fsSL ${ORIGIN}/static-sync/arivu-blog-install.mjs | node - --help
curl -fsSL ${ORIGIN}/static-sync/arivu-blog-install.mjs | node - --print-sync \
  --org=... --api-origin=... --dest=./public/blog
```

## PHP

- Download: `${ORIGIN}/static-sync/arivu-blog-sync.php`
- Webhook path: `/arivu-blog-sync.php`
- Env: `ARIVU_ORG`, `ARIVU_API_ORIGIN`, `BLOG_URL_PREFIX=/blog/`, `ARIVU_SYNC_DEST`, `ARIVU_BLOG_WEBHOOK_SECRET` (or legacy `ARIVU_WEBHOOK_SECRET`), `SITE_ORIGIN`
- Full sync: `GET ?full=1`

## Next.js

One-command install (layout mode, default) copies App Router pages into your project:

```bash
curl -fsSL ${ORIGIN}/static-sync/arivu-blog-install.mjs | node - install \
  --org=<orgKey> --api-origin=<ORIGIN> --site-origin=<SITE> --path-prefix=/blog/
```

Adds:

- `app/blog/[[...slug]]/page.tsx` (+ layout, embed, sitemap)
- `lib/arivu-blog.ts`
- `app/api/arivu-webhook/blog/route.ts`
- `.env.local` / `.env.example`

Standalone project:

```bash
curl -fsSL ${ORIGIN}/static-sync/arivu-blog-install.mjs | node - create ./blog \
  --org=<orgKey> --api-origin=<ORIGIN> --site-origin=<SITE>
```

Optional `--mode=standalone-html` syncs SEO HTML into `public/blog/` via `scripts/sync-blog-static.mjs`.

**Dual-addon (Articles + Blog) on one site:** use separate webhook paths and secrets:

| Addon | Webhook path | Secret env |
| --- | --- | --- |
| Articles | `/api/arivu-webhook` | `ARIVU_WEBHOOK_SECRET` |
| Blog | `/api/arivu-webhook/blog` | `ARIVU_BLOG_WEBHOOK_SECRET` |

Webhook suggestion for Next / CLI hosts: `${SITE_ORIGIN}/api/arivu-webhook/blog`.

## Related

- [Articles headless static sync roadmap](./ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md)
- Settings: Blog addon → Customer website → Publishing method
