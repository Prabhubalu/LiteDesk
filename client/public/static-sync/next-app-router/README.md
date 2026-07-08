# Arivu Next.js static sync (App Router)

Copy these files into your Next.js project (Vercel or any Node host).

## Files

| Path | Purpose |
|------|---------|
| `lib/arivu-help.ts` | Export API client — home, collection, article resolution |
| `app/help/[[...slug]]/page.tsx` | ISR help home, category, section, and article pages |
| `app/help/layout.tsx` | Loads Arivu help base styles |
| `app/help/sitemap.xml/route.ts` | SEO sitemap from Arivu export API |
| `app/api/arivu-webhook/route.ts` | Webhook handler — `revalidatePath` on publish/unpublish |

## Routes

| URL | Page |
|-----|------|
| `/help` | Help home (category grid) |
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

## Setup

1. Copy `app/` and `lib/` into your Next.js project root.
2. Set env vars above in Vercel (and `.env.local` for local dev).
3. In Arivu **Articles → Static sync**, set **Publish webhook URL** to:
   `https://yoursite.com/api/arivu-webhook`
4. Generate a webhook secret in Arivu settings; use the same value for `ARIVU_WEBHOOK_SECRET`.
5. Deploy. Publish an article in Content Studio — the webhook revalidates the article, home, and parent collection paths.

## Initial full sync (optional)

For first deploy or repair, run the CLI against `public/` then commit or upload to your CDN:

```bash
npx @arivu/help-sync sync --org $ARIVU_ORG --api-origin $ARIVU_API_ORIGIN --dest ./public/help --path-prefix /help/ --full
```

Or rely on ISR: first visitor to each path triggers export fetch (see `revalidate` in `lib/arivu-help.ts`).

## Related

- Arivu docs: `ARTICLES_HEADLESS_CUSTOMER_SITE_SETUP.md`
- PHP alternative: download `arivu-help-sync.php` from Articles settings
