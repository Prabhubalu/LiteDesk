# Payments Platform Retrospective

**Purpose:** Freeze the cash authority layer (PAY0–PAY3.1) and gateway capture foundation before PAY3.3 reconciliation and downstream finance work.

**Status:** Authoritative snapshot as of **2026-06-02**  
**Audience:** Engineering, product, platform architecture, finance ops  
**Scope:** INV4 · PAY0 · PAY1 · PAY2 · PAY3.0 · PAY3.1  

**Source documents:**

| Layer | Architecture | Roadmap / Ops |
|-------|--------------|---------------|
| Cash core | `docs/PAYMENTS_ARCHITECTURE.md` | `docs/PAYMENTS_ROADMAP.md` |
| Online capture | `docs/PAYMENT_GATEWAYS_ARCHITECTURE.md` v1.1 | `docs/PAYMENT_GATEWAY_OPERATIONS.md` |
| Idempotency | `docs/PAYMENT_GATEWAY_IDEMPOTENCY.md` | — |
| Commercial upstream | `docs/COMMERCIAL_PLATFORM_RETROSPECTIVE.md` | `docs/INVOICE_ROADMAP.md` |

---

## Executive summary

Arivu shipped a **three-layer receivables model** downstream of the frozen commercial stack:

```text
Commercial (FROZEN)     SalesOrderInvoiceAllocation · invoice line snapshots
       ↓
Cash (PAY0–PAY1)        Payment · PaymentAllocation · Refund · Reversal
       ↓
Credit (PAY2)           CustomerCreditBalance · CustomerCreditApplication
       ↓
Online capture (PAY3)   PaymentLink · PaymentGatewaySession · PaymentGatewayEvent
       ↓
Reconciliation (PAY3.3) NOT STARTED
```

**Platform bets that held:**

1. **Cash authority isolation** — `PaymentAllocation` is the sole writer path to `Invoice.amountPaid`; gateway code never touches billing allocations.
2. **Webhook as source of truth** — browser redirect URLs are informational; capture happens only after verified provider webhook.
3. **Layered idempotency** — event dedupe, provider payment ID dedupe, session linkage, and replay short-circuit prevent duplicate cash.
4. **Shared checkout session** — Portal Pay Now, Payment Links, and public `/pay/:token` all use `createGatewayCheckoutSession`.
5. **Live invoice re-validation** — `assertCaptureTargets()` re-checks Posted status and `amountDue` at webhook time, not at session create.
6. **Append-only gateway audit** — `PaymentGatewayEvent` payloads are immutable; only status and linkage fields update.

**Explicitly not shipped in PAY0–PAY3.1:** Reconciliation import/matching UI (PAY3.3), GL posting, payout reconciliation, dunning automation.

**PAY3.2 (2026-06-02):** Razorpay Orders + Checkout adapter, mock adapter, webhook at `/api/payment-gateways/webhooks/razorpay`; Manual Bank Transfer via `BankTransferInstruction` + agent `POST /api/payments` match path.

---

## 1. Shipped scope (PAY0–PAY3.1)

### 1.1 INV4 — Invoice payment hooks

| Deliverable | Location |
|-------------|----------|
| Rollup service | `invoicePaymentRollupService.js` |
| Void guard | `invoiceVoidService.js` — blocks void when `amountPaid > 0` |
| Payment summary API | `GET /api/invoices/:id/payment-summary` |
| Activity mirror | `invoiceActivityService.js` — `payment_applied`, `payment_reversed` |

### 1.2 PAY0 — Domain + record/apply/reverse

| Artifact | Notes |
|----------|-------|
| Models | `Payment`, `PaymentAllocation`, `PaymentReversal` |
| Constants | `paymentLifecycle.js`, `paymentPermissions.js`, `paymentModuleDefaults.js` |
| Services | `paymentRecordService`, `paymentAllocationPolicyService`, `paymentAllocationService`, `paymentReversalService`, rollups, activity |
| API | `POST/GET /api/payments`, allocations, reversals |
| Migration | `node server/scripts/migratePaymentsToCoreModule.js` |
| Tests | `npm run test:payments` — 27 scenarios |

### 1.3 PAY1 — Refunds

