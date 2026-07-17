# @arivu/blog-install

One-command installer for Arivu headless blog on **Next.js / Vercel**.

## Install into existing Next.js project (layout mode — default)

From your project root:

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-blog-install.mjs | node - install \
  --org=art_pub_xxx \
  --api-origin=https://app.arivu.com \
  --site-origin=https://www.example.com \
  --path-prefix=/blog/
```

The script:

- Adds `/blog` App Router routes that fetch content from the Arivu API
- Wraps blog pages with your site nav/footer in `app/blog/layout.tsx` when chrome lives in route layouts
- Detects header/footer components in your existing layouts during install
- Adds webhook route at `/api/arivu-webhook/blog` for publish-triggered Vercel rebuilds
- Writes `.env.local` with your Arivu settings

`ARIVU_SYNC_MODE=layout` skips writing `public/blog/` static HTML — those files are not used for rendering in layout mode.

Use `--mode=standalone-html` only if you want full standalone HTML files under `public/blog/` without site chrome.

## Create standalone Vercel project

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-blog-install.mjs | node - create ./blog \
  --org=art_pub_xxx \
  --api-origin=https://app.arivu.com \
  --site-origin=https://www.example.com
```

Then `cd blog && npm install && vercel`.

## Webhook

- Path: `/api/arivu-webhook/blog`
- Secret env: `ARIVU_BLOG_WEBHOOK_SECRET` (optional fallback: `ARIVU_WEBHOOK_SECRET`)
- Point Arivu Blog publish webhook at `https://yoursite.com/api/arivu-webhook/blog`

## Vercel checklist

1. Copy `.env.local` vars into Vercel → Environment Variables
2. Set `ARIVU_BLOG_WEBHOOK_SECRET`
3. Create Deploy Hook → `VERCEL_DEPLOY_HOOK_URL`
4. Arivu Blog → publish webhook → `https://yoursite.com/api/arivu-webhook/blog`
5. Deploy

## Local (from LiteDesk repo)

```bash
cd client/public/static-sync/arivu-blog-install
node bin/arivu-blog-install.js install --org art_pub_xxx --api-origin https://app.arivu.com --site-origin https://www.example.com
```
