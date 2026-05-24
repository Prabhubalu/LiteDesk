# Google Workspace → Arivu inbound webhook (legacy)

> **Disabled by default** (`ENABLE_LEGACY_MIME_INBOUND_WEBHOOK=false`). Use the **Arivu Inbound Parser** instead — see [INBOUND_PARSER_CRM_INTEGRATION.md](./INBOUND_PARSER_CRM_INTEGRATION.md).  
> Re-enable only if you intentionally want Apps Script + raw MIME on `POST /api/webhooks/email/inbound`.

Use this when **catch-all** delivers mail to `inbox@reply.arivusystems.com` and Arivu receives it via **`POST /api/webhooks/email/inbound`** (not Gmail OAuth on that mailbox).

## Flow

```
Customer reply → reply+TOKEN@reply.arivusystems.com
  → Workspace catch-all → inbox@reply.arivusystems.com
  → Relay (Apps Script / worker) POSTs raw MIME
  → Arivu parses token → email_threads → tenant DB → Inbox UI
```

You do **not** need to connect `inbox@reply…` as a CRM mailbox when using this path.

---

## 1. Arivu prerequisites

### `.env` (already set)

```env
EMAIL_REPLY_TO_DOMAIN=reply.arivusystems.com
EMAIL_INBOUND_ADDRESS=inbox@reply.arivusystems.com
EMAIL_INBOUND_WEBHOOK_SECRET=<your-secret>
EMAIL_INBOUND_REQUIRE_REPLY_TOKEN=true
EMAIL_REPLY_USE_SHORT_TOKEN=true
```

### Redis + API

- `REDIS_URL` must be reachable so inbound jobs queue (otherwise sync fallback still works, slower).
- API must be on **HTTPS** with a public hostname (Workspace relay cannot call `localhost`).

### Health check

```bash
curl -s https://YOUR_API_HOST/api/webhooks/email/inbound/health | jq
```

Expect:

- `webhookSecretConfigured: true`
- `replyTokenSecretConfigured: true`
- `inboundCatchAllAddress: "inbox@reply.arivusystems.com"`
- `requireReplyToken: true`
- `queueAvailable: true` (if Redis is up)

---

## 2. Webhook contract

| Item | Value |
|------|--------|
| **URL** | `https://YOUR_API_HOST/api/webhooks/email/inbound` |
| **Method** | `POST` |
| **Auth** | `Authorization: Bearer <EMAIL_INBOUND_WEBHOOK_SECRET>` |
| **Alt auth** | `X-Email-Inbound-Webhook-Token: <secret>` |
| **Body (preferred)** | Raw MIME, `Content-Type: message/rfc822` |
| **Body (alt)** | JSON `{ "rawMime": "<base64>" }`, `Content-Type: application/json` |
| **Success** | `202 { "success": true, "queued": true }` (async) or `200` with `communicationId` (sync) |
| **Auth failure** | `401` |
| **Bad / missing token in MIME** | `400` when `EMAIL_INBOUND_REQUIRE_REPLY_TOKEN=true` |

**Do not** rely on `X-Organization-Id` in production — routing uses `reply+…` / `replies+…` in To/Cc/Bcc.

---

## 3. Google Apps Script relay (recommended for Workspace)

Run as the **`inbox@reply.arivusystems.com`** user (or a delegated admin script with domain-wide Gmail access).

### 3.1 Create the script

