# Online Payments — Gateway Architecture (PAY3)

**Status:** Approved — PAY3.0 implementation next  
**Scope:** Online payment capture (Payment Link, Hosted Checkout, Portal Pay Now)  
**Last updated:** 2026-06-02  
**Audience:** Engineering, product, payments platform design  

**Parent documents (authoritative, frozen layers):**

| Document | Scope |
|----------|-------|
| `docs/PAYMENTS_ARCHITECTURE.md` | Cash authority (`PaymentAllocation`), refunds, credit (`CustomerCreditApplication`), statements |
| `docs/PAYMENTS_ROADMAP.md` | Phase tracker — PAY0–PAY2 complete |
| `docs/INVOICE_ARCHITECTURE.md` | Receivable lifecycle, Posted immutability |

**This document is PAY3 only.** It defines **Online Payments** — not Finance Operations.

---

## 1. Executive summary

PAY3 adds **customer-initiated online payment capture** on top of the existing Payments module. Money enters Arivu through **controlled workflows** that create **`Payment`** records and **`PaymentAllocation`** rows — the same cash authority path as manual agent entry (PAY0).

```text
┌─────────────────────────────────────────────────────────────────┐
│  Commercial layer (FROZEN)                                      │
│  Invoice.amountDue — never mutated by gateway code              │
└────────────────────────────┬────────────────────────────────────┘
                             │ read-only (targets for apply)
┌────────────────────────────▼────────────────────────────────────┐
│  Online Payments layer (THIS DOCUMENT — PAY3)                   │
│  PaymentLink → PaymentGatewaySession → Webhook → Event Log      │
│  Controlled capture workflow → Payment → PaymentAllocation        │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses existing services
┌────────────────────────────▼────────────────────────────────────┐
│  Payments layer (PAY0–PAY2 — SHIPPED)                           │
│  PaymentAllocation = cash authority                             │
│  CustomerCreditApplication = credit authority                   │
└─────────────────────────────────────────────────────────────────┘
```

**What PAY3 ships:**

| # | Deliverable |
|---|-------------|
| 1 | **Payment Link** — shareable pay URL (email, SMS, agent copy) |
| 2 | **Hosted Checkout** — provider-hosted payment page (Stripe / Razorpay) |
| 3 | **Portal Pay Now** — customer self-service on Portal app |
| 4 | **Webhook Processing** — signed, idempotent, tenant-scoped ingestion |
| 5 | **Payment Gateway Event Log** — append-only audit of every provider event |
| 6 | **Payment Gateway Reconciliation Contract** — settlement matching schema (reporting only) |
| 7 | **Stripe readiness** — adapter contract + webhook map |
| 8 | **Razorpay readiness** — adapter contract + webhook map |
| 9 | **Manual Bank Transfer fallback** — offline instructions + agent record path |

**What PAY3 explicitly does NOT ship:**

| Out of scope | Owner (later phase) |
|--------------|---------------------|
| GL / journal posting | Finance Operations |
| Bank feed ingestion | Finance Operations |
| Bank reconciliation (statement ↔ bank) | Finance Operations |
| Payout settlement accounting | Finance Operations |
| Dunning / collections automation | Collections module |
| Chargeback dispute workflow (beyond event capture) | PAY4+ |
| Multi-provider routing logic per txn | PAY4+ |

---

## 2. Architectural principles (locked)

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Cash authority unchanged** | **`PaymentAllocation`** remains the sole writer of `Invoice.amountPaid`. Gateway code never bypasses allocation services. |
| 2 | **No direct invoice mutation** | Gateway events **never** update `amountDue`, `amountPaid`, `creditAppliedTotal`, or invoice lifecycle directly. |
| 3 | **Controlled Payment creation** | A succeeded gateway capture creates a **`Payment`** only through `paymentRecordService` (or gateway wrapper calling it). |
| 4 | **Append-only gateway audit** | Every webhook payload and processing outcome is stored in **`PaymentGatewayEvent`**. Events are never deleted or overwritten. |
| 5 | **State preservation** | Provider states (`pending`, `processing`, `succeeded`, `failed`, `canceled`, `refunded`) are stored on gateway entities and mapped — never collapsed silently. |
| 6 | **Idempotent ingestion** | Duplicate webhooks must not create duplicate `Payment` rows. Keyed by provider event ID + `externalReference`. |
| 7 | **Tenant isolation** | Credentials, sessions, events, and reconciliation rows scoped by `organizationId`. |
| 8 | **Commercial immutability** | Gateway flows read invoice `amountDue` / targets only — never mutate line snapshots. |
| 9 | **Billing authority untouched** | No writes to `SalesOrderInvoiceAllocation`. |
| 10 | **Credit authority untouched** | Gateway capture is **cash in** — never writes `CustomerCreditApplication`. |
| 11 | **Separation from Finance Ops** | Reconciliation **contract** defines how to match gateway settlement files to `Payment` records — no bank ledger writes. |
| 12 | **Fallback always available** | Every online flow offers **Manual Bank Transfer** as an alternative — no vendor lock-in on capture channel. |

