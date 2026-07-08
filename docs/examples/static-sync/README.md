# Static sync examples

Templates for **incremental** Arivu headless help sync (SEO mode).

Downloadable from **Articles settings → Static sync (SEO)** when running the Arivu app:

| Host | Download |
|------|----------|
| PHP | `/static-sync/arivu-help-sync.php` |
| Next.js | `/static-sync/arivu-next-static-sync.zip` (built from `next-app-router/` on `npm run build`) |

## PHP (shared hosting)

1. Copy `arivu-help-sync.php` to your web host document root.
2. Set env vars (`ARIVU_ORG`, `ARIVU_API_ORIGIN`, `SITE_ORIGIN`, `ARIVU_WEBHOOK_SECRET`).
3. Webhook URL → `https://yoursite.com/arivu-help-sync.php`
4. Initial full sync → `https://yoursite.com/arivu-help-sync.php?full=1`

Writes HTML + assets under `{outputDir}/help/` (default: document root). Webhook updates incrementally on each publish.

## Next.js on Vercel (static SEO mode)

Vercel cannot write files at runtime. Use **build-time sync + deploy hook**:

1. Copy the Next template (`scripts/`, `help-sync/`, `app/api/arivu-webhook/`).
2. Set `ARIVU_SYNC_MODE=static`, `VERCEL_DEPLOY_HOOK_URL`, and Arivu env vars.
3. Add `"prebuild": "node scripts/sync-help-static.mjs"` to `package.json`.
4. Merge `next.config.example.mjs` rewrites; remove ISR `app/help/*` routes.
5. Webhook URL → `https://yoursite.com/api/arivu-webhook`

Each publish → webhook → Vercel redeploy → `prebuild` writes fresh HTML to `public/help/`.

See `next-app-router/README.md` for full steps.

## Node CLI (VPS or CI)

See [tools/help-sync/README.md](../../tools/help-sync/README.md).

```bash
arivu-help-sync sync --org art_pub_xxx --dest ./public --full
```

## Related

- [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](../../ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md)