| Artifact | Notes |
|----------|-------|
| Models | `Refund`, `RefundAllocation` |
| Service | `refundService.js` — refund + reversal + rollups |
| API | `POST /api/payments/:id/refunds`, eligibility, detail |
| Client | `PaymentRefundWizardModal.vue`, payments record adapter sections |

### 1.4 PAY2 — Customer credit + statements

| Artifact | Notes |
|----------|-------|
| Models | `CustomerCreditBalance`, `CustomerCreditApplication` |
| Formula | `amountDue = grandTotal - amountPaid - writeOffTotal - creditAppliedTotal` |
| Services | `customerCreditBalanceService`, `customerCreditApplicationService`, `customerStatementService` |
| API | `/api/customer-statements/*` — preview, CSV, PDF, credit apply/reverse |
| Client | `CustomerCreditApplyModal.vue`, `CustomerStatementPanel.vue` |

### 1.5 PAY3.0 — Gateway core

| Artifact | Notes |
|----------|-------|
| Models | `PaymentLink`, `PaymentGatewaySession`, `PaymentGatewayEvent`, `OrganizationPaymentGatewaySettings` |
| Adapter | Stripe Checkout Session + mock adapter for tests |
| Pipeline | `ingestWebhook` → `processGatewayEvent` → `captureSucceededSession` → `recordPayment` |
| Webhook | `POST /api/payment-gateways/webhooks/stripe` (raw body, before `express.json`) |
| Credential health | `gatewayCredentialHealthService` — on-demand checks, blocks `invalid` |
| Tests | `npm run test:payment-gateways` — 9 scenarios |

### 1.6 PAY3.1 — Customer + admin UI

| Surface | Route / component |
|---------|-------------------|
| Portal Pay Now | `/portal/invoices` → `POST /portal/invoices/:id/pay` |
| Payment Link CRM | `InvoicePaymentLinkPanel.vue` on invoice record |
| Public pay page | `/pay/:publicToken` — hosted checkout redirect |
| Event replay admin | `PaymentGatewayEventsPanel.vue` — `POST …/events/:id/replay` |
| Shared session | `createGatewayCheckoutSession` — portal + link + public |

### 1.7 PAY3.2 — Razorpay + Manual Bank Transfer

| Artifact | Notes |
|----------|-------|
| Razorpay adapter | `razorpayGatewayAdapter.js` — Orders API, notes correlation, HMAC webhook |
| Mock Razorpay | `mockRazorpayGatewayAdapter.js` — test/dev without keys |
| Webhook | `POST /api/payment-gateways/webhooks/razorpay` |
| Checkout UI | `/pay/checkout/razorpay` — Razorpay.js hosted modal |
| Bank transfer model | `BankTransferInstruction.js` — reference code, pending → matched |
| Bank transfer service | `bankTransferInstructionService.js` — public create, agent match on `recordPayment` |
| Public API | `POST /api/public/pay/:token/bank-transfer` |
| CRM API | `GET /api/bank-transfer-instructions?invoiceMongoId=` |
| Client | `BankTransferInstructionsPanel.vue`, public pay bank transfer option |

**Manual capture path:** Instruction does not reduce `amountDue` — agent records `POST /api/payments` with `method: bank_transfer` + `referenceNumber`; service auto-matches instruction.

---

## 2. Authority model

| Layer | Authority model | Payments may write? | Gateway may write? |
|-------|-----------------|---------------------|-------------------|
| **Billing** | `SalesOrderInvoiceAllocation` | **Never** | **Never** |
| **Commercial snapshots** | Invoice line/section snapshots | **Never** | **Never** |
| **Cash** | `PaymentAllocation` | **Yes** — sole path to `amountPaid` | **Yes** — via `recordPayment` only |
| **Credit** | `CustomerCreditApplication` | **Yes** (PAY2 services) | **Never** |
| **Receivable rollups** | `Invoice.amountDue`, `amountPaid`, `paymentStatus` | Via allocation/credit rollup services only | **Never direct** |

**Capture path (online):**

```text
Webhook → assertCaptureTargets → recordPayment({ allocations })
  → PaymentAllocation.create → invoicePaymentRollupService
```

**Hard rule:** No gateway service imports invoice mutation helpers outside rollup chain.

---