---

## 3. Position in the payment stack

### 3.1 Authority model (unchanged from PAY0–PAY2)

| Layer | Authority | Gateway may write? |
|-------|-----------|-------------------|
| Billing | `SalesOrderInvoiceAllocation` | **No** |
| Cash | `PaymentAllocation` | **Indirect only** — via existing apply service after `Payment` recorded |
| Credit | `CustomerCreditApplication` | **No** |

### 3.2 Receivable formula (unchanged)

```text
amountDue = grandTotal - amountPaid - writeOffTotal - creditAppliedTotal
```

Gateway success → `Payment` → `PaymentAllocation` → `amountPaid` ↑ → `amountDue` ↓.

### 3.3 End-to-end online capture flow

```text
Agent / Portal / Payment Link
  → Create PaymentGatewaySession (status: pending)
    → Redirect to Hosted Checkout (Stripe Checkout / Razorpay Checkout)
      → Customer pays OR fails OR abandons
        → Provider webhook → POST /api/payment-gateways/webhooks/:provider
          → PaymentGatewayEvent (raw payload, append-only)
          → Idempotent processor (gatewayWebhookService)
            → IF succeeded AND Payment not yet linked:
                → paymentGatewayCaptureService.captureSucceededSession()
                  → paymentRecordService.recordPayment()
                    → paymentAllocationService.apply() [pre-declared targets]
                  → Payment.externalReference = provider payment id
                  → PaymentGatewaySession.status = succeeded
            → IF failed: session.status = failed (no Payment)
            → IF refunded (later webhook): refundService (existing PAY1 path)
          → Activity + optional reconciliation queue entry
```

**Hard rule:** No step between webhook receipt and `Payment` creation may call invoice rollup services directly.

---

## 4. Domain entities

### 4.1 PaymentLink

Shareable entry point for online pay. Created by agent (CRM) or system (Portal invoice view).

```javascript
// server/models/PaymentLink.js (planned)
{
  organizationId,

  paymentLinkId,               // public UUID
  paymentLinkNumber,           // PLK-0001

  // ── Scope ──
  organizationRefId,           // account (required)
  contactId,                   // optional — payer hint

  // ── Pay target (declarative — applied on capture, not on link create) ──
  payTargetType,               // single_invoice | multi_invoice | open_balance | fixed_amount
  invoiceIds,                  // UUID[] — when invoice-scoped
  fixedAmount,                 // when payTargetType = fixed_amount
  currency,                    // ISO 4217 — must match invoice(s) or org policy

  // ── Capture options ──
  allowedMethods,              // ['card', 'bank_transfer'] — bank_transfer = manual fallback
  expiresAt,                   // optional TTL
  maxUses,                     // optional — default 1 for invoice links
  useCount,

  // ── Gateway binding ──
  preferredProvider,           // stripe | razorpay | manual
  paymentGatewaySessionId,     // active session UUID (nullable)

  // ── Public access ──
  publicToken,                 // opaque token for URL — never sequential id
  publicUrl,                   // denormalized for display

  // ── Branding (immutable snapshot at link create) ──
  brandingSnapshot: {
    displayName,               // org or invoice-facing name
    logoUrl,                   // optional — CDN URL at create time
    accentColor,               // hex — optional
    supportEmail,
    footerText                 // optional legal / help copy
  },

  // ── Lifecycle ──
  status,                      // active | expired | consumed | revoked
  createdAt, createdBy,
  revokedAt, revokedBy,

  sourceContext,               // crm | portal | api | email_campaign
  sourceRef,                   // { moduleKey, recordId }
  notes
}
```

**Rules:**

1. Creating a link **does not** reserve or reduce `amountDue`.
2. Link declares **intent** (which invoices / how much); validation re-runs at capture time against live `amountDue`.
3. Expired or revoked links cannot start new sessions.
4. `publicToken` is unguessable; rate-limited public routes resolve tenant from token lookup only.
5. Single-invoice links default `payTargetType: single_invoice`, `maxUses: 1`.
6. **`brandingSnapshot`** captured at link create from org/invoice branding settings — **immutable** after create; public pay page renders from snapshot only (org rebrand does not retroactively change sent links).

### 4.2 PaymentGatewaySession (Hosted Checkout)

One checkout attempt bound to a provider session. Bridges PaymentLink (or Portal Pay Now) to provider UI.

