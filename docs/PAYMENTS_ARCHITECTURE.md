# Payments — Platform Architecture

**Status:** Approved — PAY0 in progress  
**Scope:** Platform-native cash application layer downstream of Invoices  
**Last updated:** 2026-06-02  
**Audience:** Engineering, product, finance platform design  

**Prerequisites (frozen):**

| Document | Scope |
|----------|-------|
| `docs/COMMERCIAL_PLATFORM_RETROSPECTIVE.md` | Catalog C0–C5 · Quotes Q0–Q9 · SO SO0–SO4 · Invoice INV0–INV3 |
| `docs/INVOICE_ARCHITECTURE.md` | Receivable lifecycle, billing allocations, payment readiness §13 |
| `docs/SALES_ORDER_ARCHITECTURE.md` | Execution + `SalesOrderInvoiceAllocation` bridge |

**Explicitly out of scope (Payments MVP):** GL/journal posting, bank reconciliation, payment gateway capture (Stripe/etc.), dunning/collections automation, payroll, tax remittance, inventory/COGS.

---

## 1. Executive summary

The **Payments** module is Arivu's **cash authority layer**: it records money received from (or returned to) customers and applies it to open receivables **without mutating commercial snapshots**.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Commercial layer (FROZEN)                                      │
│  Catalog → Quote → Sales Order → Invoice (+ Credit Note)        │
│  Billing authority: SalesOrderInvoiceAllocation                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ receivable balance only
┌────────────────────────────▼────────────────────────────────────┐
│  Payments layer (THIS DOCUMENT)                                 │
│  Payment → PaymentAllocation → Refund → Payment Reversal        │
│  Cash authority: PaymentAllocation                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ events only (future)
┌────────────────────────────▼────────────────────────────────────┐
│  GL / Bank / Gateway (later)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Core flow:**

```text
Invoice (Posted, amountDue > 0)
  → Payment (cash in)
    → PaymentAllocation (apply to invoice / line)
      → Invoice rollups (amountPaid ↑, amountDue ↓)
        → Refund (cash out, optional)
          → Payment Reversal (undo allocation — audit-safe)
```

**Design principles (locked):**

| Principle | Rule |
|-----------|------|
| **Allocation-aware** | Every apply/unapply is a row in `PaymentAllocation` (or `RefundAllocation`); never header-only mutation |
| **Invoice-centric** | Payments exist to settle `Invoice.amountDue`; SO/Quote are never payment targets |
| **Audit-safe** | Append-only history; reversals mark rows `reversed`, never delete |
| **Immutable payment history** | `Payment` / `Refund` headers are never hard-deleted after record |
| **Multi-invoice capable** | One payment → many allocation rows across invoices (same customer/org) |
| **Multi-currency ready** | Payment currency + `exchangeRateSnapshot` at apply time; invoice currency is settlement target |
| **Platform-wide reusable** | `moduleKey: payments`, `appKey: platform` — not Sales-app-only |

**Hard constraints (non-negotiable):**

1. Payments **must never** mutate invoice line snapshots, quantities, pricing, discounts, taxes, or sections.
2. **Posted invoices** remain commercially immutable — payments only adjust receivable rollups.
3. **`SalesOrderInvoiceAllocation`** remains the **billing authority** — payments do not create, edit, or reverse billing allocations.
4. **`PaymentAllocation`** is the **cash authority** — invoice `amountPaid` / `amountDue` derive only from active payment allocations (+ write-offs + credit note effects on `amountDue`).

---

## 2. Position in the commerce chain

### 2.1 Full lineage (billing + cash)

```text
Quote.quoteLineId
  → SalesOrderLine.sourceQuoteLineId
    → SalesOrderInvoiceAllocation          ← BILLING AUTHORITY (frozen)
      → InvoiceLine.sourceSalesOrderLineId
        → InvoiceLine.sourceInvoiceLineId  ← credit notes
          → PaymentAllocation.invoiceLineId ← CASH AUTHORITY (optional line grain)
            → PaymentAllocation.invoiceId   ← CASH AUTHORITY (default header grain)
              → Payment.paymentId
                → Refund.refundId (optional)
                  → PaymentReversal (allocation status → reversed)
```

### 2.2 Authority separation

| Concern | Authority | Mutated by Payments? |
|---------|-----------|----------------------|
| What was billed (qty, price, tax) | Invoice commercial snapshots | **No** |
| SO execution ↔ invoice billing | `SalesOrderInvoiceAllocation` | **No** |
| Customer receivable balance | `Invoice.amountDue`, `amountPaid`, `writeOffTotal` | **Yes** (rollup only) |
| Cash applied to receivable | `PaymentAllocation` | **Yes** |
| Bad debt closure | `InvoiceWriteOff` (collections) | **No** (separate service; coordinated rollup) |

### 2.3 Receivable balance formula

For **`invoiceType: standard`** Posted invoices:

```text
amountDue = grandTotal - amountPaid - writeOffTotal
```

Where:

| Field | Source |
|-------|--------|
| `grandTotal` | Frozen at Post — `invoiceTotalsService` |
| `amountPaid` | Σ active `PaymentAllocation.amountApplied` (invoice currency) |
| `writeOffTotal` | Σ active `InvoiceWriteOff.amount` (collections module) |

