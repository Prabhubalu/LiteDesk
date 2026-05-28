# Mailroom Connectors API (M5)

External integrators and the Customer Portal use these endpoints to ingest messages and attachments into the **same Mailroom pipeline** as email (policies, threading, dedup, case linking).

Enable connectors under **Settings → Automation → Mailroom → Connectors**.

---

## Public REST API

**Base path:** `/api/public/mailroom`

**Authentication**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <ingestKey>` from Mailroom settings |
| `X-Organization-Id` | Yes | Tenant organization MongoDB id |

Alternative: `X-Mailroom-Api-Key: <ingestKey>` (still send organization id).

**Rate limit:** ~120 requests / 15 min per org + IP (configurable via `MAILROOM_PUBLIC_RATE_LIMIT_MAX`).

### POST `/ingest`

Ingest a new message (may create conversation + case per policies).

```json
{
  "message": {
    "externalMessageId": "ext-msg-001",
    "channel": "api",
    "subject": "Order issue",
    "body": "Plain text body",
    "htmlBody": "<p>Optional HTML</p>",
    "participants": {
      "from": "customer@example.com",
      "to": ["support@company.com"]
    },
    "attachments": [{ "attachmentId": "<id from upload>" }],
    "metadata": {
      "caseId": "<optional existing case>",
      "source": "my-integration"
    }
  }
}
```

**Response:** `{ success: true, data: { mailroom, rawPayloadId, policyEvaluation, caseLink, conversation, events } }`

### POST `/conversations/:conversationId/messages`

Append to an existing conversation (set `conversationId` in route or message).

### POST `/attachments`

`multipart/form-data` with field `file`.

**Response:**

```json
{
  "success": true,
  "data": {
    "attachmentId": "...",
    "originalFileName": "screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 12345,
    "status": "uploaded"
  }
}
```

Reference `attachmentId` in `message.attachments` when calling `/ingest`.

### GET `/conversations/:conversationId/attachments`

List attachments linked to a conversation.

### GET `/messages/:messageId/attachments`

List attachments linked to a mailroom message.

---

## Portal case APIs (Helpdesk 1D)

**Base path:** `/portal/cases`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portal/cases` | List cases for the logged-in requester |
| POST | `/portal/cases` | Create a case (`title`, `description`, optional `priority`) |
| GET | `/portal/cases/:id` | Case detail + customer-visible timeline (Mailroom-backed) |
| POST | `/portal/cases/:id/reply` | Reply on a case (routes through Mailroom when enabled) |

Internal notes and `internal: true` activities are never returned.

---

## Portal Mailroom API

**Base path:** `/portal/mailroom`

**Authentication:** Standard portal JWT (`protect` + Portal app context). The server **overrides** `participants.from` with the logged-in portal user email.

**Rate limit:** ~180 requests / 15 min per portal user (configurable via `MAILROOM_PORTAL_RATE_LIMIT_MAX`).

Portal responses are **sanitized** (no internal policy traces).

### POST `/ingest`

Same message envelope as public API, but `channel` is forced to `portal`.

### POST `/cases/:caseId/reply`

Reply on a case the portal user owns (matched via `requesterEmail` or contact email).

### POST `/attachments`

Upload a file before ingest. Returns `attachmentId` only (no bucket/object key).

### GET `/conversations/:conversationId/attachments`

Requires access to a case linked to the conversation.

### GET `/messages/:messageId/attachments`

Requires access to the message’s linked case or conversation.

### GET `/attachments/:id/download`

Query: `?disposition=inline|attachment`

---

## Internal (CRM) attachment download

**Path:** `GET /api/mailroom/attachments/:id/download`

Requires CRM auth. Used by case timeline UI.

---

## Message schema (summary)

| Field | Required | Notes |
|-------|----------|-------|
| `externalMessageId` | Recommended | Idempotency key |
| `channel` | No | Default `api` or `portal` |
| `subject` | No | |
| `body` / `htmlBody` | One of | |
| `participants.from` | Yes* | *Portal overwrites |
| `conversationId` | Append only | |
| `attachments[]` | No | `{ attachmentId }` after upload |

Metadata allowlist is enforced per connector (see `ingestValidator.js`).

---

## Errors

| Code | Meaning |
|------|---------|
| 400 | Validation / missing org id |
| 401 | Invalid API key (public) |
| 403 | Connector disabled or portal case access denied |
| 409 | Mailroom disabled for organization |
| 429 | Rate limit exceeded |

---

## Related docs

- `docs/MAILROOM_ROADMAP.md` — phases M0–M7
- `server/platform/mailroom/README.md` — module layout and local simulation
