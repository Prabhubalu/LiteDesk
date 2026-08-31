# R3.1 — Gmail Pub/Sub push setup

Realtime inbox uses **SSE** after sync. Pub/Sub triggers sync when Gmail receives mail (optional).

## Prerequisites

1. Google Cloud project with **Gmail API** enabled (same app as OAuth).
2. **Pub/Sub API** enabled.
3. Pub/Sub topic, e.g. `projects/YOUR_PROJECT/topics/arivu-gmail-inbox`.

## Google Cloud

1. Create topic `arivu-gmail-inbox`.
2. Grant Gmail publish rights on the topic:
   ```bash
   gcloud pubsub topics add-iam-policy-binding arivu-gmail-inbox \
     --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
     --role=roles/pubsub.publisher
   ```
3. Create a **push subscription** to your API:
   - URL: `https://YOUR_API_HOST/api/webhooks/email/gmail/push`
   - Optional: set custom header `Authorization: Bearer <GMAIL_PUSH_WEBHOOK_SECRET>`.

## Arivu `.env`

```bash
ENABLE_GMAIL_PUSH=true
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT/topics/arivu-gmail-inbox
# Optional shared secret (match Pub/Sub push auth header)
GMAIL_PUSH_WEBHOOK_SECRET=your-long-random-secret
# Optional verification token for subscription setup GET
GMAIL_PUBSUB_VERIFY_TOKEN=
GMAIL_WATCH_RENEW_CRON=15 4 * * *
```

## Inbox SSE (`/api/communications/inbox/stream`)

Cross-origin from `https://app.arivusystems.com` → `https://api.arivusystems.com` requires CORS on every SSE response (including 401).

If the browser shows **504 Gateway Timeout** on the stream URL, increase the reverse-proxy idle timeout (long-lived connection):

```nginx
location /api/communications/inbox/stream {
  proxy_pass http://your_api;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
}
```

Without this, the inbox still works — use manual refresh or the 5-minute Gmail poll.

## Behaviour

- On **Gmail OAuth connect**, the server calls `users.watch` when `GMAIL_PUBSUB_TOPIC` is set.
- **Pub/Sub POST** decodes `emailAddress` + `historyId`, finds matching mailboxes (all tenant DBs), runs inbox sync.
- **SSE** (`/api/communications/inbox/stream`) refreshes the Inbox UI after sync.
- **Cron** (`GMAIL_WATCH_RENEW_CRON`) renews watches before expiry.
- If push is disabled, **5-minute Gmail poll** (`GMAIL_INBOX_SYNC_CRON`) remains the fallback.

## Reconnect after scope change

After adding `gmail.send`, users must **disconnect and reconnect** Gmail on each mailbox.