**Credit note effect on source invoice:** Posting a credit note **reduces source invoice `amountDue`** directly (implemented INV3) — independent of payments. Payments apply to the **net** receivable after credits.

**Credit note documents (`invoiceType: credit_note`):** Negative receivable; not a payment target in PAY0. Refunds/overpayments handled via `CustomerCreditBalance` (see §8).

---

## 3. Architectural principles (locked)

| # | Principle | Payments rule |
|---|-----------|---------------|
| 1 | **Server authority** | Rollups computed in `paymentAllocationService` / `invoicePaymentRollupService` — client never sends authoritative `amountPaid` |
| 2 | **Tenant isolation** | Every query/mutation filtered by `organizationId` |
| 3 | **Stable public UUIDs** | `paymentId`, `paymentAllocationId`, `refundId`, `refundAllocationId`, `paymentReversalId` in APIs and activity |
| 4 | **No commercial edits** | Payment services never call invoice line/section CRUD or totals recompute on Posted docs |
| 5 | **Billing untouched** | No writes to `SalesOrderInvoiceAllocation` from payment code paths |
| 6 | **Append-only audit** | `RecordActivity` + allocation row status transitions; no silent deletes |
| 7 | **Idempotent apply** | Optional `idempotencyKey` on record/apply APIs (PAY1+) |
| 8 | **Same customer scope** | Multi-invoice apply requires compatible `organizationRefId` / account (and org policy for contact match) |
| 9 | **Currency discipline** | Apply amount stored in **invoice currency** on allocation; payment header retains **payment currency** |
| 10 | **Separation of refund vs reversal** | Reversal = undo allocation (restores receivable); Refund = outbound cash event (may trigger reversal) |

---

## 4. Domain entities

### 4.1 Payment

Header for **inbound cash** (or inbound credit instrument). One payment may allocate to multiple invoices.

```javascript
// server/models/Payment.js (planned)
{
  organizationId,

  paymentId,                   // public UUID
  paymentNumber,               // PAY-0001 (auto)

  // ── Payer / scope ──
  organizationRefId,           // account (required)
  contactId,                   // optional — payer contact

  // ── Money ──
  amount,                      // total received in paymentCurrency
  paymentCurrency,             // ISO 4217
  exchangeRateSnapshot,        // to org base currency (optional reporting)
  paymentDate,                 // effective cash date
  valueDate,                   // optional bank value date

  // ── Purpose ──
  paymentPurpose,              // invoice_payment | deposit | retainer | on_account

  // ── Instrument (immutable snapshot at record) ──
  paymentInstrumentSnapshot: {
    method,                    // cash | check | bank_transfer | card | other
    referenceNumber,           // check #, txn id, etc.
    bankName,
    maskedAccount,             // e.g. ****1234 — never store full PAN/account
    provider                   // stripe | manual | other (future gateway)
  },
  externalReference,           // gateway id (future)

  // ── Allocation summary (rolled) ──
  amountAllocated,             // Σ active PaymentAllocation in payment currency
  amountUnallocated,           // amount - amountAllocated - amountRefunded
  amountRefunded,              // Σ completed Refund amounts against this payment

  // ── Lifecycle ──
  status,                      // see §9.1
  recordedAt,
  recordedBy,

  // ── Source metadata (platform pattern) ──
  sourceContext,               // manual | import | portal | api
  sourceRef,                   // { moduleKey, recordId } optional

  notes,
  customFields,

  createdBy, modifiedBy,
  deletedAt                    // soft-delete blocked after recorded — use reversal
}
```

**Rules:**

1. `amount > 0` always (refunds are separate documents).
2. Payment is **recorded** in one step (`status: recorded`) — no Draft commercial composition (unlike Invoice).
3. **`paymentPurpose`** required — classifies cash intent (see §4.1a).
4. **`paymentInstrumentSnapshot`** captured at record — immutable after `recordedAt`.
5. Optional **record without apply**: unallocated balance → `CustomerCreditBalance` (§7).
6. Payment never references SO or Quote directly — only invoices (via allocations) and account.

#### 4.1a paymentPurpose

| Value | Meaning | Default allocation behavior |
|-------|---------|----------------------------|
| **`invoice_payment`** | Settle open receivables | Auto-apply to open invoices (§4.2a) |
| **`deposit`** | Prepayment / order deposit | Record only or manual apply — not auto-applied by default |
| **`retainer`** | Retainer / recurring prepayment | Record only — apply later via manual allocation |
| **`on_account`** | General on-account receipt | Auto-apply eligible when `autoApply: true`; otherwise unallocated |

Purpose affects reporting and Customer Statement grouping (§21) — does **not** change rollup math.

### 4.2 PaymentAllocation

**Cash authority row** — links Payment to Invoice (and optionally InvoiceLine).

```javascript
// server/models/PaymentAllocation.js (planned)
{
  organizationId,

  paymentAllocationId,         // public UUID
  paymentId,                   // UUID
  paymentMongoId,              // ObjectId ref (internal)

  invoiceId,                   // UUID
  invoiceMongoId,              // ObjectId ref
  invoiceLineId,               // optional UUID — line-level apply

  // ── Applied amounts ──
  amountApplied,               // in INVOICE currency (canonical for rollup)
  invoiceCurrency,
  paymentCurrency,             // denormalized from Payment
  exchangeRateSnapshot,        // paymentCurrency → invoiceCurrency at apply time

  // ── Lifecycle ──
  status,                      // active | reversed
  appliedAt,
  appliedBy,

  reversedAt,
  reversedBy,
  reversalReason,              // required when reversed
  paymentReversalId,           // link to reversal document (optional)

  // ── Idempotency ──
  idempotencyKey               // optional
}
```