```javascript
// server/models/PaymentGatewaySession.js (planned)
{
  organizationId,

  paymentGatewaySessionId,     // public UUID

  paymentLinkId,               // optional — null for direct Portal Pay Now
  organizationRefId,
  contactId,

  provider,                    // stripe | razorpay
  providerSessionId,           // cs_xxx (Stripe) | order_xxx (Razorpay)
  providerPaymentId,           // pi_xxx / pay_xxx — set on success
  providerCustomerId,          // optional — saved customer at provider

  // ── Money (session snapshot at create) ──
  amount,
  currency,
  payTargetType,
  invoiceTargets: [{           // frozen intent at session create
    invoiceId,
    invoiceMongoId,
    amountRequested              // min(amountDue at create, remaining session budget)
  }],

  // ── Gateway lifecycle (preserved) ──
  status,                      // pending | processing | succeeded | failed | canceled | expired
  failureCode,                 // provider error code
  failureMessage,

  // ── Arivu linkage (post-capture) ──
  paymentId,                   // UUID — set when Payment recorded
  paymentMongoId,

  // ── URLs ──
  checkoutUrl,                 // redirect URL
  successUrl,
  cancelUrl,

  // ── Timestamps ──
  createdAt,
  expiresAt,
  completedAt,

  idempotencyKey,              // client-supplied or generated
  metadata                     // provider passthrough (invoice numbers, link id)
}
```

**Rules:**

1. Session `amount` ≤ Σ live `amountDue` of targets at **apply time** (re-validated on webhook).
2. **`status: succeeded`** requires linked `paymentId` — never mark succeeded without Payment row.
3. Failed / canceled sessions **never** create `Payment`.
4. One active session per link at a time (optional org policy); new session revokes prior pending session on same link.
5. Provider session IDs are unique per `(organizationId, provider)`.

**Status preservation map:**

| Gateway session status | Payment created? | Invoice touched? |
|------------------------|------------------|------------------|
| `pending` | No | No |
| `processing` | No | No |
| `succeeded` | Yes | Via allocation only |
| `failed` | No | No |
| `canceled` | No | No |
| `expired` | No | No |

### 4.3 PaymentGatewayEvent (Event Log)

Append-only log of every provider webhook and polled status check.

```javascript
// server/models/PaymentGatewayEvent.js (planned)
{
  organizationId,

  paymentGatewayEventId,       // public UUID

  provider,                    // stripe | razorpay | manual
  providerEventId,             // evt_xxx / unique webhook id — UNIQUE per org+provider
  eventType,                   // payment_intent.succeeded | payment.captured | ...

  // ── Raw audit ──
  payload,                     // full JSON body (redacted PAN if present)
  signatureValid,              // webhook signature verification result
  receivedAt,
  receivedFromIp,

  // ── Processing ──
  processingStatus,            // received | processing | processed | ignored | failed
  processingError,             // if failed
  processedAt,

  // ── Linkage ──
  paymentGatewaySessionId,
  paymentLinkId,
  paymentId,                   // set after successful capture workflow

  // ── Idempotency ──
  idempotencyKey,              // hash(provider + providerEventId)

  // Immutable after insert — no updatedAt mutation of payload
}
```

**Rules:**

1. **Insert-only** — no updates to `payload` after write; processing fields may update once.
2. Duplicate `providerEventId` → return 200 to provider, skip re-processing (idempotent).
3. Invalid signature → store event with `signatureValid: false`, `processingStatus: ignored`, alert ops — **never** create Payment.
4. Events retained for minimum **7 years** (org-configurable archive policy later).
5. Failed processing remains auditable — manual replay via admin tool (PAY3.1), not silent delete.

### 4.4 PaymentGatewayReconciliationEntry (Reconciliation Contract)

**Reporting contract only** — matches provider settlement/payout lines to Arivu `Payment` records. Does not post to GL or bank ledger.

```javascript
// server/models/PaymentGatewayReconciliationEntry.js (planned)
{
  organizationId,

  paymentGatewayReconciliationEntryId,

  provider,                    // stripe | razorpay
  reconciliationBatchId,       // import batch UUID
  providerSettlementId,        // payout / settlement id from provider file
  providerTransactionId,       // charge / payment id

  // ── Provider side ──
  settlementDate,
  grossAmount,
  feeAmount,
  netAmount,
  currency,
  providerStatus,              // settled | pending | reversed

  // ── Arivu side (matched) ──
  matchStatus,                 // unmatched | matched | partial | disputed | ignored
  paymentId,                   // linked Payment UUID
  paymentMongoId,
  paymentGatewaySessionId,
  matchedAmount,
  varianceAmount,              // grossAmount - Payment.amount (FX/timing)

  matchedAt,
  matchedBy,                   // system | user id
  matchMethod,                 // auto_external_reference | auto_amount_date | manual

  notes,
  importedAt
}
```

**Reconciliation contract (locked semantics):**

| Match key (priority) | Condition |
|----------------------|-----------|
| 1 | `Payment.externalReference` = `providerTransactionId` |
| 2 | `PaymentGatewaySession.providerPaymentId` = `providerTransactionId` |
| 3 | Manual match — same `organizationRefId`, amount ± tolerance, date window |

**Out of scope for PAY3 implementation of matcher:** automated SFTP import, fee GL entries, payout bank confirmation. PAY3 ships **schema + manual CSV import API + match UI stub**.

