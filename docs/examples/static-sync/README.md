# Static sync examples

Templates for **incremental** Arivu headless help sync (SEO mode).

Downloadable from **Articles settings → Static sync (SEO)** when running the Arivu app:

| Host | Download |
|------|----------|
| PHP | `/static-sync/arivu-help-sync.php` |
| Next.js | `/static-sync/arivu-next-static-sync.zip` |

## PHP (shared hosting)

1. Copy `arivu-help-sync.php` to your host.
2. Set `$config` or env vars (`ARIVU_ORG`, `ARIVU_API_ORIGIN`).
3. Webhook URL → `https://yoursite.com/arivu-help-sync.php`
4. Initial full sync → `https://yoursite.com/arivu-help-sync.php?full=1`

Writes HTML + assets under `./help/` next to the script.

## Next.js App Router (Vercel)

Download `arivu-next-static-sync.zip` or copy from `client/public/static-sync/next-app-router/`:

| File | Purpose |
|------|---------|
| `app/help/[...slug]/page.tsx` | ISR page fetching export HTML |
| `app/api/arivu-webhook/route.ts` | `revalidatePath` on publish/unpublish |

Env:

```bash
ARIVU_ORG=art_pub_xxx
ARIVU_API_ORIGIN=https://app.arivu.com
HELP_URL_PREFIX=/help/
ARIVU_WEBHOOK_SECRET=optional-shared-secret
SITE_ORIGIN=https://www.yoursite.com
```

Webhook URL → `https://yoursite.com/api/arivu-webhook`

## Node CLI (any host)

See [tools/help-sync/README.md](../../tools/help-sync/README.md).

```bash
arivu-help-sync sync --org art_pub_xxx --dest ./public/help --full
```

## Related

- [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](../../ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md)