**Rules:**

1. Sum of **active** `amountApplied` per `invoiceId` must not exceed invoice `amountDue` at time of apply (service validates).
2. Default apply grain: **invoice header** (`invoiceLineId: null`).
3. Line-level apply (`invoiceLineId` set): optional; sum per line must not exceed line receivable (future line balance field or prorated header due).
4. Reversal sets `status: reversed` — row retained forever.
5. **Never** updates `SalesOrderInvoiceAllocation`.

#### 4.2a Allocation policy

When a payment is recorded with **`autoApply: true`** (default for `paymentPurpose: invoice_payment`):

1. **Default sort:** open Posted standard invoices for the same `organizationRefId`, **`amountDue > 0`**, ordered by **`dueDate` ascending** (oldest due first); ties broken by `invoiceDate` ascending, then `invoiceNumber`.
2. **Apply algorithm:** walk sorted invoices; create `PaymentAllocation` rows until payment amount exhausted or no open invoices remain.
3. **Manual override:** caller may pass explicit `allocations[]` (`invoiceId`, `amountApplied`) — skips auto-sort; validated per invoice `amountDue`.
4. **`autoApply: false`** or explicit `allocations[]` — no automatic invoice selection.

Org policy hook (future): override default sort (e.g. largest balance first) — PAY0 implements **oldest due date first** only.

**Indexes (planned):**

- `{ organizationId, paymentId, status }`
- `{ organizationId, invoiceId, status }`
- `{ organizationId, paymentAllocationId }` unique

### 4.3 Refund

Header for **outbound cash** returned to customer. Always linked to a source Payment (full or partial refund).

```javascript
// server/models/Refund.js (planned)
{
  organizationId,

  refundId,                    // public UUID
  refundNumber,                // REF-0001

  paymentId,                   // source payment UUID
  paymentMongoId,

  organizationRefId,
  contactId,

  amount,                      // outbound in refundCurrency
  refundCurrency,
  exchangeRateSnapshot,

  refundDate,
  refundMethod,                // same enum as paymentMethod
  referenceNumber,

  reason,                      // enum — see §4.3a refund reason catalog
  reasonNote,

  status,                      // see §9.3

  // ── Linkage ──
  refundAllocationIds,         // optional — which invoice applications were unwound

  recordedAt, recordedBy,
  sourceContext, sourceRef,
  notes,

  createdBy, modifiedBy
}
```

**Rules:**

1. `amount <= Payment.amount - Payment.amountRefunded` (outstanding refundable on payment).
2. Refund **does not** edit Payment.amount — increments `Payment.amountRefunded` rollup.
3. Refund may optionally create **RefundAllocation** rows (mirror of payment apply) or trigger **Payment Reversal** on specific allocations (§4.4).
4. Refund alone does not restore invoice receivable — **Payment Reversal** on allocations does (§4.4, §6).

#### 4.3a Refund reason catalog (locked)

| Value | Typical use |
|-------|-------------|
| **`customer_request`** | Customer-initiated return of funds |
| **`duplicate_payment`** | Duplicate inbound payment |
| **`overpayment`** | Surplus after invoice settlement |
| **`credit_note_settlement`** | Cash refund after credit note (not a credit note substitute) |
| **`billing_error`** | Incorrect charge corrected via cash out |
| **`service_cancellation`** | Contract/service cancelled |
| **`chargeback_resolution`** | Resolved chargeback disbursement |
| **`other`** | Requires `reasonNote` |

Stored on `Refund.reason`; validated server-side via `assertValidRefundReason()`.

### 4.4 Payment Reversal

**Audit document** that reverses one or more `PaymentAllocation` rows. Restores invoice receivable rollups.

```javascript
// server/models/PaymentReversal.js (planned)
{
  organizationId,

  paymentReversalId,           // public UUID
  paymentReversalNumber,       // PRV-0001

  paymentId,
  paymentMongoId,

  refundId,                    // optional — if reversal triggered by refund
  refundMongoId,

  reversalType,                // allocation_error | nsf | chargeback | refund | admin_void | other
  reversalReason,              // required text
  reversalReasonCode,          // optional enum

  // ── Targets ──
  allocationReversals: [{
    paymentAllocationId,
    amountReversed,            // in invoice currency — must match or be ≤ original applied
  }],

  status,                      // completed | failed (PAY0: completed only)

  reversedAt,
  reversedBy,

  sourceContext,
  notes
}
```

**Refund vs Reversal:**

| Concept | Meaning | Cash movement | Receivable effect |
|---------|---------|---------------|-----------------|
| **Payment Reversal** | Undo allocation(s) | None by itself | `amountPaid` ↓, `amountDue` ↑ |
| **Refund** | Return money to customer | Outbound cash | Requires linked reversal (or auto-creates reversals) to restore receivable |

**Typical flows:**

