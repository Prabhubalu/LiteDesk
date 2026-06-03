# Online Payments — Gateway Operations Guide

**Status:** Approved — operational reference for PAY3.0+  
**Audience:** DevOps, platform engineering, support leads, finance ops (read-only)  
**Last updated:** 2026-06-02  

**Related documents:**

| Document | Purpose |
|----------|---------|
| `docs/PAYMENT_GATEWAYS_ARCHITECTURE.md` | Design authority — entities, flows, locked decisions |
| `docs/PAYMENTS_ARCHITECTURE.md` | Cash / credit / billing authority model |
| `docs/PAYMENTS_ROADMAP.md` | Phase tracker (PAY3.0 shipped, PAY3.1 next) |

**Scope:** How online payments **run in production** after PAY3.0. This guide covers Stripe only until PAY3.2 (Razorpay) ships.

---

## 1. Operational overview

### 1.1 Production capture path

```text
Agent creates PaymentLink (API)
  → Customer opens publicUrl (PAY3.1 UI)
  → POST /api/payment-gateways/sessions → Stripe Checkout Session
  → Customer pays on Stripe-hosted page
  → Stripe POST /api/payment-gateways/webhooks/stripe
  → PaymentGatewayEvent (append-only)
  → assertCaptureTargets() — live invoice re-validation
  → Payment + PaymentAllocation
  → Invoice amountDue reduced (rollup only)
```

**Source of truth for success:** webhook — not the browser redirect URL.

### 1.2 Authority boundaries (never bypass)

| Layer | Authority | Gateway may touch? |
|-------|-----------|-------------------|
| Billing | `SalesOrderInvoiceAllocation` | **No** |
| Cash | `PaymentAllocation` | **Yes** — via `paymentRecordService` / `paymentAllocationService` only |
| Credit | `CustomerCreditApplication` | **No** |

Gateway code **must not** directly mutate invoice rollups, line snapshots, or billing allocations.

### 1.3 Key entities (ops view)

| Entity | Ops role |
|--------|----------|
| `PaymentLink` | Shareable pay intent; `brandingSnapshot` frozen at create |
| `PaymentGatewaySession` | One checkout attempt; links to Stripe `cs_` / `pi_` ids |
| `PaymentGatewayEvent` | Append-only webhook audit log |
| `Payment` | Cash header; `externalReference` = Stripe payment intent id |
| `PaymentAllocation` | Cash applied to invoice |
| `OrganizationPaymentGatewaySettings` | Per-tenant Stripe config + `credentialHealth` |

---

## 2. Stripe setup

### 2.1 Prerequisites

| Item | Notes |
|------|-------|
| Stripe account | Platform account (Connect) or direct (single-tenant dev) |
| `stripe` npm package | Installed in `server/` (PAY3.0) |
| TLS endpoint | Public HTTPS URL for webhooks |
| LiteDesk env | Server `.env` + per-org settings document |