## 3. Idempotency strategy

Full reference: `docs/PAYMENT_GATEWAY_IDEMPOTENCY.md`

| Layer | Key | Enforcement |
|-------|-----|-------------|
| Webhook events | `(organizationId, provider, providerEventId)` | Unique index on `PaymentGatewayEvent`; ingest returns `{ duplicate: true }` |
| Provider payment IDs | `(organizationId, externalReference)` | Unique partial index on `Payment`; pre-capture lookup |
| Session linkage | `PaymentGatewaySession.paymentId` | Early return in `processGatewayEvent` + `captureSucceededSession` |
| Replay | `processingStatus === 'processed'` | Short-circuit `{ replayed: true, duplicate: true }` — no second Payment |

**Indexes (authoritative):**

```javascript
// PaymentGatewayEvent
{ organizationId: 1, provider: 1, providerEventId: 1 }  // unique
{ paymentGatewayEventId: 1 }                              // unique UUID

// Payment
{ organizationId: 1, externalReference: 1 }              // unique partial (non-empty string)

// PaymentGatewaySession
{ organizationId: 1, provider: 1, providerSessionId: 1 } // unique sparse
```

---

## 4. Webhook architecture

### 4.1 Ingest pipeline

```text
POST /api/payment-gateways/webhooks/{provider}
  → adapter.parseWebhookEvent (extract organizationId from metadata/notes)
  → adapter.verifyWebhookSignature
  → findOne({ organizationId, provider, providerEventId })
      exists → { duplicate: true }     // HTTP 200, no new row
  → PaymentGatewayEvent.create({ payload, signatureValid, processingStatus: received|ignored })
  → processGatewayEvent (if signature valid)
```

### 4.2 Processing (success)

```text
processGatewayEvent
  ├─ [processed] → replay short-circuit
  ├─ resolveSessionForEvent(paymentGatewaySessionId | providerSessionId)
  ├─ [session.paymentId] → duplicate
  ├─ [Payment.externalReference] → DUPLICATE_PROVIDER_PAYMENT
  └─ captureSucceededSession
       ├─ assertCaptureTargets (live Posted / amountDue)
       ├─ recordPayment → Payment + PaymentAllocation
       └─ event → processingStatus: processed
```

### 4.3 Provider metadata contracts

**Stripe (Checkout Session metadata):**

```json
{
  "organizationId": "<ObjectId>",
  "paymentGatewaySessionId": "<UUID>",
  "paymentLinkId": "<UUID or empty>",
  "organizationRefId": "<ObjectId>"
}
```

**Razorpay (Order notes — PAY3.2):** same keys in `notes` object.

### 4.4 Source-of-truth rule

| Event | Records Payment? |
|-------|------------------|
| Browser success redirect | **No** |
| Verified provider webhook | **Yes** |
| Admin replay (processed event) | **No** — returns prior result |
| Admin replay (failed event) | **Yes** — re-runs with same guards |

---

## 5. Replay strategy

**API:** `POST /api/payment-gateways/events/:paymentGatewayEventId/replay`

| Event state | Behavior |
|-------------|----------|
| `processed` | Return `{ replayed: true, duplicate: true, paymentId }` — no re-capture |
| `ignored` (bad signature) | No replay — fix credentials, wait for provider retry with new event id |
| `failed` | Re-run success/failure branch with full idempotency checks |
| Duplicate Stripe delivery | Same event row; processor idempotent via session/payment guards |

**UI:** `PaymentGatewayEventsPanel.vue` on payment record — permission `managePaymentLinks`.

`allowReplay: true` does **not** bypass idempotency — it only permits re-entry on non-processed events.

---

## 6. Migration requirements

Run on deploy (idempotent where noted):