```text
A) Admin error (no cash movement):
   PaymentReversal → allocations reversed → invoice amountDue restored

B) Customer refund (cash out):
   Refund created → PaymentReversal on allocations → Refund completed → payment.amountRefunded ↑

C) NSF / chargeback:
   PaymentReversal (type nsf | chargeback) → optional Refund skipped if bank clawback
```

**Rules:**

1. Reversal is **append-only** — never delete `PaymentAllocation`; set `status: reversed`.
2. One reversal may target multiple allocations (e.g. undo entire multi-invoice payment).
3. Partial reversal: reverse subset of `amountApplied` — PAY1 may require split allocation rows; PAY0 recommends **full allocation reversal only** (partial = reverse + re-apply smaller amount).
4. Invoice Void (commercial) requires **all active payment allocations reversed first** (existing invoice rule).

### 4.5 RefundAllocation (PAY1)

Mirror of `PaymentAllocation` for audit when refund unwinds specific invoice applications:

```javascript
{
  refundAllocationId,
  refundId,
  paymentAllocationId,         // reversed target
  invoiceId,
  amountReversed,              // invoice currency
  status                       // active | void
}
```

PAY1 ships `RefundAllocation` as the audit mirror when refund unwinds invoice applications.

**PAY0 rule:** Record overpayment as `Payment.amountUnallocated > 0`; block auto-apply to future invoices until PAY2.

**PAY2:** Unallocated surplus materializes as **`CustomerCreditBalance`**; every invoice reduction via **`CustomerCreditApplication`** only.

### 4.6a CustomerCreditApplication (PAY2 — credit authority)

Tracks every application of customer credit to an invoice. **Credit balances MUST NOT decrease without either a `CustomerCreditApplication` (apply to invoice) or an audited cash-out path (refund of unallocated surplus).**

```javascript
// server/models/CustomerCreditApplication.js
{
  organizationId,
  customerCreditApplicationId,   // public UUID

  customerCreditBalanceId,
  customerCreditBalanceMongoId,

  invoiceId,                     // UUID
  invoiceMongoId,

  amountApplied,                 // invoice currency
  invoiceCurrency,

  status,                        // active | reversed
  appliedAt,
  appliedBy,

  reversedAt,
  reversedBy,
  reversalReason
}
```

**Flow:**

```text
CustomerCreditBalance
  → CustomerCreditApplication
    → Invoice.creditAppliedTotal ↑, Invoice.amountDue ↓
```

**Rules:**

1. **`CustomerCreditApplication` is the credit authority** — sole source of `Invoice.creditAppliedTotal` rollups (parallel to `PaymentAllocation` → `amountPaid`).
2. Never mutate invoice commercial snapshots.
3. Never write `SalesOrderInvoiceAllocation`.
4. `amountApplied <= CustomerCreditBalance.amountRemaining` at apply time.
5. `amountApplied <= Invoice.amountDue` at apply time.
6. Reversal sets `status: reversed`; restores balance `amountRemaining`; recalculates invoice rollups.
7. Same `organizationRefId` + `currency` scope as payment multi-apply.

**Invoice receivable formula (PAY2):**

```text
amountDue = grandTotal - amountPaid - writeOffTotal - creditAppliedTotal
```

(`creditAppliedTotal` = Σ active `CustomerCreditApplication.amountApplied`)

### 4.6 CustomerCreditBalance (overpayment)

When `Payment.amount > Σ allocations`, unallocated surplus becomes **customer credit** (not invoice over-application).

```javascript
// server/models/CustomerCreditBalance.js (planned — PAY1 minimum)
{
  organizationId,
  customerCreditBalanceId,

  organizationRefId,
  contactId,

  sourcePaymentId,             // payment that created surplus
  amount,                      // credit in currency
  currency,
  amountRemaining,

  status,                      // active | fully_applied | expired | void
  expiresAt,                   // org policy (optional)

  // ── Rollups ──
  amountAppliedTotal,          // Σ active CustomerCreditApplication
}
```

**PAY2:** Auto-materialize from `Payment.amountUnallocated > 0` via `customerCreditBalanceService.syncFromPayment()`.

### 4.7 InvoiceWriteOff (collections coordination)

Defined in Invoice architecture; payments **coordinate** but do not implement write-off logic.

```javascript
// server/models/InvoiceWriteOff.js (planned — collections phase)
{
  organizationId,
  invoiceWriteOffId,
  invoiceId,
  amount,
  reason,
  reasonNote,
  status,                      // pending | approved | active | reversed
  writtenOffAt,
  approvedBy
}
```

Payments read `writeOffTotal` rollup when computing `amountDue` and `paymentStatus`.

---

## 5. Credit Note interaction

Credit notes are **`invoiceType: credit_note`** documents (INV3 — frozen). Payments interact **only via receivable rollups** on the source invoice.

### 5.1 Source invoice after credit note Post

| Event | Source invoice effect | Payment layer |
|-------|----------------------|---------------|
| Credit note Posted | `amountDue` reduced by credited amount | No payment rows created |
| Payment applied | `amountPaid` ↑, `amountDue` ↓ | `PaymentAllocation` rows |
| Both | Net collectible = `grandTotal - credits - amountPaid - writeOffTotal` | Validate apply against **current** `amountDue` |

### 5.2 Rules

