# Arivu Next.js static sync (App Router)

Copy these files into your Next.js project (Vercel or any Node host).

## Files

| Path | Purpose |
|------|---------|
| `lib/arivu-help.ts` | Export API client — ISR mode only |
| `app/help/[[...slug]]/page.tsx` | ISR help pages (**remove in static SEO mode**) |
| `app/help/ArivuHelpEmbed.tsx` | All help pages — loads `headless-help.js` router (home, category, section, article) |
| `app/help/ArivuHelpContent.tsx` | Legacy server HTML renderer (unused in layout mode) |
| `app/help/layout.tsx` | Help layout + Arivu styles (**remove in static SEO mode**) |
| `app/help/sitemap.xml/route.ts` | Dynamic sitemap (**remove in static SEO mode**) |
| `app/api/arivu-webhook/route.ts` | Webhook — ISR revalidate or Vercel static deploy |
| `scripts/sync-help-static.mjs` | Build-time full sync → `public/help/` |
| `help-sync/` | Bundled `@arivu/help-sync` core |
| `next.config.example.mjs` | Rewrites for `/help/*` → `index.html` |

## Routes

| URL | Page |
|-----|------|
| `/help` | Help home |
| `/help/{category}` | Category listing |
| `/help/{category}/{section}` | Section listing |
| `/help/.../{article}` | Article body |
| `/help/sitemap.xml` | Sitemap |

## Env (Vercel → Project → Settings → Environment Variables)

```bash
ARIVU_ORG=art_pub_xxx
ARIVU_API_ORIGIN=https://app.arivu.com
HELP_URL_PREFIX=/help/
ARIVU_WEBHOOK_SECRET=your-webhook-secret
SITE_ORIGIN=https://www.yoursite.com
```

### Static SEO mode on Vercel (recommended)

Vercel **cannot write files at runtime**. Static HTML is written during **build**, then redeployed on each publish. Synced pages ship as full HTML documents with Inter typography, premium help chrome, CSS, JS, and SEO meta tags.

```bash
ARIVU_SYNC_MODE=static
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
ARIVU_SYNC_DEST=./public
```

Add to your site `package.json`:

```json
{
  "scripts": {
    "sync:help": "node scripts/sync-help-static.mjs",
    "prebuild": "npm run sync:help"
  }
}
```

Merge `next.config.example.mjs` rewrites into your Next config. The `:path+` rules map nested URLs like `/help/category/section/article` to `index.html` files so **hard refresh** returns 200 (not ISR 404). Extension paths such as `/help/sitemap.xml` and `/help/assets/*` are served directly from `public/`.

**Remove ISR help routes** (static files in `public/help/` must win):

- `app/help/[[...slug]]/page.tsx`
- `app/help/layout.tsx`
- `app/help/ArivuHelpAssets.tsx`
- `app/help/sitemap.xml/route.ts`

**Setup:**

1. Copy `app/api/`, `scripts/`, `help-sync/`, and merge `next.config`.
2. Set env vars above (include deploy hook URL).
3. Webhook URL → `https://yoursite.com/api/arivu-webhook`
4. Deploy once (build runs full sync → writes `public/help/**/*.html`).
5. Each publish → webhook → deploy hook → rebuild → fresh static files.

Create deploy hook: Vercel project → Settings → Git → Deploy Hooks.

### Layout mode (default for curl install)

```bash
ARIVU_SYNC_MODE=layout
```

Keep `app/help/[[...slug]]/page.tsx` and `app/help/layout.tsx`. `/help` is rendered by Next.js and fetches content from the Arivu API — **`public/help/` static HTML is not used**. Wrap help content with your site nav/footer in `app/help/layout.tsx` (same pattern as `/blog` if chrome is route-scoped). The curl installer auto-patches this when it detects a reference layout.

### ISR mode (fallback, weaker SEO)

```bash
ARIVU_SYNC_MODE=isr
```

Keep `app/help/[[...slug]]/page.tsx`. All `/help` routes use `headless-help.js`, which routes to the same embed scripts as the Articles demos (`headless-help-home.js`, `headless-help-category.js`, `headless-help-section.js`, `headless-article.js`). Server export API is still used for SEO metadata and route validation only.

## PHP / VPS (runtime file writes)

Use `arivu-help-sync.php` or `npx @arivu/help-sync` on a host with a writable filesystem. Webhook writes HTML incrementally on each publish — no full redeploy.

## Related

- Arivu docs: `ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md`
- PHP alternative: download `arivu-help-sync.php` from Articles settings
