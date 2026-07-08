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

`ARIVU_SYNC_MODE=layout` skips writing `public/help/` static HTML — those files are not used for rendering in layout mode.

Use `--mode=standalone-html` only if you want full standalone HTML files without site chrome.

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