1. Sign in as `inbox@reply.arivusystems.com`.
2. Open [script.google.com](https://script.google.com) → **New project** (name it e.g. **Arivu Inbound Relay**).
3. **Project settings** → enable **Show "appsscript.json" manifest file"**.
4. **Services** → add **Gmail API** (identifier `Gmail`, v1).
5. Paste the script below and set **Script properties** (Project settings → Script properties):

| Property | Example |
|----------|---------|
| `ARIVU_INBOUND_URL` | `https://api.arivusystems.com/api/webhooks/email/inbound` |
| `ARIVU_INBOUND_SECRET` | same as `EMAIL_INBOUND_WEBHOOK_SECRET` |
| `PROCESSED_LABEL` | `arivu-processed` (optional) |

### 3.2 Script

Uses the **Gmail API** service only (no `GmailMessage.getLabelNames()` / `getLabels()` — those are unreliable in some Apps Script runtimes).

```javascript
function processInboxToArivu() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('ARIVU_INBOUND_URL');
  const secret = props.getProperty('ARIVU_INBOUND_SECRET');
  const labelName = props.getProperty('PROCESSED_LABEL') || 'arivu-processed';

  if (!url || !secret) {
    throw new Error('Set ARIVU_INBOUND_URL and ARIVU_INBOUND_SECRET script properties');
  }

  const processedLabelId = getOrCreateLabelId_(labelName);
  const skippedLabelId = getOrCreateLabelId_(labelName + '-skipped');
  const list = Gmail.Users.Threads.list('me', {
    q: 'in:inbox -label:' + labelName + ' -label:' + labelName + '-skipped',
    maxResults: 20
  });
  const threads = list.threads || [];

  threads.forEach(function (t) {
    const thread = Gmail.Users.Threads.get('me', t.id, { format: 'minimal' });
    const messages = thread.messages || [];
    if (messages.length === 0) return;

    // Pick the message in the thread that was actually delivered to reply+… (not latest by date).
    const routable = findRoutableMessageInThread_(messages);
    if (!routable) {
      messages.forEach(function (m) {
        modifyMessageLabels_(m.id, [skippedLabelId], []);
      });
      console.log('Skipped (no reply+ in To/Delivered-To)', thread.id);
      return;
    }
    const messageId = routable.id;

    try {
      // Prefer rebuilding MIME from format:full (Gmail `raw` + JSON base64 often yields empty headers on the API).
      const res = postInboundMimeToArivu_(url, secret, messageId);

      const code = res.getResponseCode();
      const body = res.getContentText();
      // 200 = processed now (CRM has the message). 202 = queued only — needs Bull worker.
      if (code === 200) {
        messages.forEach(function (m) {
          modifyMessageLabels_(m.id, [processedLabelId], []);
        });
        console.log('Arivu inbound OK', body);
      } else if (code === 202) {
        console.log('Arivu inbound queued (worker must run)', body);
        // Optional: label arivu-queued instead of arivu-processed until worker is confirmed.
      } else {
        console.error('Arivu inbound failed', code, body);
      }
    } catch (e) {
      console.error('Thread failed', t.id, e);
    }
  });
}

/** Headers that carry the envelope recipient (not CRM Reply-To on outbound copies). */
var ROUTING_HEADER_NAMES_ = {
  'to': true,
  'cc': true,
  'bcc': true,
  'delivered-to': true,
  'x-original-to': true,
  'x-forwarded-to': true,
  'x-real-to': true,
  'envelope-to': true,
  'x-gm-original-to': true,
  'x-google-original-to': true,
  'x-envelope-to': true
};

/** True when To / Delivered-To / envelope headers contain reply+token@ (matches Arivu API). */
function messageHasRoutingToken_(messageId) {
  const msg = Gmail.Users.Messages.get('me', messageId, { format: 'metadata' });
  const headers = (msg.payload && msg.payload.headers) || [];
  const re = /(?:reply|replies)\+[a-z0-9]{6,16}@/i;
  for (var i = 0; i < headers.length; i++) {
    const name = String(headers[i].name || '').toLowerCase();
    if (!ROUTING_HEADER_NAMES_[name]) continue;
    if (re.test(String(headers[i].value || ''))) return true;
  }
  return false;
}

/** Prefer the inbound customer message, not the latest CRM outbound copy in the thread. */
function findRoutableMessageInThread_(messages) {
  if (!messages || !messages.length) return null;
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messageHasRoutingToken_(messages[i].id)) return messages[i];
  }
  return null;
}

/**
 * Gmail advanced service: modify(resource, userId, messageId) — resource must be first.
 * Wrong order (userId first) yields: Invalid JSON payload … Unexpected token. me
 */
function modifyMessageLabels_(messageId, addLabelIds, removeLabelIds) {
  var resource = {};
  if (addLabelIds && addLabelIds.length) resource.addLabelIds = addLabelIds;
  if (removeLabelIds && removeLabelIds.length) resource.removeLabelIds = removeLabelIds;
  Gmail.Users.Messages.modify(resource, 'me', messageId);
}

/**
 * Build RFC822 text from Gmail format:full (reliable headers for reply+ routing).
 * Avoids decoding the whole message `raw` field (often breaks in Apps Script).
 */
function buildMimeFromFullMessage_(messageId) {
  var msg = Gmail.Users.Messages.get('me', messageId, { format: 'full' });
  var headers = (msg.payload && msg.payload.headers) || [];
  var keep = {
    'from': true,
    'to': true,
    'cc': true,
    'bcc': true,
    'subject': true,
    'date': true,
    'message-id': true,
    'in-reply-to': true,
    'references': true,
    'delivered-to': true,
    'x-original-to': true,
    'x-forwarded-to': true,
    'envelope-to': true,
    'reply-to': true
  };
  var lines = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  for (var i = 0; i < headers.length; i++) {
    var n = String(headers[i].name || '').toLowerCase();
    if (keep[n]) {
      lines.push(headers[i].name + ': ' + headers[i].value);
    }
  }
  var body = extractPlainBodyFromPayload_(msg.payload) || '';
  if (!body) {
    body = extractHtmlBodyFromPayload_(msg.payload) || '';
  }
  if (!body && msg.snippet) {
    body = String(msg.snippet);
  }
  return lines.join('\r\n') + '\r\n\r\n' + body;
}

function decodePartData_(dataB64) {
  if (!dataB64) return '';
  try {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(dataB64)).getDataAsString('utf-8');
  } catch (e1) {
    try {
      return Utilities.newBlob(Utilities.base64Decode(dataB64)).getDataAsString('utf-8');
    } catch (e2) {
      return '';
    }
  }
}

function extractPlainBodyFromPayload_(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decodePartData_(payload.body.data);
  }
  var parts = payload.parts || [];
  for (var i = 0; i < parts.length; i++) {
    var t = extractPlainBodyFromPayload_(parts[i]);
    if (t) return t;
  }
  return '';
}

function extractHtmlBodyFromPayload_(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
    return decodePartData_(payload.body.data);
  }
  var parts = payload.parts || [];
  for (var i = 0; i < parts.length; i++) {
    var t = extractHtmlBodyFromPayload_(parts[i]);
    if (t) return t;
  }
  return '';
}

/** POST rebuilt MIME as message/rfc822 (no whole-message base64 decode). */
function postInboundMimeToArivu_(url, secret, messageId) {
  var mimeText = buildMimeFromFullMessage_(messageId);
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'message/rfc822',
    headers: { Authorization: 'Bearer ' + secret },
    payload: mimeText,
    muteHttpExceptions: true
  });
}

/** @returns {string} Gmail label id */
function getOrCreateLabelId_(name) {
  const labels = Gmail.Users.Labels.list('me').labels || [];
  const existing = labels.filter(function (l) {
    return l.name === name;
  })[0];
  if (existing) return existing.id;

  const created = Gmail.Users.Labels.create(
    {
      name: name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    },
    'me'
  );
  return created.id;
}
```

### 3.3 Trigger

1. **Triggers** → Add trigger → `processInboxToArivu` → **Time-driven** → every **1** or **5** minutes.
2. First run: authorize Gmail + external URL access (OAuth screen may show **Arivu** as the project name).

### 3.4 Limits

- Apps Script quotas apply (daily UrlFetch, runtime).
- For high volume, move relay to Cloud Run / Lambda + Gmail Pub/Sub instead.

---

## 4. Test without waiting for mail

### Local (with secret)

```bash
curl -s http://localhost:3000/api/webhooks/email/inbound/health | jq

curl -X POST http://localhost:3000/api/webhooks/email/inbound \
  -H "Content-Type: message/rfc822" \
  -H "Authorization: Bearer YOUR_EMAIL_INBOUND_WEBHOOK_SECRET" \
  --data-binary @test-reply.eml
```

`test-reply.eml` must include a valid recipient, e.g.:

```
To: reply+<token-from-sent-crm-email>@reply.arivusystems.com
From: customer@example.com
Subject: Re: Your message
Content-Type: text/plain

Thanks, this is a test reply.
```

Get `<token>` from a CRM email you sent (Reply-To header) or from `email_threads` in MongoDB.

### End-to-end

1. Send email from Arivu CRM to yourself.
2. Copy **Reply-To** address from the received message.
3. Reply from an external client to that address.
4. Confirm message in `inbox@reply…` (Gmail).
5. After relay runs (≤5 min), confirm thread in Arivu Inbox.

---

## 5. Production checklist

- [ ] API on HTTPS; firewall allows relay egress to `/api/webhooks/email/inbound`
- [ ] `EMAIL_INBOUND_WEBHOOK_SECRET` matches relay Bearer token
- [ ] Redis optional — sync inbound works with `queueAvailable: false`
- [ ] Apps Script trigger active; test email labeled `arivu-processed`
- [ ] `EMAIL_INBOUND_REQUIRE_REPLY_TOKEN=true`
- [ ] Monitor dead letters / server logs for `InboundDispatchError`

---

## 6. Redis (optional for inbound)

Inbound **does not require Redis**. Without `REDIS_URL`, the webhook processes mail **inline** (HTTP **200** with `communicationId`).

| `queueAvailable` | Behaviour |
|------------------|-----------|
| `false` | Sync processing on webhook — **fine for production** |
| `true` | Async via Bull — requires Redis + worker |

**If enabling Redis breaks the app:** an unreachable `REDIS_URL` used to make `/health/ready` return **503** and the load balancer stopped traffic. Deploy the latest API (Redis health no longer blocks readiness by default) or remove `REDIS_URL` until Redis is running.

Production options:

1. **No Redis** — leave `REDIS_URL` unset; rely on sync inbound (simplest).
2. **Managed Redis** — set `REDIS_URL=rediss://...` (Upstash/Railway/OCI) and verify `curl …/health/ready` shows `redis.ok: true`.
3. **Dedicated worker** — `npm run worker` with same `REDIS_URL`; set `ENABLE_BULL_IN_WEB=false` on API.

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Invalid JSON payload … Unexpected token. me` on `messages.modify` | Apps Script argument order: use `modify(resource, 'me', messageId)` not `modify('me', messageId, resource)` — update script from §3.2 |
| `401` | Secret mismatch between relay and `.env` |
| `400` Unknown CRM reply thread token | Reply-To token not in To/Cc; or outbound never registered `email_threads` |
| `400` No valid Reply-To token | Email has no `reply+` / `replies+` in To/Cc/Bcc/**Delivered-To**; reply to a CRM-sent Reply-To, not mail sent directly to `inbox@reply…` |
| `400` … routing token (Apps Script sent wrong message) | Script posted an outbound CRM copy (token only in **Reply-To** header). Update script: use `findRoutableMessageInThread_` and routing headers only (§3.2) |
| Reply in CRM shows **(no content)** | Old relay copied `multipart` headers with empty/wrong body. Update `buildMimeFromFullMessage_` (§3.2: clean `text/plain` MIME + `msg.snippet` fallback). Deploy API normalizer fix; send a **new** test reply |
| `Could not decode string` in Apps Script | Do **not** decode whole-message `raw`. Use `buildMimeFromFullMessage_` + `message/rfc822` from §3.2 |
| `400` … routing token (MIME garbled) | Deploy latest API (`decodeInboundRawMime`); keep JSON relay; confirm `findRoutableMessageInThread_` |
| `400` (old mail in inbox) | Label or archive non-token mail; only customer **replies to CRM Reply-To** should be ingested |
| Mail in Google, not Arivu | Trigger not running; wrong URL; script not authorized |
| Apps Script **200** but empty Inbox | Sidebar mailbox filter hides threads without `mailboxId` — select **All mailboxes** or deploy latest inbound (uses mailbox from reply token) |
| `arivu-processed` in Gmail but empty CRM | Webhook returned **202** (queued) but inbound **worker** never ran or job **failed** — see below |
| `queued: true` but no UI update | Run `npm run worker` with same `REDIS_URL`, or set `INBOUND_WEBHOOK_FORCE_SYNC=true` on API until worker is stable |

**Fix “processed label but no CRM” (production):**

1. Confirm API logs show `Email + inbound queue consumers running` OR run a dedicated worker (`npm run worker`).
2. `curl -s https://YOUR_API/api/webhooks/email/inbound/health | jq '.data.inboundQueue'` — if `waiting` or `failed` > 0, jobs are stuck.
3. Temporary: set `INBOUND_WEBHOOK_FORCE_SYNC=true` on the API (process inline, returns **200** + `communicationId`), redeploy, re-run relay on mail **without** `arivu-processed` (remove label or use a new reply).
4. In CRM: **Settings → Integrations → Email** → inbound diagnostics / dead-letters (owner).

---

## Related

- [PHASE2_INBOUND_SETUP.md](../../docs/PHASE2_INBOUND_SETUP.md)
- [R0_EMAIL_INFRA_RUNBOOK.md](./R0_EMAIL_INFRA_RUNBOOK.md)
- [CRM_EMAIL_ENTERPRISE_ARCHITECTURE.md](./CRM_EMAIL_ENTERPRISE_ARCHITECTURE.md)
