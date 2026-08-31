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

Default is **hybrid**: sync writes `public/blog/` HTML; App Router **prefers that HTML when present**, otherwise falls back to live embed.

`ARIVU_SYNC_MODE=layout` skips writing `public/blog/` static HTML.
`ARIVU_SYNC_MODE=static` is SEO-only (remove App Router blog routes; serve `public/blog/`).

Env keys are **merged** into `.env.local` (not overwritten). Blog uses `ARIVU_BLOG_ORG` (+ shared `ARIVU_API_ORIGIN`). Safe to install alongside help (`ARIVU_HELP_ORG`).

Re-running install **skips existing files** by default (keeps your customizations).
- `--update-kit` — refresh sync scripts, `help-sync/`, webhook routes, and `lib/arivu-blog.ts` only
- `--force` — overwrite everything including UI/CSS layouts

Use `--mode=standalone-html` only if you want full standalone HTML files under `public/blog/` without site chrome.

## Uninstall

From your project root:

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-blog-install.mjs | node - uninstall \
  --api-origin=https://app.arivu.com
```

Detects and removes blog routes, webhook, sync script, `lib/arivu-blog.ts`, config helpers, `public/blog/` (unless `--keep-static`), blog env keys, and `package.json` sync scripts. Shared `help-sync/` / shared env keys are kept if help is still installed.

Options: `--dry-run` · `--keep-env` · `--keep-static`

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

## Local (from Arivu repo)

```bash
cd client/public/static-sync/arivu-blog-install
node bin/arivu-blog-install.js install --org art_pub_xxx --api-origin https://app.arivu.com --site-origin https://www.example.com
```