1. **Cannot pay a credit note document** — credit notes are not payment targets in PAY0.
2. **Apply payment after credit** — max apply = current `amountDue` (already net of credits).
3. **Credit note does not reverse billing allocations** — uses `credit_reversal` allocation type (frozen INV3); payments must not touch those rows.
4. **Refund after credit** — if customer paid before credit, reversal restores `amountPaid`; credit already reduced `amountDue` — finance may issue Refund for cash out; no double-count.
5. **Partial credit + partial pay** — supported; rollups are independent dimensions on same invoice.

### 5.3 Activity cross-links

| Event | Invoice activity | Payment activity |
|-------|------------------|------------------|
| Credit note posted | `credit_note_posted`, `invoice_credited` | — |
| Payment applied | `payment_applied` (mirror on invoice) | `payment_recorded`, `payment_allocated` |
| Refund after pay+credit | `payment_reversed` (mirror) | `refund_issued` |

---

## 6. Write-off interaction

Write-offs are **non-cash** receivable reductions (collections). Orthogonal to payments but shares `amountDue` formula.

### 6.1 Formula interaction

```text
amountDue = grandTotal - amountPaid - writeOffTotal
```

| Scenario | amountPaid | writeOffTotal | amountDue | paymentStatus |
|----------|------------|---------------|-----------|---------------|
| Open invoice | 0 | 0 | grandTotal | unpaid |
| Partial pay | 500 | 0 | grandTotal - 500 | partially_paid |
| Partial pay + write-off | 500 | 200 | grandTotal - 700 | partially_paid or paid |
| Full write-off | 0 | grandTotal | 0 | written_off |
| Paid then write-off remainder | 800 | 200 | 0 | paid |

### 6.2 Rules

1. Write-off allowed when `status` is Posted (or Partially Paid) and `amountDue > 0` after payments.
2. Write-off **does not** reverse `SalesOrderInvoiceAllocation` — execution already billed.
3. Write-off **does not** mutate payment allocations — if customer paid $500 and $200 is written off, allocations stay active.
4. **`paymentStatus: written_off`** when `amountDue === 0` and `writeOffTotal > 0` (even if `amountPaid < grandTotal`).
5. Invoice **`status: Written Off`** is a lifecycle transition (collections) — may coexist with `Partially Paid` history in activity.
6. Reversing write-off (collections) increases `amountDue` — does not auto-reverse payments.

### 6.3 Payment apply guard

```text
maxApply = amountDue   // already net of writeOffTotal
```

Service rejects allocation if `amountApplied > amountDue`.

---

## 7. Overpayment handling

### 7.1 Definition

**Overpayment** = `Payment.amount` exceeds sum of allocations at record/apply time.

### 7.2 PAY0 behavior

| Case | Handling |
|------|----------|
| Apply exceeds invoice `amountDue` | **Reject** — validation error |
| Payment amount > total allocated | **Allow** — set `Payment.amountUnallocated` |
| Unallocated balance | Display on payment; **no auto-apply** to other invoices in PAY0 unless user explicitly multi-allocates in same request |
| Surplus after full allocate | `CustomerCreditBalance` stub — record intent; full apply-to-future-invoices in PAY2 |

### 7.3 Multi-invoice same payment

```text
Payment $10,000
  → PaymentAllocation $6,000 → Invoice A
  → PaymentAllocation $3,000 → Invoice B
  → amountUnallocated $1,000 → CustomerCreditBalance (PAY1+)
```

**Constraints:**

- Same `organizationRefId` (account) across all target invoices.
- Each invoice must be Posted, `invoiceType: standard`, `amountDue > 0`.
- Org policy may require same `currency` or allow cross-currency with explicit rate snapshot.

### 7.4 Overpayment vs credit note

| Mechanism | Direction | Document |
|-----------|-----------|----------|
| Credit note | Reduces billed amount (commercial correction) | `invoiceType: credit_note` |
| Overpayment | Customer paid more than due | `CustomerCreditBalance` |
| Refund | Return cash to customer | `Refund` + `PaymentReversal` |

Never use payment allocation to simulate a credit note.

---

## 8. Multi-currency

### 8.1 Currencies in play

| Layer | Currency field |
|-------|----------------|
| Invoice | `Invoice.currency` (frozen at Post) |
| Payment | `Payment.paymentCurrency` |
| Allocation | `amountApplied` stored in **invoice currency** |

### 8.2 Exchange rate snapshot

At apply time:

```javascript
exchangeRateSnapshot: {
  from: paymentCurrency,
  to: invoiceCurrency,
  rate: Number,                // multiply payment amount by rate → invoice amount
  asOfDate: Date,
  source: 'manual' | 'org_table' | 'provider'  // provider = future
}
```

### 8.3 Rules

1. Same-currency apply: `exchangeRateSnapshot.rate = 1`.
2. Cross-currency apply: user confirms rate; allocation stores invoice-currency `amountApplied`.
3. Payment header `amount` remains in `paymentCurrency`; `amountAllocated` rolled in payment currency for payment-level balance.
4. Invoice rollups always in **invoice currency**.
5. Refunds use refund currency with parallel snapshot rules.

### 8.4 Org base currency (reporting)

Optional `exchangeRateToOrgBase` on Payment for analytics — does not affect invoice rollups.