### 4.5 Manual Bank Transfer Instruction

Fallback when customer chooses bank transfer instead of card/UPI.

```javascript
// server/models/BankTransferInstruction.js (planned)
{
  organizationId,

  bankTransferInstructionId,

  paymentLinkId,               // or session parent
  organizationRefId,

  // ── Display to customer ──
  beneficiaryName,
  bankName,
  accountNumberMasked,         // display only
  routingOrIfsc,
  referenceCode,               // unique per instruction — customer must include in transfer
  amount,
  currency,

  invoiceTargets,              // same shape as session

  status,                      // pending | proof_submitted | matched | expired | canceled
  expiresAt,

  // ── Agent workflow ──
  matchedPaymentId,            // when agent records Payment with referenceCode
  proofAttachmentIds,          // optional customer upload (PAY3.1)

  createdAt
}
```

**Rules:**

1. Instruction creation **does not** create `Payment` or reduce `amountDue`.
2. Agent records payment via existing **`POST /api/payments`** with `paymentInstrumentSnapshot.method: bank_transfer` and `referenceNumber: referenceCode`.
3. On manual record, link instruction → `matchedPaymentId`, `status: matched`.
4. Same allocation rules as online capture — agent applies to declared invoices or auto-apply.

---

## 5. Channel specifications

### 5.1 Payment Link

**CRM flow:**

```text
Invoice record → "Send payment link"
  → paymentLinkService.create({ invoiceIds, allowedMethods, expiresAt })
  → Returns publicUrl
  → Email / copy link to customer
```

**Customer flow:**

```text
GET /pay/:publicToken (public, unauthenticated)
  → Resolve PaymentLink + validate status
  → Render from brandingSnapshot (logo, displayName, accent)
  → Show amount, invoices, method choice (Card | Bank transfer)
  → Card → start Hosted Checkout (§5.2)
  → Bank transfer → show BankTransferInstruction (§5.9)
```

**API (planned):**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payment-links` | Create link |
| GET | `/api/payment-links/:id` | Agent detail |
| POST | `/api/payment-links/:id/revoke` | Revoke |
| GET | `/pay/:publicToken` | Public landing (SSR or SPA) |

### 5.2 Hosted Checkout

Provider-hosted UI — Arivu never handles raw card data (PCI scope reduction).

```text
paymentGatewaySessionService.createCheckout({ paymentLinkId, provider })
  → Provider API: create Checkout Session / Order
  → Save PaymentGatewaySession (pending) + checkoutUrl
  → Redirect customer to checkoutUrl
  → Return URLs hit success/cancel landing pages (informational only — **webhook is source of truth**)
```

**Rules:**

1. Success redirect **does not** record Payment — UI polls session status or waits for webhook.
2. Cancel redirect sets session `canceled` if provider confirms; otherwise TTL expiry.
3. Amount sent to provider = session `amount` in minor units (cents/paise).

### 5.3 Portal Pay Now

Portal app (`appKey: PORTAL`) surface — reuses PaymentGatewaySession; no duplicate capture logic.

```text
Portal invoice detail (Posted, amountDue > 0)
  → GET /portal/invoices/:id/pay-eligibility
  → POST /portal/invoices/:id/pay
      → Creates PaymentGatewaySession (no PaymentLink required)
      → Returns checkoutUrl
  → Customer completes Hosted Checkout
  → Webhook → Payment + PaymentAllocation (same as Payment Link)
