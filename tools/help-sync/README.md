# @arivu/help-sync

Incremental static sync for Arivu headless help articles (HTML + assets) onto your web host.

## Install

From the Arivu repo:

```bash
cd tools/help-sync
npm link
```

Or copy `tools/help-sync` into your project.

## Environment

```bash
export ARIVU_ORG=art_pub_xxx
export ARIVU_API_ORIGIN=https://app.arivu.com
export HELP_URL_PREFIX=/help/
```

## Commands

Full sync (initial deploy):

```bash
arivu-help-sync sync --org "$ARIVU_ORG" --dest ./public --full
```

Incremental article sync:

```bash
arivu-help-sync sync --org "$ARIVU_ORG" --dest ./public --slug create-invoice
```

Webhook handler (pipe Arivu publish webhook JSON on stdin):

```bash
arivu-help-sync webhook --dest ./public
```

## Output layout

```text
public/help/billing/invoices/create-invoice/index.html
public/help/assets/{assetId}.png
```

Asset mirroring is enabled by default. Disable with `--no-mirror-assets`.

## Related

- [ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md](../../docs/ARTICLES_HEADLESS_STATIC_SYNC_ROADMAP.md)
- Example templates in `docs/examples/static-sync/`