---

## 9. Payment status lifecycle

### 9.1 Payment.status

| Status | Meaning |
|--------|---------|
| **recorded** | Payment captured; may have zero or partial allocations |
| **partially_allocated** | `0 < amountAllocated < amount` |
| **fully_allocated** | `amountAllocated === amount` (within tolerance) |
| **partially_refunded** | `amountRefunded > 0` and `< amount` |
| **fully_refunded** | `amountRefunded === amount` |
| **reversed** | All allocations reversed; payment net effect zero |

**Transitions:**

```text
recorded → partially_allocated → fully_allocated
fully_allocated → partially_refunded → fully_refunded
any → reversed (when all allocations reversed and no net cash effect)
```

### 9.2 PaymentAllocation.status

| Status | Meaning |
|--------|---------|
| **active** | Contributes to `Invoice.amountPaid` |
| **reversed** | Excluded from rollups; audit retained |

No other statuses in PAY0.

### 9.3 Refund.status

| Status | Meaning |
|--------|---------|
| **pending** | Created; reversals not yet committed |
| **completed** | Cash out confirmed; `Payment.amountRefunded` updated |
| **failed** | Outbound failed — reversal may be rolled back (PAY1) |
| **void** | Cancelled before completion |

### 9.4 Invoice.paymentStatus (rollup — invoice module field)

| Value | Condition |
|-------|-----------|
| **unpaid** | `amountPaid === 0` and `writeOffTotal === 0` |
| **partially_paid** | `0 < amountPaid < grandTotal - writeOffTotal` OR partial pay with remaining due |
| **paid** | `amountDue === 0` and `amountPaid > 0` |
| **written_off** | `amountDue === 0` and `writeOffTotal > 0` and pay+writeoff closed balance |

### 9.5 Invoice.status (lifecycle — payment-driven transitions)

Payment module **may transition** invoice `status` when receivable closes:

```text
Posted → Partially Paid    (first active allocation)
Partially Paid → Paid      (amountDue === 0 via payments)
Posted → Paid              (single full payment)
Partially Paid → Written Off
Posted → Written Off       (write-off closes without full pay)
```

**Does not transition:** Draft, Void, credit note documents.

**Partially Posted:** Reserved GL state — payments ignore.

### 9.6 Void interaction (invoice — frozen)

| Invoice action | Payment precondition |
|----------------|---------------------|
| Void Posted invoice | **All** active `PaymentAllocation` rows reversed |
| Delete Draft invoice | No payments allowed (invoice not Posted) |

---

## 10. Invoice payment rollups

### 10.1 Service ownership

| Service | Responsibility |
|---------|----------------|
| `paymentAllocationService` | CRUD allocations, validate apply, reverse |
| `invoicePaymentRollupService` | Recompute `amountPaid`, `amountDue`, `paymentStatus`, `lastPaymentAt`; optional `status` transition |
| `paymentRollupService` | Recompute `Payment.amountAllocated`, `amountUnallocated`, `amountRefunded`, `Payment.status` |

**Trigger points:**

- Payment recorded with allocations
- Allocation added / reversed
- Refund completed (via reversal)
- Write-off posted (collections — recalc `amountDue` only)
- Credit note posted on source invoice (invoice module — recalc `amountDue` only)

### 10.2 Rollup algorithm (invoice)

```javascript
// pseudocode — invoicePaymentRollupService
const active = await PaymentAllocation.find({
  organizationId, invoiceId, status: 'active'
});

const amountPaid = sum(active.map(a => a.amountApplied));
const amountDue = roundMoney(invoice.grandTotal - amountPaid - invoice.writeOffTotal);
// credit note effects on amountDue already applied on CN post — do not double-subtract

invoice.amountPaid = amountPaid;
invoice.amountDue = max(0, amountDue);  // policy: floor at 0 for standard invoices
invoice.lastPaymentAt = max(active.map(a => a.appliedAt));
invoice.paymentStatus = derivePaymentStatus(invoice);
invoice.status = maybeTransitionLifecycleStatus(invoice);
```

### 10.3 Invariants (enforced in tests)

1. `amountPaid === Σ active PaymentAllocation.amountApplied` (invoice currency).
2. `amountDue === grandTotal - amountPaid - writeOffTotal` (± rounding tolerance).
3. No active allocation on Void or Draft invoices.
4. No allocation on `invoiceType: credit_note`.
5. Billing allocations unchanged after payment operations.

### 10.4 Rounding

Use org `moneyPrecision` (default 2) — banker's rounding consistent with `invoiceTotalsService`.

---

## 11. Activity and audit model

### 11.1 Services

| Service | Module | Storage |
|---------|--------|---------|
| `paymentActivityService` | `payments` | `RecordActivity` |
| `invoiceActivityService` | `invoices` | Mirror payment events on invoice |
| `refundActivityService` | `payments` | Refund events |

Pattern mirrors `invoiceActivityService` / `salesOrderActivityService` (frozen).

### 11.2 Mandatory payment events