### 2.2 Environment variables (server)

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Production | Platform secret key (`sk_live_…` or `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Production | Default webhook signing secret (`whsec_…`) |
| `PUBLIC_APP_URL` | Recommended | Base URL for `PaymentLink.publicUrl` (e.g. `https://app.example.com`) |
| `PAYMENT_GATEWAY_USE_MOCK` | Dev only | Set `1` to force mock adapter (see §5) |

**Mock adapter auto-selects when:** `PAYMENT_GATEWAY_USE_MOCK=1`, `NODE_ENV=test`, or `STRIPE_SECRET_KEY` is unset.

### 2.3 Per-organization settings

Stored in `OrganizationPaymentGatewaySettings` (MongoDB):

```javascript
{
  organizationId,
  enabledProviders: ['stripe'],
  defaultProvider: 'stripe',
  paymentLinksEnabled: true,
  portalPayEnabled: false,          // PAY3.1
  stripe: {
    connectedAccountId: 'acct_…',   // Connect — see §4
    webhookSecret: 'whsec_…'        // Optional override per tenant
  },
  credentialHealth: { stripe: { status, lastCheckedAt, lastCheckError } }
}
```

**Secret handling (production target):**

- Prefer secret manager refs over plain-text DB fields (architecture §6.4).
- PAY3.0 stores `webhookSecret` on org settings when configured; platform default falls back to `STRIPE_WEBHOOK_SECRET`.
- Never log secret values; health API returns status only.

### 2.4 Stripe Dashboard — products & Checkout

PAY3.0 uses **Checkout Session** (`mode: payment`) with dynamic `line_items` — no pre-created Stripe Product required.

Required Stripe API version (adapter): `2024-11-20.acacia`.

**Metadata contract (required on every session):**

```json
{
  "organizationId": "<Mongo ObjectId>",
  "paymentGatewaySessionId": "<UUID>",
  "paymentLinkId": "<UUID or empty>",
  "organizationRefId": "<Mongo ObjectId>"
}
```

Stripe copies session metadata to `payment_intent` — webhooks use this to resolve tenant + session.

### 2.5 Supported webhook event types (PAY3.0)

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Capture success → Payment |
| `payment_intent.succeeded` | Capture success (alternate) |
| `payment_intent.payment_failed` | Session → `failed`; no Payment |
| `charge.refunded` | Delegates to PAY1 `refundService` (future wiring) |

---

## 3. Webhook setup

### 3.1 Endpoint

| Property | Value |
|----------|-------|
| URL | `https://<api-host>/api/payment-gateways/webhooks/stripe` |
| Method | `POST` |
| Content-Type | `application/json` |
| Auth | Stripe signature (`Stripe-Signature` header) — no LiteDesk JWT |

Registered **before** `express.json()` in `server.js` with `express.raw({ type: 'application/json' })` — raw body required for signature verification.

### 3.2 Stripe Dashboard configuration

1. **Developers → Webhooks → Add endpoint**
2. URL: production API path above
3. Events to send (minimum):
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` (platform) or org `stripe.webhookSecret`

### 3.3 Connect webhooks

For **Stripe Connect**, configure webhooks on:

- Platform account (recommended for PAY3.0 metadata routing), **or**
- Connected account with `connect` events enabled

Ensure `organizationId` is present in event metadata — ingestion rejects events without tenant scope.

### 3.4 Local development with Stripe CLI

```bash
stripe listen --forward-to localhost:5000/api/payment-gateways/webhooks/stripe
```

Copy the CLI `whsec_…` secret to `STRIPE_WEBHOOK_SECRET` for local verification.

### 3.5 Ingestion behaviour

| Step | Result |
|------|--------|
| Signature valid | Event inserted → processor runs |
| Signature invalid | Event stored with `signatureValid: false`, `processingStatus: ignored` — **no Payment** |
| Duplicate `providerEventId` | HTTP 200; existing row returned; no duplicate Payment |
| Missing `organizationId` in metadata | HTTP 4xx; event not processed |

**Idempotency keys:**

- `PaymentGatewayEvent`: unique `(organizationId, provider, providerEventId)`
- `Payment.externalReference`: unique per `(organizationId, externalReference)` when set

---

## 4. Connected account setup (Stripe Connect)

### 4.1 When to use Connect

| Model | Use case |
|-------|----------|
| **Connect** | Multi-tenant SaaS — each customer org has `acct_…` |
| **Direct** | Single-tenant / dev — platform key only, no `connectedAccountId` |

### 4.2 Onboarding checklist (Connect)

1. Enable Connect in Stripe Dashboard (Standard or Express accounts per product decision).
2. Complete connected account onboarding for tenant (`charges_enabled`, `payouts_enabled`).
3. Store `connectedAccountId` on `OrganizationPaymentGatewaySettings.stripe`.
4. Run credential health check (§6) — expect `healthy` or `degraded` (not `invalid`).
5. Create test PaymentLink → session → pay with test card → confirm webhook → Payment row.

### 4.3 API behaviour with Connect

Checkout Session create uses:

```javascript
stripe.checkout.sessions.create(params, { stripeAccount: connectedAccountId })
```

Credential health calls `accounts.retrieve(connectedAccountId)` and checks `charges_enabled`.

### 4.4 Health: degraded vs invalid

| Status | Typical cause | Session create |
|--------|---------------|----------------|
| `degraded` | Charges not yet enabled on connected account | Allowed (admin warning) |
| `invalid` | Wrong account id, revoked key, auth failure | **Blocked** (`GATEWAY_CREDENTIALS_INVALID`) |

---

## 5. Local mock flow

Use when Stripe keys are unavailable (CI, local dev, demos).

### 5.1 Enable mock adapter

```bash
# server/.env
PAYMENT_GATEWAY_USE_MOCK=1
# Do not set STRIPE_SECRET_KEY — or mock is also selected when key is absent
```

### 5.2 End-to-end mock sequence

```bash
# 1. Run tests (full mock pipeline)
cd server && npm run test:payment-gateways

# 2. Manual API flow (server running, authenticated CRM session)
# POST /api/payment-links
# POST /api/payment-gateways/sessions  { paymentLinkId, successUrl, cancelUrl }

# 3. Simulate webhook
curl -X POST http://localhost:5000/api/payment-gateways/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "x-mock-stripe-signature: mock_valid" \
  -d '<mock checkout.session.completed payload — see mockStripeGatewayAdapter.buildMockSuccessWebhook>'
```

**Mock signature header:** `x-mock-stripe-signature: mock_valid`

Mock checkout URLs: `https://checkout.mock.stripe/cs_mock_…` (informational only — webhook drives capture).

### 5.3 Mock vs production checklist

| Check | Mock | Production |
|-------|------|------------|
| Adapter | `mockStripeGatewayAdapter` | `stripeGatewayAdapter` |
| Signature | `x-mock-stripe-signature` | `Stripe-Signature` |
| Real money | No | Yes |
| Stripe Dashboard events | No | Yes |

**Never enable `PAYMENT_GATEWAY_USE_MOCK=1` in production.**

---

## 6. Credential health checks

### 6.1 API

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/payment-gateways/health` | `payments.view` |
| POST | `/api/payment-gateways/health/check` | `payments.managePaymentLinks` |

POST body: `{ "provider": "stripe" }`

### 6.2 Status semantics

| Status | Meaning | Checkout allowed? |
|--------|---------|-------------------|
| `unknown` | Never checked | Yes — triggers check on first session create |
| `healthy` | API key valid; account active | Yes |
| `degraded` | Partial issue (e.g. charges not enabled) | Yes — investigate |
| `invalid` | Auth failure / missing key | **No** |

### 6.3 When checks run

| Trigger | Action |
|---------|--------|
| First `createCheckoutFromPaymentLink` with `unknown` status | On-demand `verifyCredentials()` |
| Admin POST `/health/check` | Explicit re-check |
| Stripe 401/403 on session create | Should update health to `invalid` (manual re-check if not auto) |
| Scheduled background check | **Not in PAY3.0** — optional PAY3.1+ |

### 6.4 Operational response

```text
invalid  → Fix STRIPE_SECRET_KEY / connectedAccountId → POST /health/check → retry session create
degraded → Complete Stripe Connect onboarding → re-check
healthy  → No action
```

---

## 7. Event replay procedures

### 7.1 When to replay

| Scenario | Replay? |
|----------|---------|
| Webhook received, processing failed (`processingStatus: failed`) | **Yes** — after fixing root cause |
| Invoice was voided mid-checkout | **No** — fix customer-facing issue; refund in Stripe if charged |
| Duplicate webhook (same `providerEventId`) | **No** — idempotent; verify Payment exists |
| Signature invalid | **No** — fix webhook secret; Stripe resends from dashboard |
| Processed successfully | **No** — replay returns `{ replayed: true, duplicate: true }` |

### 7.2 Replay API (PAY3.0)

```http
POST /api/payment-gateways/events/:paymentGatewayEventId/replay
Authorization: Bearer <CRM token>
Permission: payments.managePaymentLinks
```

**Behaviour:**

1. Loads `PaymentGatewayEvent` by public UUID.
2. If already `processed` → returns idempotent result; **no second Payment**.
3. If `failed` and root cause fixed → re-runs processor (validation + capture).
4. Updates `processingStatus` and `processedAt`.

### 7.3 Replay decision tree

```text
Event processingStatus?
  processed → Stop (confirm Payment + allocations exist)
  ignored   → Fix signature/config; wait for Stripe retry or send new test event
  failed    → Read processingError.code:
    INVOICE_NOT_PAYABLE / AMOUNT_EXCEEDS_DUE → Do not replay; refund if charged
    SESSION_NOT_FOUND → Investigate metadata; may not be replayable
    DUPLICATE_PROVIDER_PAYMENT → Payment exists; link session manually if needed
    Other → Fix infra bug → replay
```

### 7.4 PAY3.1 note

Admin UI for event list + replay button ships in PAY3.1. Until then, use API + MongoDB read of `PaymentGatewayEvent`.

---

## 8. Failure recovery procedures

### 8.1 Customer charged, no Payment in LiteDesk

**Symptoms:** Stripe shows succeeded charge; no `Payment` row; session may be `pending` or `failed`.

| Step | Action |
|------|--------|
| 1 | Find `PaymentGatewaySession` by `providerSessionId` or `paymentGatewaySessionId` |
| 2 | Find `PaymentGatewayEvent` for same window — check `signatureValid`, `processingStatus`, `processingError` |
| 3 | If event `failed` with fixable code → replay (§7) |
| 4 | If no event → check webhook delivery in Stripe Dashboard; verify endpoint URL + signing secret |
| 5 | If event `ignored` (bad signature) → rotate/fix `STRIPE_WEBHOOK_SECRET`; request Stripe retry |
| 6 | Last resort → manual `POST /api/payments` with `externalReference` = Stripe `payment_intent` id; apply allocations to match session targets |

**Never** edit invoice `amountDue` / `amountPaid` directly — use Payment + Allocation path.

### 8.2 Session failed — invoice state changed

**Cause:** Invoice voided, paid manually, or `amountDue` reduced between session create and webhook.

| Code | Recovery |
|------|----------|
| `INVOICE_NOT_PAYABLE` | Refund charge in Stripe; send new PaymentLink |
| `AMOUNT_EXCEEDS_DUE` | Partial refund or create new link for remaining due |
| `NOTHING_TO_APPLY` | Refund if customer overpaid |

Session is marked `failed`; no Payment created — **correct safe behaviour**.

### 8.3 Duplicate provider payment id

**Symptoms:** Second capture attempt rejects with `DUPLICATE_PROVIDER_PAYMENT`.

**Cause:** Same Stripe `payment_intent` already linked to a `Payment.externalReference`.

**Recovery:** Confirm first Payment is correct; do not force duplicate. If wrong invoice was paid, use PAY1 refund + reversal workflow — not gateway bypass.

### 8.4 PaymentLink expired or revoked

| Status | Customer experience | Ops action |
|--------|---------------------|------------|
| `expired` | Cannot start checkout | Create new link |
| `revoked` | Blocked | Create new link if payment still needed |
| `consumed` | `maxUses` reached | Create new link for additional payments |

### 8.5 Webhook endpoint down

Stripe retries with backoff (~3 days). After recovery:

1. Verify health endpoint and server logs.
2. Check Stripe Dashboard → Webhooks → failed deliveries.
3. Use **Resend** on critical events or replay stored events if ingested but processing failed.

### 8.6 Connect account suspended

Health → `invalid` or `degraded`. All session creates blocked or warn. Resolve with Stripe account compliance; re-run health check.

---

## 9. Gateway event retention policy

### 9.1 Policy (locked direction)

| Rule | Value |
|------|-------|
| Minimum retention | **7 years** (financial audit alignment) |
| Mutation | **Insert-only** on `payload`; processing fields update once |
| Deletion | **Prohibited** in production — archive to cold storage only (future) |
| PII in payload | Stripe card metadata only (no full PAN); redact if exporting logs |

### 9.2 Storage

| Collection | Growth driver | Index |
|------------|---------------|-------|
| `paymentgatewayevents` | One row per webhook (+ retries deduped) | `(organizationId, provider, providerEventId)` unique |

### 9.3 Archive (future)

PAY3.0 — no automated archive job. Planned:

- Move events older than N years to object storage (JSON)
- Retain index row with `archivedAt` + pointer
- Replay from archive read-only

### 9.4 Support access

- View events: `GET /api/payment-gateways/events` (`payments.viewGatewayEvents`)
- Full payload: permission-gated; do not expose in Portal or public routes

---

## 10. Production rollout checklist

### 10.1 Infrastructure

- [ ] `STRIPE_SECRET_KEY` set (live key in production vault)
- [ ] `STRIPE_WEBHOOK_SECRET` set per environment
- [ ] `PUBLIC_APP_URL` points to production app origin
- [ ] Webhook route reachable from Stripe (no auth middleware blocking)
- [ ] TLS valid on API hostname
- [ ] `PAYMENT_GATEWAY_USE_MOCK` **unset** in production
- [ ] Rate limiting reviewed for public routes (PAY3.1 public pay page)

### 10.2 Stripe Dashboard

- [ ] Live mode webhook endpoint registered
- [ ] Events subscribed (§2.5)
- [ ] Connect accounts onboarded per tenant (if multi-tenant)
- [ ] Test payment with live test card in staging first

### 10.3 LiteDesk configuration

- [ ] `OrganizationPaymentGatewaySettings` seeded per tenant
- [ ] `paymentLinksEnabled: true`
- [ ] `connectedAccountId` verified (Connect)
- [ ] GET `/api/payment-gateways/health` → `healthy`
- [ ] RBAC: `payments.managePaymentLinks`, `payments.viewGatewayEvents` assigned

### 10.4 Smoke test (staging → prod)

```text
1. POST /api/payment-links { organizationRefId, invoiceIds[] }
2. POST /api/payment-gateways/sessions { paymentLinkId, successUrl, cancelUrl }
3. Complete Stripe Checkout (test card 4242…)
4. Confirm webhook delivery in Stripe Dashboard
5. Verify:
   - PaymentGatewayEvent.processingStatus = processed
   - PaymentGatewaySession.status = succeeded
   - Payment.externalReference = pi_…
   - PaymentAllocation.status = active
   - Invoice.amountDue reduced
6. cd server && npm run test:payment-gateways  (CI gate)
```

### 10.5 Rollback

| Action | Effect |
|--------|--------|
| Disable `paymentLinksEnabled` on org settings | Blocks new links (API should enforce — verify) |
| Remove webhook in Stripe | Stops new captures; existing Payments unaffected |
| Revoke active PaymentLinks | Prevents new sessions |

**Do not** roll back PAY3.0 code without coordinating open sessions — customers mid-checkout may succeed at Stripe while LiteDesk webhook is down.

---

## 11. Troubleshooting guide

### 11.1 Symptom index

| Symptom | Likely cause | Section |
|---------|--------------|---------|
| `GATEWAY_CREDENTIALS_INVALID` on session create | Missing/invalid Stripe key or Connect account | §2, §4, §6 |
| HTTP 400 on webhook | Invalid signature | §3 |
| Event `ignored` | Wrong `whsec`; body parsed as JSON before raw middleware | §3.1 |
| Event `failed` + `INVOICE_NOT_PAYABLE` | Invoice voided/paid before webhook | §8.2 |
| Event `failed` + `AMOUNT_EXCEEDS_DUE` | Manual payment reduced amountDue after session | §8.2 |
| Duplicate Payment concern | Same webhook twice | §3.5 — expected idempotent |
| `DUPLICATE_PROVIDER_PAYMENT` | Same `pi_` on two sessions | §8.3 |
| Session `succeeded` but no Payment | Should not happen — bug if seen | §8.1 |
| Customer sees success page, invoice unpaid | Redirect is not source of truth — webhook lag/failure | §3, §8.1 |
| Mock adapter in prod | `STRIPE_SECRET_KEY` unset or `PAYMENT_GATEWAY_USE_MOCK=1` | §5, §10.1 |

### 11.2 Diagnostic queries (MongoDB)

```javascript
// Session by Stripe checkout id
db.paymentgatewaysessions.findOne({ providerSessionId: 'cs_…' })

// Events for session
db.paymentgatewayevents.find({ paymentGatewaySessionId: '…' }).sort({ receivedAt: -1 })

// Payment by Stripe reference
db.payments.findOne({ externalReference: 'pi_…' })

// Org health
db.organizationpaymentgatewaysettings.findOne(
  { organizationId: ObjectId('…') },
  { credentialHealth: 1, stripe: { connectedAccountId: 1 } }
)
```

### 11.3 Log markers

| Log prefix | Meaning |
|------------|---------|
| `[PaymentActivity] failed to write activity` | Non-fatal — Payment still recorded; UUID vs ObjectId on activity (known PAY3.0) |
| Gateway controller 4xx | See `code` in JSON body |

### 11.4 Test suite (regression)

```bash
cd server && npm run test:payment-gateways
```

Nine scenarios: successful/failed capture, duplicate webhook, invalid signature, expired link, voided invoice, amountDue drift, duplicate provider id, replay.

### 11.5 Escalation matrix

| Severity | Condition | Owner |
|----------|-----------|-------|
| P1 | Live charges without Payment row > 15 min | Platform on-call + Stripe dashboard |
| P2 | All session creates failing health | Platform engineering |
| P3 | Single tenant Connect degraded | Tenant admin + Stripe Connect support |
| P4 | Event replay needed after bug fix | Support lead via replay API |

---

## 12. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-06-02 | Initial ops guide — PAY3.0 production reference before PAY3.1 |

**Next:** PAY3.1 adds Portal Pay Now, Payment Link UI, event replay admin — update §7.4 and §10 when shipped.
