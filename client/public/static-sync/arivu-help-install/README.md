# @arivu/help-install

One-command installer for Arivu headless help on **Next.js / Vercel**.

## Install into existing Next.js project

From your project root:

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - install \
  --org=art_pub_xxx \
  --api-origin=https://app.arivu.com \
  --site-origin=https://www.example.com \
  --path-prefix=/help/
```

The script:

- Adds `/help` App Router routes that fetch content from the Arivu API
- Wraps help pages with your site nav/footer in `app/help/layout.tsx` when chrome lives in route layouts like `/blog`
- Detects header/footer components in your existing layouts during install
- Adds webhook route for publish-triggered Vercel rebuilds
- Writes `.env.local` with your Arivu settings

Default is **hybrid**: sync writes `public/help/` HTML; App Router **prefers that HTML when present**, otherwise falls back to live embed.

`ARIVU_SYNC_MODE=layout` skips writing `public/help/` static HTML.
`ARIVU_SYNC_MODE=static` is SEO-only (remove App Router help routes; serve `public/help/`).

Env keys are **merged** into `.env.local` (not overwritten). Help uses `ARIVU_HELP_ORG` (+ shared `ARIVU_API_ORIGIN`). Safe to install alongside blog (`ARIVU_BLOG_ORG`).

Use `--mode=standalone-html` only if you want full standalone HTML files without site chrome.

## Uninstall

From your project root:

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - uninstall \
  --api-origin=https://app.arivu.com
```

Detects and removes help routes, webhook, sync script, `lib/arivu-help.ts`, config helpers, `public/help/` (unless `--keep-static`), help env keys, and `package.json` sync scripts. Shared `help-sync/` / shared env keys are kept if blog is still installed.

Options: `--dry-run` · `--keep-env` · `--keep-static`

## Create standalone Vercel project

```bash
curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - create ./help-center \
  --org=art_pub_xxx \
  --api-origin=https://app.arivu.com \
  --site-origin=https://www.example.com
```

Then `cd help-center && npm install && vercel`.

## Vercel checklist

1. Copy `.env.local` vars into Vercel → Environment Variables
2. Create Deploy Hook → `VERCEL_DEPLOY_HOOK_URL`
3. Arivu Articles → publish webhook → `https://yoursite.com/api/arivu-webhook`
4. Deploy

## Local (from LiteDesk repo)

```bash
cd tools/arivu-help-install
node bin/arivu-help-install.js install --org art_pub_xxx --api-origin https://app.arivu.com --site-origin https://www.example.com
```