| Category | Actions |
|----------|---------|
| Payment lifecycle | `payment_created`, `payment_recorded`, `payment_updated` (notes only) |
| Allocation | `payment_allocated`, `payment_allocation_reversed` |
| Invoice mirror | `payment_applied`, `payment_reversed` (on invoice record) |
| Refund | `refund_created`, `refund_completed`, `refund_voided` |
| Reversal | `payment_reversal_completed` |
| Overpayment | `customer_credit_created` (PAY1+) |
| Write-off mirror | `invoice_written_off` (on invoice — collections owns trigger) |

### 11.3 Audit payload requirements

Every allocation and reversal event **must** include in `details`:

```javascript
{
  paymentId,
  paymentAllocationId,
  invoiceId,
  invoiceNumber,
  amountApplied,
  currency,
  paymentReversalId,           // when reversed
  reversalReason,              // required on reverse
  snapshot: {
    invoiceAmountDueBefore,
    invoiceAmountDueAfter,
    invoiceAmountPaidBefore,
    invoiceAmountPaidAfter
  }
}
```

### 11.4 Audit rules

1. User-attributed (`author`, `organizationId`).
2. **Append-only** — no mutation of historical `RecordActivity` rows.
3. Posted invoice commercial totals in snapshot — **not** line-level commercial fields.
4. Exportable via platform audit export (future).
5. Payment module owns payment record activity; invoice module receives mirrored events for unified invoice timeline.

### 11.5 Permissions (planned)

| Permission | Action |
|------------|--------|
| `payments.view` | List/read payments, allocations |
| `payments.record` | Create payment |
| `payments.allocate` | Apply to invoice(s) |
| `payments.reverse` | Payment reversal |
| `payments.refund` | Issue refund |
| `payments.export` | Export payment history |

Invoice void remains `invoices.void` — blocked by payment preconditions.

---

## 12. Platform module registration

```javascript
// platform module definition (planned)
{
  moduleKey: 'payments',
  appKey: 'platform',
  label: 'Payments',
  entityModel: 'Payment',
  publicIdField: 'paymentId',
  capabilities: ['list', 'record', 'create', 'activity'],
  relatedModules: ['invoices', 'people']  // account/contact
}
```

**API namespace:** `/api/payments/*`

**Not in PAY0 UI scope:** Full agent UI may follow PAY1; INV4 adds invoice-side hooks first.

---

## 13. API surface (planned)

### 13.1 Payments

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments` | Record payment (+ optional allocations[]) |
| GET | `/api/payments` | List (filter by account, date, status) |
| GET | `/api/payments/:id` | Detail + allocations |
| PATCH | `/api/payments/:id` | Notes/metadata only — not amount after recorded |

### 13.2 Allocations

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments/:id/allocations` | Apply to invoice(s) |
| GET | `/api/invoices/:id/payment-allocations` | Invoice-centric view |

### 13.3 Reversals & refunds

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments/:id/reversals` | Reverse allocation(s) |
| POST | `/api/payments/:id/refunds` | Create refund (+ auto-reversal option) |
| GET | `/api/refunds/:id` | Refund detail |

### 13.4 Invoice integration (INV4 hooks)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/invoices/:id/payment-summary` | amountDue, amountPaid, allocations, refundable |
| POST | `/api/invoices/:id/apply-payment` | Shortcut: record+allocate in one call (optional) |

---

## 14. Event hooks (GL / gateway — future)

Payments **emit** domain events; subscribers implement GL/gateway later.

| Event | Payload | Subscribers (future) |
|-------|---------|----------------------|
| `payment.recorded` | paymentId, amount, currency | GL cash receipt |
| `payment.allocated` | paymentAllocationId, invoiceId | AR subledger |
| `payment.reversed` | paymentReversalId | GL reversal |
| `refund.completed` | refundId | GL cash disbursement |
| `invoice.paid` | invoiceId | Revenue recognition (GL phase) |

**PAY0:** Emit via activity + optional internal event bus stub — no GL writes.

---

## 15. Relationship to INV4 (payment readiness)

INV4 (invoice module) prepares **hooks only** — no Payment model in INV4:

| INV4 deliverable | Payments architecture alignment |
|------------------|--------------------------------|
| Rollup fields wired | §10 — `invoicePaymentRollupService` |
| Void guard | §9.6 — block until allocations reversed |
| Activity stubs | §11 — `payment_applied`, `payment_reversed` |
| `GET payment-summary` | §13.4 |

Full Payment module = **PAY0+** (separate roadmap — `docs/PAYMENTS_ROADMAP.md` TBD after approval).

---

## 16. Implementation phases (preview)

| Phase | Deliverable |
|-------|-------------|
| **INV4** | Invoice rollup service hooks, void guards, payment-summary API, activity mirror stubs |
| **PAY0** | `Payment`, `PaymentAllocation`, `PaymentReversal` models; record/apply/reverse; rollups; tests |
| **PAY1** | `Refund`, refund flow, agent list/record UI, idempotency |
| **PAY2** | `CustomerCreditBalance`, apply credit to invoices, multi-currency UI |
| **PAY3** | Gateway import (`externalReference`), portal pay (separate portal module) |

---

## 17. Locked decisions (approval checklist)