| Step | Command / action |
|------|------------------|
| 1 | `node server/scripts/migratePaymentsToCoreModule.js` — PAY0 platform module registration |
| 2 | Ensure `stripe` npm package in `server/` |
| 3 | Set env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_APP_URL` |
| 4 | Register Stripe webhook → `/api/payment-gateways/webhooks/stripe` |
| 5 | Per-tenant `OrganizationPaymentGatewaySettings` — enable providers, store webhook secret override |
| 6 | PAY3.2+: register Razorpay webhook → `/api/payment-gateways/webhooks/razorpay` |
| 7 | PAY3.2+: configure `manualBankTransfer` beneficiary fields per tenant |

**No data migration** required for PAY3 gateway entities — greenfield collections.

---

## 7. Deferred work

| Phase | Scope | Status |
|-------|-------|--------|
| **PAY3.2** | Razorpay adapter; Manual Bank Transfer | ✅ Done |
| **PAY3.3** | Reconciliation CSV import, match UI, payout alignment | Next |
| **Finance** | GL journal entries, fee recognition, bank feed ingestion | Out of scope |
| **Collections** | Write-off workflow UI, dunning automation | Schema-ready only |
| **Portal** | Bank transfer on portal invoices (optional — link path first) | PAY3.2+ |
| **Secrets** | Secret manager refs vs plain DB fields | Architecture target; PAY3.0 uses DB + env fallback |

---

## 8. Operational procedures

Full runbook: `docs/PAYMENT_GATEWAY_OPERATIONS.md`

### 8.1 Production capture checklist

1. Verify `OrganizationPaymentGatewaySettings.credentialHealth.{provider}.status === healthy`
2. Customer completes hosted checkout
3. Confirm `PaymentGatewayEvent` row with `processingStatus: processed`
4. Confirm `Payment.externalReference` = provider charge id
5. Confirm `Invoice.amountDue` reduced via rollup (not direct edit)

### 8.2 Failure triage

| Symptom | Action |
|---------|--------|
| Event `failed` + `INVOICE_NOT_PAYABLE` | Fix invoice status/amount; replay event |
| Event `failed` + `DUPLICATE_PROVIDER_PAYMENT` | Investigate cross-session duplicate charge id — safe, no double cash |
| Event `ignored` + invalid signature | Fix webhook secret; provider will retry with new event id |
| Session `succeeded` but no Payment | Check event processingStatus; replay if `failed` |
| Customer paid, UI shows processing | Expected — webhook latency; poll session status |

### 8.3 Health check

```http
POST /api/payment-gateways/health/check
{ "provider": "stripe" }
```

Blocks session create when status is `invalid`.

### 8.4 Test suites

```bash
cd server && npm run test:payments           # 27 — cash, credit, statements
cd server && npm run test:payment-gateways   # 9+ — gateway capture, idempotency
```

---

## 9. Known limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Activity `recordId` UUID vs ObjectId | `[PaymentActivity]` / `[InvoiceActivity]` log warnings in tests | Non-blocking; payments record correctly |
| Gateway events panel on payment record | Global event list, not per-payment filter | Acceptable for PAY3.1 admin replay |
| Plain-text webhook secrets in org settings | Security debt vs secret manager target | Restrict DB access; rotate on compromise |
| Stripe-only production adapter until PAY3.2 | INR/UPI tenants need Razorpay | PAY3.2 ships adapter |
| No automated reconciliation | Manual CSV match only in PAY3.3 | Ops uses `externalReference` lookup |
| Return pages show processing only | Customer may refresh before webhook | By design — webhook is truth |
| Mock adapter auto-selects in test / missing `STRIPE_SECRET_KEY` | Dev must set env for live Stripe | Documented in operations guide |
| `enabledProviders` not enforced at UI layer | CRM may offer disabled provider | Server blocks at `assertProviderHealthy` |
| Bank transfer proof upload | Schema-ready `proofAttachmentIds`; UI deferred | Agent records via `POST /api/payments` |

---

## 10. Relationship to frozen commercial layer

| Artifact | Status | Payment action |
|----------|--------|----------------|
| `SalesOrderInvoiceAllocation` | ✅ Frozen | **Never write** |
| Invoice commercial snapshots | ✅ Frozen | **Never mutate** |
| `Invoice.amountDue` / `amountPaid` | ✅ Live | Rollup from `PaymentAllocation` + credit |
| Credit notes (INV3) | ✅ Shipped | Reduce `amountDue` — not payment targets |
| Write-offs | Schema-ready | Collections owns — coordinated rollup only |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-02 | Initial retrospective — PAY0–PAY3.1 shipped scope frozen |
| 1.1 | 2026-06-02 | PAY3.2 — Razorpay + Manual Bank Transfer shipped |