```

**Portal constraints:**

| Rule | Detail |
|------|--------|
| Auth | Portal user must belong to `organizationRefId` on invoice |
| Visibility | Only Posted standard invoices with `amountDue > 0` |
| Permissions | Portal policy: execute payment on own receivables only |
| No CRM APIs | Portal routes under `/portal/*` — never expose gateway secrets to client |

**Planned routes:**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/portal/invoices/:id/pay-eligibility` | amountDue, currency, providers enabled |
| POST | `/portal/invoices/:id/pay` | Start checkout session |
| GET | `/portal/payment-sessions/:id/status` | Poll session status |

### 5.4 Webhook Processing

Single ingestion pipeline for all providers.

```text
POST /api/payment-gateways/webhooks/stripe
POST /api/payment-gateways/webhooks/razorpay
  1. Verify signature (provider-specific)
  2. Insert PaymentGatewayEvent (processingStatus: received)
  3. Enqueue or inline: gatewayWebhookProcessor.process(eventId)
  4. Return 200 quickly (< 5s) — heavy work async if needed
```

**Processor decision tree:**

```text
eventType in CAPTURE_SUCCESS_TYPES?
  → Resolve session by providerSessionId / providerPaymentId / metadata.paymentGatewaySessionId
  → assertCaptureTargets() — invoice status + amountDue re-validation (§7.0)
  → IF already has paymentId: mark event processed (duplicate)
  → ELSE captureSucceededSession()
eventType in CAPTURE_FAILURE_TYPES?
  → Update session status failed + failureCode
eventType in REFUND_TYPES?
  → Delegate to refundService with externalReference lookup (PAY1)
else
  → processingStatus: ignored (still retained)
```

**Idempotency guarantees:**

| Key | Scope |
|-----|-------|
| `providerEventId` | One event row; duplicate webhooks no-op |
| `Payment.externalReference` | Unique index — one Payment per provider charge |
| `paymentGatewaySessionId` + `status: succeeded` | At most one Payment per session |

### 5.5 Payment Gateway Event Log

Operational and audit surface — not a substitute for provider dashboard.

**Agent API:**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/payment-gateways/events` | Filter by date, provider, processingStatus |
| GET | `/api/payment-gateways/events/:id` | Full payload (permission-gated) |
| POST | `/api/payment-gateways/events/:id/replay` | Admin replay failed processing (PAY3.1) |

**Activity mirror:** `payment_gateway_event_received`, `payment_gateway_capture_succeeded`, `payment_gateway_capture_failed`.

### 5.6 Payment Gateway Reconciliation Contract

Defines how Finance **will** match settlement data — PAY3 implements import + match storage, not GL.

**Import API (planned):**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payment-gateways/reconciliation/import` | CSV upload (provider format templates) |
| GET | `/api/payment-gateways/reconciliation` | List entries + matchStatus |
| POST | `/api/payment-gateways/reconciliation/:id/match` | Manual link to Payment |
| GET | `/api/payment-gateways/reconciliation/summary` | unmatched count, variance totals |

**CSV templates (documented, not GL):**

| Provider | Key columns |
|----------|-------------|
| Stripe | `balance_transaction_id`, `source_id`, `gross`, `fee`, `net`, `currency`, `created` |
| Razorpay | `payment_id`, `amount`, `fee`, `tax`, `credit`, `debit`, `currency`, `settled_at` |

**Explicit non-goals:** auto-post fees to expense accounts, mark bank deposits cleared, multi-currency revaluation.

---

## 6. Provider adapters

### 6.1 Adapter interface (locked)

```javascript
// server/services/gateways/gatewayAdapterInterface.js (planned)
{
  providerKey,                 // stripe | razorpay

  createCheckoutSession({ organizationId, amount, currency, successUrl, cancelUrl, metadata }),
  retrieveSession(providerSessionId),
  verifyWebhookSignature(rawBody, headers),
  parseWebhookEvent(rawBody),  // → { providerEventId, eventType, providerSessionId, providerPaymentId, amount, currency, status }
  mapStatus(providerStatus),   // → pending | processing | succeeded | failed | canceled | refunded
  verifyCredentials({ organizationId }),  // → { status, errorCode?, errorMessage? }

  // Reconciliation import helpers
  parseSettlementRow(csvRow)   // → reconciliation entry shape
}
```

Each provider implements the interface — **no provider SDK calls outside adapter folder**.

### 6.2 Stripe readiness

| Area | PAY3 design |
|------|-------------|
| Product | **Stripe Checkout** (Hosted) — not Elements inline in PAY3 |
| Connect | **Stripe Connect** recommended for multi-tenant — `organizationId` → connected account id in tenant settings |
| Session create | `checkout.sessions.create` with `line_items`, `metadata.paymentGatewaySessionId` |
| Success events | `checkout.session.completed`, `payment_intent.succeeded` |
| Failure events | `payment_intent.payment_failed` |
| Refund events | `charge.refunded` → existing `refundService` |
| `externalReference` | `payment_intent.id` (primary) or `latest_charge` |
| `paymentInstrumentSnapshot` | `{ method: 'card', provider: 'stripe', referenceNumber: pi_xxx, maskedAccount: brand••••last4 }` |
| Currency | Stripe zero-decimal currency handling in adapter |
| Webhook endpoint | `/api/payment-gateways/webhooks/stripe` + signing secret per org or platform |

**Stripe metadata contract (required on every session):**

```json
{
  "organizationId": "...",
  "paymentGatewaySessionId": "...",
  "paymentLinkId": "...",
  "organizationRefId": "..."
}
```

### 6.3 Razorpay readiness

| Area | PAY3 design |
|------|-------------|
| Product | **Razorpay Checkout** (Hosted) — Orders API |
| Account | Razorpay sub-merchant / route per tenant (org settings) |
| Session create | `orders.create` + checkout options with `order_id` |
| Success events | `payment.captured` |
| Failure events | `payment.failed` |
| Refund events | `refund.processed` |
| `externalReference` | `razorpay_payment_id` |
| `paymentInstrumentSnapshot` | `{ method: 'card'|'other', provider: 'razorpay', referenceNumber: pay_xxx }` |
| Currency | INR primary; adapter validates org enabled currencies |
| Webhook endpoint | `/api/payment-gateways/webhooks/razorpay` + HMAC verification |

**Razorpay notes field contract:** embed `paymentGatewaySessionId` for webhook correlation.

### 6.4 Provider configuration (tenant settings)

```javascript
// Organization payment gateway settings (planned — settings module)
{
  organizationId,
  enabledProviders: ['stripe', 'razorpay', 'manual'],
  stripe: {
    connectedAccountId,
    webhookSecretRef,          // secret manager key — never plain text in DB
    checkoutMode: 'hosted'
  },
  razorpay: {
    keyIdRef,
    keySecretRef,
    webhookSecretRef
  },
  manualBankTransfer: {
    beneficiaryName,
    bankName,
    accountNumberEncrypted,
    routingOrIfsc,
    instructionsTemplate
  },
  defaultProvider,             // stripe | razorpay
  portalPayEnabled: true,
  paymentLinksEnabled: true,

  // ── Credential health (readiness — updated by health checks) ──
  credentialHealth: {
    stripe: {
      status,                  // unknown | healthy | degraded | invalid
      lastCheckedAt,
      lastCheckError,          // sanitized message
      webhookReachable         // optional — last successful test delivery
    },
    razorpay: {
      status,
      lastCheckedAt,
      lastCheckError,
      webhookReachable
    }
  }
}
```

### 6.5 Gateway credential health readiness

Lightweight readiness checks **before** session create — prevents checkout starts with broken credentials.

**Health check service (`gatewayCredentialHealthService`):**

| Check | Stripe | Razorpay |
|-------|--------|----------|
| API key valid | `accounts.retrieve` (Connect) or `balance.retrieve` | `orders.all({ count: 1 })` or key validation endpoint |
| Webhook secret configured | Secret ref present + non-empty | Same |
| Connected account active | `charges_enabled` / `payouts_enabled` flags | Sub-merchant status (adapter-specific) |

**Status semantics:**

| Status | Meaning | Session create |
|--------|---------|----------------|
| `unknown` | Never checked | Allowed — triggers check on first use (PAY3.0) |
| `healthy` | Last check passed | Allowed |
| `degraded` | Partial failure (e.g. webhook untested) | Allowed with admin warning |
| `invalid` | Auth failure or disabled account | **Blocked** — return `GATEWAY_CREDENTIALS_INVALID` |

**Rules:**

1. `createCheckoutSession` calls `assertProviderHealthy(organizationId, provider)` — fail fast before provider API call.
2. Health re-checked on credential save and on failed provider auth (401/403) during session create.
3. Scheduled background check optional (PAY3.1) — PAY3.0 runs on-demand only.
4. Health state stored on org gateway settings — never exposes secret values in API responses.

**API (planned):**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/payment-gateways/health` | Per-provider status for settings UI |
| POST | `/api/payment-gateways/health/check` | On-demand re-check (admin) |

**Adapter extension:**

```javascript
verifyCredentials({ organizationId })  // → { status, errorCode?, errorMessage? }
```

---

## 7. Integration with existing Payment services

### 7.0 Invoice status re-validation (before allocation)

Gateway capture **must re-load live invoice state** immediately before `PaymentAllocation` creation — session `invoiceTargets` are intent only. No gateway code path may call invoice rollup or lifecycle services directly.

**Service:** `gatewayAllocationValidationService.assertCaptureTargets(session)` — called from `captureSucceededSession()` after webhook success, before `paymentRecordService.recordPayment()`.

| Check | Rule | On failure |
|-------|------|------------|
| Invoice exists | Target `invoiceId` found for `organizationId` | Session → `failed`, event `processingStatus: failed`, code `INVOICE_NOT_FOUND` |
| Invoice type | `invoiceType === 'standard'` | `INVOICE_NOT_PAYABLE` |
| Commercial status | `status ∈ ['Posted', 'Partially Paid']` (same as `PAYABLE_INVOICE_STATUSES`) | `INVOICE_NOT_PAYABLE` |
| Not void / written off | `status ∉ ['Void', 'Written Off', 'Paid']` | `INVOICE_NOT_PAYABLE` |
| Amount due | `amountDue > 0` | `NOTHING_TO_APPLY` |
| Apply amount | `amountRequested ≤ amountDue` per target; Σ ≤ session.amount | `AMOUNT_EXCEEDS_DUE` |
| Account scope | `invoice.organizationRefId === session.organizationRefId` | `ACCOUNT_MISMATCH` |
| Currency | `invoice.currency === session.currency` | `CURRENCY_MISMATCH` |

**On any validation failure:**

1. **Do not** create `Payment` or `PaymentAllocation`.
2. Set `PaymentGatewaySession.status = failed` with `failureCode` from validation.
3. Record `PaymentGatewayEvent.processingStatus = failed` with error detail.
4. Provider charge may still exist — surface for **manual refund** via provider dashboard or future admin tool (out of PAY3.0 auto-refund scope).

**Re-validation also runs at:**

- Session create (prevent starting checkout against ineligible invoices)
- Webhook capture (authoritative — invoice may have been voided or paid manually during checkout)

### 7.1 Payment record on capture success

Gateway capture **must** call existing services:

```javascript
// gatewayCaptureService.captureSucceededSession(session, gatewayEvent)
await gatewayAllocationValidationService.assertCaptureTargets(session);

const payment = await paymentRecordService.recordPayment({
  organizationId,
  organizationRefId: session.organizationRefId,
  contactId: session.contactId,
  amount: session.amount,
  paymentCurrency: session.currency,
  paymentDate: new Date(),
  paymentPurpose: 'invoice_payment',
  paymentInstrumentSnapshot: adapter.buildInstrumentSnapshot(gatewayEvent),
  externalReference: gatewayEvent.providerPaymentId,
  sourceContext: session.paymentLinkId ? 'payment_link' : 'portal',
  sourceRef: { moduleKey: 'payment_gateway_sessions', recordId: session.paymentGatewaySessionId },
  autoApply: false,
  allocations: session.invoiceTargets.map(t => ({
    invoiceId: t.invoiceId,
    amountApplied: t.amountRequested   // re-validated ≤ amountDue
  }))
});
```

**Post-conditions:**

1. `Payment.status` derived by existing rollup (`recorded` → `fully_allocated` etc.).
2. `CustomerCreditBalance.syncCreditBalanceFromPayment` runs only if unallocated surplus — same as PAY2.
3. Invoice activity: `payment_applied` — not a new invoice mutation path.

### 7.2 Refund path (gateway-initiated)

Provider refund webhook → locate `Payment` by `externalReference` → **`refundService.createRefund`** (PAY1) — never ad-hoc invoice rollback.

### 7.3 States preserved across layers

| Provider state | PaymentGatewaySession | Payment | PaymentAllocation |
|----------------|----------------------|---------|-------------------|
| pending | pending | — | — |
| processing | processing | — | — |
| succeeded | succeeded | recorded+ | active |
| failed | failed | — | — |
| canceled | canceled | — | — |
| refunded (full) | succeeded (unchanged) | fully_refunded | reversed (via refund flow) |
| refunded (partial) | succeeded | partially_refunded | partial reversal |

---

## 8. Security and compliance

| Topic | Rule |
|-------|------|
| PCI | No PAN/CVV storage — Hosted Checkout only in PAY3 |
| Secrets | API keys in secret manager; webhook secrets rotatable |
| Public routes | Rate limit `/pay/:token`; no org enumeration |
| Webhook auth | Signature required; reject unsigned in production |
| Portal | Invoice ownership verified before session create |
| Audit | All captures traceable: Event → Session → Payment → Allocation |

---

## 9. API surface summary (PAY3 planned)

| Area | Routes |
|------|--------|
| Payment Links | `POST/GET /api/payment-links`, `POST .../revoke`, `GET /pay/:token` |
| Sessions | `POST /api/payment-gateways/sessions`, `GET .../sessions/:id` |
| Webhooks | `POST /api/payment-gateways/webhooks/stripe`, `.../razorpay` |
| Health | `GET /api/payment-gateways/health`, `POST .../health/check` |
| Event log | `GET /api/payment-gateways/events`, `GET .../:id` |
| Reconciliation | `POST .../reconciliation/import`, `GET .../reconciliation`, `POST .../:id/match` |
| Portal pay | `GET/POST /portal/invoices/:id/pay*` |
| Bank transfer | `POST /api/bank-transfer-instructions`, public display on link page |

**Permissions (planned keys):**

| Key | Action |
|-----|--------|
| `payments.managePaymentLinks` | Create/revoke links |
| `payments.viewGatewayEvents` | Read event log |
| `payments.manageReconciliation` | Import + manual match |
| Portal | Implicit — pay own invoices only |

---

## 10. Implementation phases (PAY3 breakdown)

**Authority preservation (all sub-phases):** Billing (`SalesOrderInvoiceAllocation`), Cash (`PaymentAllocation`), Credit (`CustomerCreditApplication`) — gateway code never performs direct invoice mutations.

| Sub-phase | Deliverable |
|-----------|-------------|
| **PAY3.0** | `PaymentLink` (+ `brandingSnapshot`), `PaymentGatewaySession`, `PaymentGatewayEvent`; Stripe adapter; webhook pipeline; credential health readiness; invoice re-validation; capture → `Payment` → `PaymentAllocation` |
| **PAY3.1** | Portal Pay Now; Payment Link UI (public page + CRM create); event replay admin |
| **PAY3.2** | Razorpay adapter; Manual Bank Transfer (`BankTransferInstruction`) |
| **PAY3.3** | Reconciliation CSV import + matching UI |

**PAY3.0 build order:**

1. Models + constants (`PaymentLink`, `PaymentGatewaySession`, `PaymentGatewayEvent`)
2. `gatewayCredentialHealthService` + Stripe `verifyCredentials`
3. `gatewayAllocationValidationService.assertCaptureTargets`
4. Stripe adapter + `createCheckoutSession`
5. Webhook ingestion + `PaymentGatewayEvent` append-only log
6. `gatewayCaptureService.captureSucceededSession` → existing `paymentRecordService` / `paymentAllocationService`

**Testing strategy:**

| Layer | Tests |
|-------|-------|
| Webhook processor | Idempotency, signature failure, duplicate success |
| Capture service | Invoice status re-validation, amountDue checks, allocation targets |
| Credential health | Invalid credentials block session create |
| Adapters | Stripe/Razorpay fixture payloads → normalized events |
| Portal | Auth boundary — cannot pay another org's invoice |

```bash
cd server && npm run test:payment-gateways   # planned script
```

---

## 11. Locked decisions (approval checklist)

| # | Decision | Value |
|---|----------|-------|
| 1 | PAY3 scope | **Online Payments only** — not Finance Operations |
| 2 | Cash authority | **`PaymentAllocation`** via existing services — unchanged |
| 3 | Gateway → invoice | **Never direct** — always Payment → Allocation |
| 4 | Webhook audit | **`PaymentGatewayEvent`** append-only |
| 5 | Success source of truth | **Webhook** — not redirect URL |
| 6 | Hosted vs embedded | **Hosted Checkout only** in PAY3 |
| 7 | Stripe integration | Checkout Session + Connect-ready metadata |
| 8 | Razorpay integration | Orders + Checkout + standard webhooks |
| 9 | Fallback | **Manual Bank Transfer** always available |
| 10 | Reconciliation | **Contract + import storage** — no GL/bank feeds |
| 11 | State preservation | pending / succeeded / failed / refunded all stored |
| 12 | Credit authority | Gateway does **not** write `CustomerCreditApplication` |
| 13 | Billing authority | Gateway does **not** write `SalesOrderInvoiceAllocation` |
| 14 | `externalReference` | Unique provider payment id on `Payment` |
| 15 | Portal | Reuses session service — no parallel capture stack |
| 16 | **PaymentLink branding** | **`brandingSnapshot`** immutable at link create — public page renders snapshot |
| 17 | **Pre-allocation validation** | Re-load invoice; **`Posted` \| `Partially Paid`** + `amountDue > 0` before allocation |
| 18 | **Credential health** | Provider **`healthy` \| `invalid`** gates session create; on-demand check in PAY3.0 |

---

## 12. Relationship to PAYMENTS_ARCHITECTURE.md

| PAYMENTS_ARCHITECTURE topic | PAY3 interaction |
|-----------------------------|------------------|
| §4.1 Payment `externalReference` | Populated on gateway capture |
| §4.1 `sourceContext` | New values: `payment_link`, `portal` (gateway) |
| §4.1 `paymentInstrumentSnapshot.provider` | `stripe` \| `razorpay` |
| §4.2 PaymentAllocation | Created by capture workflow — same rules |
| §4.6a CustomerCreditApplication | Unrelated to gateway capture |
| §14 Event hooks | Add `payment.gateway_captured` stub — still no GL |
| §20 Customer Statement | Gateway Payments appear as payment_allocation lines |

**PAYMENTS_ROADMAP.md** should reference this document for PAY3 detail after approval.

---

## 13. Known limitations (PAY3)

1. No embedded card form — Hosted Checkout only.
2. No automated bank feed reconciliation — manual CSV import only.
3. No GL fee posting on provider charges.
4. Single-provider per session — no split payment across Stripe + Razorpay.
5. Chargeback dispute workflow — event capture only; case management deferred.
6. Multi-invoice partial failure — if one invoice voided mid-checkout, session re-validation fails webhook (customer may need new link).
7. FX: payment currency must match invoice currency in PAY3 — cross-currency gateway deferred PAY4.

---

## 14. Summary

| Question | Answer |
|----------|--------|
| Does gateway change what was billed? | **No** |
| Does gateway directly update `amountDue`? | **No** |
| How does cash reach the invoice? | Webhook → **Payment** → **PaymentAllocation** |
| Where are webhooks stored? | **`PaymentGatewayEvent`** (append-only) |
| What if checkout fails? | Session `failed` — no Payment |
| What if customer prefers bank transfer? | **BankTransferInstruction** + manual **`POST /api/payments`** |
| Is this bank reconciliation? | **No** — reconciliation **contract** matches settlements to Payments for reporting |
| Stripe / Razorpay? | Adapter interface + webhook maps — implement in PAY3.0 / PAY3.2 |

---

## 15. Document control

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-06-02 | Initial draft for review — architecture only, no implementation |
| 1.0 | 2026-06-02 | Approved — brandingSnapshot, invoice re-validation, credential health |
| 1.1 | 2026-06-02 | Implementation order locked (PAY3.0–PAY3.3) |
| 1.2 | 2026-06-02 | PAY3.0 shipped — see `PAYMENT_GATEWAY_OPERATIONS.md` |

**Operations runbook:** `docs/PAYMENT_GATEWAY_OPERATIONS.md`  
**Next step:** PAY3.1 implementation per §10.