| # | Decision | Value |
|---|----------|-------|
| 1 | Billing authority | **`SalesOrderInvoiceAllocation`** — payments never write |
| 2 | Cash authority | **`PaymentAllocation`** — sole source of `amountPaid` |
| 3 | Commercial immutability | Payments never mutate invoice line/section snapshots |
| 4 | Default apply grain | **Invoice header** — line-level optional |
| 5 | Multi-invoice payment | **Yes** — same account; many allocation rows |
| 6 | Reversal semantics | Status `reversed` — never delete allocations |
| 7 | Refund vs reversal | **Refund** = cash out; **Reversal** = receivable restore |
| 8 | Overpayment | Unallocated balance → **`CustomerCreditBalance`** (PAY1+) |
| 9 | Credit notes | Reduce `amountDue` only — not payment targets |
| 10 | Write-offs | Reduce `amountDue` via `writeOffTotal` — collections owns entity |
| 11 | Cross-module IDs | UUIDs in all APIs and activity |
| 12 | Currency | Allocation amounts in **invoice currency** |
| 13 | Invoice void | Requires all payment allocations reversed first |
| 14 | Platform module | `payments` / `platform` |
| 15 | GL | Events only — no journal writes in PAY0–PAY1 |
| 16 | **paymentPurpose** | **`invoice_payment` \| `deposit` \| `retainer` \| `on_account`** |
| 17 | **Allocation policy** | Default auto-apply = **oldest `dueDate` first**; manual override supported |
| 18 | **paymentInstrumentSnapshot** | Immutable `{ method, referenceNumber, bankName, maskedAccount, provider }` at record |
| 19 | **Customer Statement** | Reporting contract only in PAY0 — no statement UI |
| 20 | **Refund reason catalog** | 8 locked values — `server/constants/refundReasons.js` |
| 21 | **Credit authority** | **`CustomerCreditApplication`** — sole source of `creditAppliedTotal` |
| 22 | **Credit balance rule** | Never reduce `amountRemaining` without application or refund audit |

---

## 18. Known limitations (PAY0)

1. No payment gateway capture — manual record only.
2. No bank reconciliation.
3. No GL posting.
4. Line-level apply may defer to PAY1 if line receivable balance not modeled.
5. Partial allocation reversal — full-row reversal only in PAY0; split rows in PAY1.
6. `CustomerCreditBalance` apply-to-invoice deferred PAY2.
7. Credit note documents cannot receive payments.
8. Events module field payment collection (`EventOrder`) — **separate legacy path**; not integrated with this platform module in PAY0.

---

## 19. Summary

| Question | Answer |
|----------|--------|
| Does payment change what was billed? | **No** — billing is frozen at invoice Post. |
| What do payments change? | **`amountPaid`, `amountDue`, `paymentStatus`** (+ optional lifecycle `status`). |
| Where is billing tracked? | **`SalesOrderInvoiceAllocation`**. |
| Where is cash tracked? | **`PaymentAllocation`**. |
| Where is on-account credit tracked? | **`CustomerCreditApplication`** → `creditAppliedTotal`. |
| How to undo cash apply? | **`PaymentReversal`** → allocation `reversed`. |
| How to return money? | **`Refund`** (+ reversal to restore receivable). |
| Overpayment? | **Unallocated balance** → customer credit (PAY1+). |
| Credit note? | Reduces **`amountDue`** on source invoice — independent of payments. |
| Write-off? | Reduces **`amountDue`** via **`writeOffTotal`** — independent of payment allocations. |

---

## 20. Customer Statement readiness

Customer Statement is a **future reporting surface** — PAY0 defines the data contract only; no statement PDF/UI in PAY0.

### 20.1 Statement line types

| Type | Source module | Statement role |
|------|---------------|----------------|
| **Invoice** | `invoices` | Debit (+) — `grandTotal` on Posted standard invoices |
| **Credit note** | `invoices` (`invoiceType: credit_note`) | Credit (−) — credited amount against source invoice |
| **Payment** | `payments` | Credit (−) — `Payment.amount` by `paymentDate` |
| **Payment allocation** | `PaymentAllocation` | Credit (−) — cash applied to invoice |
| **Customer credit application** | `CustomerCreditApplication` | Credit (−) — on-account credit applied |
| **Write-off** | `InvoiceWriteOff` (collections) | Credit (−) — non-cash balance reduction |

### 20.2 Running balance contract (future)

```text
runningBalance =
  Σ invoice debits (Posted standard)
  − Σ credit notes (Posted)
  − Σ payment allocations (active)
  − Σ customer credit applications (active)
  − Σ write-offs (active)
```

Scoped per **`organizationRefId`** + **`currency`**. Payments module supplies payment + allocation rows; invoice module supplies invoice/credit lines; collections supplies write-offs.

### 20.3 PAY2 deliverables

- `GET /api/customer-statements` — JSON statement with running balance
- `GET /api/customer-statements/export.pdf` — PDF export
- `GET /api/customer-statements/export.csv` — CSV export
- Activity: `customer_statement_generated` (append-only audit)

---

## 21. Document control

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-06-02 | Initial draft for review |
| 1.0 | 2026-06-02 | Approved — paymentPurpose, allocation policy, instrument snapshot, statement contract |
| 1.1 | 2026-06-02 | PAY0 shipped |
| 1.2 | 2026-06-02 | PAY1 — refund reason catalog, Refund/RefundAllocation, UI |
| 1.3 | 2026-06-02 | PAY2 — CustomerCreditApplication, statements |

**PAY2 complete — PAY3 (Gateway) is next.**
