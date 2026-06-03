# Payment Gateway — Idempotency Implementation Note

**Status:** Verified against PAY3.0 code  
**Last updated:** 2026-06-02  
**Code references:** `gatewayWebhookService.js`, `gatewayCaptureService.js`, model indexes  

---

## 1. Summary

Three independent idempotency layers prevent duplicate cash recording:

| Layer | Key | Enforced by |
|-------|-----|-------------|
| **Webhook events** | `(organizationId, provider, providerEventId)` | Unique index + ingest lookup |
| **Provider payment IDs** | `(organizationId, externalReference)` | Unique partial index + pre-capture lookup |
| **Session linkage** | `PaymentGatewaySession.paymentId` | Early return in processor + capture service |
| **Replay processing** | `PaymentGatewayEvent.processingStatus === 'processed'` | Short-circuit before re-capture |

Webhook remains **source of truth** — replay re-invokes the same processor; it does not bypass validation or create parallel flows.

---

## 2. Indexes

### 2.1 `PaymentGatewayEvent`

```javascript
// Unique webhook dedupe (authoritative)
{ organizationId: 1, provider: 1, providerEventId: 1 }  // unique

// Query helpers
{ paymentGatewayEventId: 1 }                            // unique (public UUID)
{ idempotencyKey: 1 }                                     // `${provider}:${providerEventId}` (pre-save)
{ processingStatus: 1 }
{ paymentGatewaySessionId: 1 }
```

**Pre-save hook:** `idempotencyKey = `${provider}:${providerEventId}``

### 2.2 `Payment`

```javascript
// Provider payment id dedupe (cash header)
{
  organizationId: 1,
  externalReference: 1
}  // unique, partialFilterExpression: { externalReference: { $type: 'string', $ne: '' } }
```

`externalReference` = Stripe `payment_intent` id (`pi_…`) at capture.

### 2.3 `PaymentGatewaySession`

```javascript
{ organizationId: 1, provider: 1, providerSessionId: 1 }  // unique, sparse
{ organizationId: 1, provider: 1, providerPaymentId: 1 }  // sparse (lookup only)
{ paymentGatewaySessionId: 1 }                            // unique
```

Session `paymentId` set once on successful capture — subsequent success events for same session return `{ duplicate: true }`.

---

## 3. Webhook event idempotency

### 3.1 Ingest flow (`ingestWebhook`)

```text
POST /api/payment-gateways/webhooks/stripe
  → parseWebhookEvent → providerEventId, organizationId
  → findOne({ organizationId, provider, providerEventId })
      IF exists → return { duplicate: true, event: existing }   // HTTP 200, no new row
      ELSE → PaymentGatewayEvent.create({ payload, signatureValid, processingStatus })
  → IF !signatureValid → processingStatus: ignored, stop
  → ELSE → processingStatus: received → hand off to processor
```

**Duplicate Stripe delivery:** second POST finds existing row; **no second insert**. Processor may run again (see §5).

### 3.2 Processing status state machine

```text
received → processing → processed | failed | ignored
```

Payload is **never mutated** after insert; only `processingStatus`, `processingError`, `processedAt`, linkage fields update.

---

## 4. Provider payment ID idempotency

### 4.1 Check order in `processGatewayEvent` (success path)

```text
1. session.paymentId set?
     YES → result = { duplicate: true, paymentId } → mark event processed
2. findExistingPaymentByExternalReference(organizationId, providerPaymentId)
     YES → throw DUPLICATE_PROVIDER_PAYMENT → event processingStatus: failed
3. captureSucceededSession()
     → assertCaptureTargets() again (live invoice)
     → recordPayment({ externalReference: providerPaymentId, allocations })
     → markSessionSucceeded({ paymentId })
```

### 4.2 Second guard inside `captureSucceededSession`

```text
IF session.paymentId → return { duplicate: true }          // race-safe re-entry
IF Payment.findOne({ externalReference }) → throw DUPLICATE_PROVIDER_PAYMENT
ELSE → recordPayment + markSessionSucceeded
```

**Cross-session duplicate:** same `pi_` on a different session fails at step 2 — one Payment per provider charge per tenant.

---

## 5. Replay processing idempotency

### 5.1 API

```http
POST /api/payment-gateways/events/:paymentGatewayEventId/replay
```

Calls `processGatewayEvent({ allowReplay: true })` — **`allowReplay` does not skip idempotency**; it only allows re-entry when status is `failed` (not short-circuited for failed replay attempts).

### 5.2 Replay decision (`processGatewayEvent`)

```text
IF processingStatus === 'processed'
  → return { replayed: true, result: { duplicate: true, paymentId } }   // NO re-capture

IF !signatureValid
  → return { ignored: true }                                            // NO replay

IF processingStatus === 'failed' (or received never processed)
  → re-run success/failure branch with same idempotency checks above
```

### 5.3 `ingestAndProcessWebhook` on duplicate ingest

```text
ingestWebhook → duplicate: true
  → processGatewayEvent(allowReplay: false)
      → if already processed → { replayed: true, duplicate: true }
      → no duplicate Payment
```

---

## 6. End-to-end processing flow (success)

```text
Stripe webhook
  └─ ingestWebhook
       ├─ [dup providerEventId] → existing event
       └─ [new] → PaymentGatewayEvent (received)
  └─ processGatewayEvent
       ├─ [processed] → replayed short-circuit
       ├─ resolveSessionForEvent(metadata.paymentGatewaySessionId | providerSessionId)
       ├─ [session.paymentId] → duplicate session result
       ├─ [Payment.externalReference exists] → DUPLICATE_PROVIDER_PAYMENT
       └─ captureSucceededSession
            ├─ assertCaptureTargets (live Posted / amountDue)
            ├─ recordPayment → Payment + PaymentAllocation
            ├─ markSessionSucceeded
            └─ event → processingStatus: processed, paymentId linked
```

**Invoice mutation path:** `PaymentAllocation` → `invoicePaymentRollupService` only. No gateway direct writes to `Invoice`.

---

## 7. Failure codes vs idempotency

| Code | Idempotent? | Notes |
|------|-------------|-------|
| `DUPLICATE_PROVIDER_PAYMENT` | Yes (safe) | Event marked `failed`; no Payment created |
| `INVOICE_NOT_PAYABLE` | Yes (safe) | Session `failed`; replay after fix may succeed once |
| `INVALID_SIGNATURE` | Yes | Event `ignored`; fix secret + Stripe retry (new event id) |
| Duplicate `providerEventId` | Yes | Same event row; processor idempotent |

---

## 8. Verification

```bash
cd server && npm run test:payment-gateways
```

Tests: `duplicate webhook`, `duplicate provider payment id`, `replayed webhook`, `successful capture`.
