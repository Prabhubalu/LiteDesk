# Invoices — Platform Architecture

**Status:** Approved — authoritative for INV0+ implementation  
**Scope:** Billing transaction module — downstream consumer of Sales Orders  
**Last updated:** 2026-06-02  
**Audience:** Engineering, product, commerce platform design  

**Prerequisites (upstream, approved or complete):**

| Document | Role |
|----------|------|
| `docs/CATALOG_ROADMAP.md` | `ItemVariant`, price books, bundles, lifecycle sellability |
| `docs/QUOTES_ROADMAP.md` + `docs/QUOTE_SECTIONS_ARCHITECTURE.md` | Snapshot commerce, sections, totals hierarchy, audit |
| `docs/SALES_ORDER_ARCHITECTURE.md` | Execution contract, fulfillment, partial invoicing contract (§11) |
| `server/models/SalesOrderInvoiceAllocation.js` | Cross-module allocation bridge (SO3 stub — schema live) |

**Explicitly out of scope for Invoice MVP (INV0–INV2):** Payment capture, GL posting, inventory ledger, tax engine service, dunning/collections automation.

---

## 1. Executive summary

The **Invoice** module is Arivu's **billing transaction layer**: the moment fulfilled (or policy-eligible) commercial execution becomes a receivable document.

| Module | Role | Commercial truth | Billing truth |
|--------|------|------------------|---------------|
| **Quote** | Proposal / negotiation | Snapshot at send & accept | None |
| **Sales Order** | Execution contract | Copied snapshots at conversion | Fulfillment qty; **invoice readiness** rollups |
| **Invoice** | Billing document | **New snapshots at invoice line create** | Allocated qty/amount; payment status (later) |
| **Credit Note** (future) | Reversal document | Negative snapshot against invoice | Allocation reversal |
| **Payment** (future) | Cash application | — | Applied to invoice balance |

**Invoice is not a Sales Order clone.** It inherits **structural patterns** (sections, bundles, totals hierarchy) and **lineage fields** from Sales Orders, but introduces its own lifecycle, allocation semantics, posting rules, and receivable status. Sales Orders do not revise; invoices do not edit fulfilled commercial snapshots after **Posted** — corrections use credit notes, reversals, or write-offs.

**Foundation inherited from upstream modules:**

- Snapshot-driven commercial fields (never live catalog after invoice line save)
- Section-aware three-tier totals (line → section → invoice)
- Bundle-aware parent/child integrity (invoice at parent grain by default)
- Allocation-aware traceability via `SalesOrderInvoiceAllocation` + stable UUIDs
- Audit-safe append-only activity and allocation history
- Activity-driven UI (server totals authority)
- Multi-currency via header `currency` + `exchangeRateSnapshot` + line snapshots

---

## 2. Position in the commerce chain

```text
┌─────────────────────────────────────────────────────────────────┐
│  Catalog (C0–C5): ItemVariant · PriceBooks · Bundles          │
└────────────────────────────┬────────────────────────────────────┘
                             │ resolve at quote/SO line-add only
┌────────────────────────────▼────────────────────────────────────┐
│  Quote: proposal · portal accept · sections · revisions         │
└────────────────────────────┬────────────────────────────────────┘
                             │ convert
┌────────────────────────────▼────────────────────────────────────┐
│  Sales Order: fulfillment · split/merge · invoice readiness     │
│               SalesOrderInvoiceAllocation (allocation bridge)    │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoice (this module)
┌────────────────────────────▼────────────────────────────────────┐
│  Invoice · Credit Note (future) · Payment (future) · GL (later) │
└─────────────────────────────────────────────────────────────────┘
```

**Traceability requirement (day one):** Cross-module contracts use **stable public UUIDs**, not Mongo `_id`:

| Layer | Public id | Mongo `_id` |
|-------|-----------|-------------|
| Quote | `quoteLineId`, `quoteSectionId` | internal only |
| Sales Order | `salesOrderId`, `salesOrderLineId`, `salesOrderSectionId` | internal only |
| Invoice | `invoiceId`, `invoiceLineId`, `invoiceSectionId` | internal only |
| Allocation bridge | `salesOrderInvoiceAllocationId` | internal only |

**Full lineage chain (locked):**

```text
Quote.quoteLineId
  → SalesOrderLine.sourceQuoteLineId
    → SalesOrderInvoiceAllocation.salesOrderLineId
      → InvoiceLine.sourceSalesOrderLineId
        → (future) CreditNoteLine.sourceInvoiceLineId
          → (future) PaymentAllocation.invoiceLineId
```

Every invoice line sourced from a sales order MUST retain: `sourceSalesOrderLineId`, `sourceSalesOrderId`, `sourceQuoteLineId` (denormalized), and `salesOrderInvoiceAllocationId` when posted.

---

## 3. Architectural principles (locked for review)

| Principle | Invoice rule |
|-----------|--------------|
| **Snapshot-driven** | Invoice lines store commercial snapshots at create; never re-resolve catalog for totals |
| **Allocation-aware** | Every SO-sourced qty/amount on an invoice MUST create/update `SalesOrderInvoiceAllocation` |
| **Audit-safe** | Append-only activity; allocation `reversed` not deleted; no hard-delete of Posted invoices |
| **Partial-invoicing capable** | Multiple invoices per SO; partial qty per line; section milestone billing |
| **Multi-invoice capable** | One invoice may aggregate lines from multiple SOs (same customer context) |
| **Multi-currency** | Header currency + rate snapshot; lines store `currencySnapshot` + `exchangeRateSnapshot` |
| **Workflow-driven** | Draft → review/approval → Posted; org-configurable gates (mirror Quotes approvals pattern) |
| **Platform-wide reusable** | `moduleKey: invoices` — not Sales-app-only; Helpdesk/FSM may bill against SO |
| **Bill-on-fulfill default** | Billable base = fulfilled qty minus cancelled (org policy override documented in §10) |
| **Server authority** | Totals, allocation rollups, and SO `invoiceStatus` updated only in invoice services |
| **Multi-tenant** | Strict `organizationId` on every collection and query |
| **No invoice revisions (INV0)** | Corrections via credit note or cancel-before-post; amendment flows later |

**Forbidden:** Editing Posted invoice line unit prices without credit note; deleting active allocations; invoicing beyond SO remaining billable qty without override permission + audit.

---

## 4. What Invoice IS and IS NOT

### 4.1 Invoice IS

- The **billing document** for receivables
- The **allocation consumer** of `SalesOrderInvoiceAllocation`
- A **platform module** (`moduleKey: invoices`) for any app that executes SOs
- The **source of truth** for `amountDue`, tax presented to customer, and (future) payment balance
- A **workflow artifact** (draft, approval, post, void)

### 4.2 Invoice IS NOT

- A sales order or quote (no fulfillment fields on invoice lines)
- A payment or GL journal
- A live tax calculation engine (MVP uses snapshots + org tax tables JSON)
- An inventory movement
- A substitute for credit notes when reducing receivables

---

## 5. Domain model

### 5.1 `Invoice` (header)

First-class MongoDB document. Auto-number per org via Module Numbering (`Settings → Automation → Module Numbering`): default `INV-{SEQ}` (credit notes use separate `CN-{SEQ}` sequence).

```javascript
// server/models/Invoice.js (planned)
{
  organizationId,              // required, indexed

  invoiceId,                   // String UUID — stable public id
  invoiceNumber,               // human number INV-0001 — unique per org

  invoiceTitle,                // optional display label
  invoiceType,                 // 'standard' | 'credit_note' | 'debit_note' | 'proforma' (future)
  status,                      // see §6 lifecycle

  // ── Dates ──
  invoiceDate,
  dueDate,
  postedAt,                    // set on Post
  voidedAt,

  currency,
  exchangeRateSnapshot,        // header FX at invoice create

  // ── Customer / commercial context (snapshots from SO or manual entry) ──
  customerId,
  contactId,
  organizationRefId,           // account
  dealId,
  caseId,
  ownerId,

  billToAddressSnapshot,
  shipToAddressSnapshot,
  paymentTermsSnapshot,
  incotermsSnapshot,
  termsConditionsSnapshot,

  // ── Totals (invoiceTotalsService — persisted) ──
  subtotal,
  lineDiscountTotal,
  sectionDiscountTotal,
  globalDiscountType,
  globalDiscountValue,
  globalDiscountAmount,
  globalDiscountTotal,
  taxTotal,
  adjustmentTotal,
  grandTotal,

  amountPaid,                  // future — rolled from PaymentAllocation
  amountDue,                   // grandTotal - amountPaid - writeOffTotal
  writeOffTotal,               // future — rolled from write-off records

  // ── Source / lineage ──
  sourceType,                  // 'sales_order' | 'manual' | 'credit_note' | 'merge'
  sourceSalesOrderIds,         // ObjectId[] — primary SO(s) billed
  sourceInvoiceId,             // credit note → original invoice UUID

  // ── Platform source metadata (analytics + automation) ──
  sourceContext,               // String — e.g. 'manual' | 'sales_order_wizard' | 'api'
  sourceRef,                   // Mixed — { moduleKey, recordId } stable public ref

  // ── Workflow ──
  approvalRequired,
  approvalStatus,              // none | pending | approved | rejected
  approvalLocked,

  // ── Payment readiness (future fields — schema-ready INV0) ──
  paymentStatus,               // unpaid | partially_paid | paid | written_off
  lastPaymentAt,

  createdBy, modifiedBy,
  deletedAt, deletedBy, deletionReason,
  customFields
}
```

**Rules:**

1. `invoiceNumber` assigned on create (or on Post — org policy; default: on create in Draft).
2. `amountDue` defaults to `grandTotal` on Post; payments reduce it later.
3. Proforma invoices (future) do not write allocations or affect SO rollups.

---

### 5.2 `InvoiceSection`

Parallel to `SalesOrderSection` / `QuoteSection`. Created when invoicing from SO sections or manually on standalone invoices.

```javascript
{
  organizationId,
  invoiceId,                   // ObjectId → Invoice
  invoiceSectionId,            // String UUID

  sectionTitle, sectionDescription, sectionOrder,
  sectionType,                 // 'standard' | 'optional' | 'future'
  includeInInvoiceTotal,         // default true except optional off

  // Section discount inputs (copied from SO when section fully invoiced; manual entry otherwise)
  sectionDiscountType, sectionDiscountValue, sectionDiscountAmount,

  // Persisted computed totals (invoiceTotalsService)
  sectionSubtotal, sectionLineDiscountTotal, sectionDiscountTotal,
  sectionTaxTotal, sectionTotal,

  showSectionTotal, hiddenSection,

  // ── Source lineage ──
  sourceSalesOrderSectionId,   // salesOrderSectionId UUID
  sourceSalesOrderId,
  sourceQuoteSectionId,        // denormalized traceability

  lockedSnapshot               // true after invoice Posted
}
```

**Rules:**

1. Every invoice line references `invoiceSectionId` (auto **General** section if none).
2. Bundle parent + all invoiced children share the same `invoiceSectionId`.
3. Section totals recomputed from invoice lines — never copied verbatim from SO section totals.
4. **Section milestone invoicing:** when billing a fulfilled section, create one invoice section mapped from SO section; allocate all eligible lines in that section in one transaction.

---

### 5.3 `InvoiceLine`

First-class entity — not embedded on header. Stable `invoiceLineId` (UUID).

```javascript
{
  organizationId,
  invoiceId,
  invoiceLineId,               // String UUID

  invoiceSectionId,            // ObjectId → InvoiceSection

  variantId,                   // catalog ref (identity only post-snapshot)
  lineType,                    // standard | bundle_parent | bundle_component | adjustment | deposit | write_off
  lineOrder,

  parentBundleLineId,          // ObjectId → InvoiceLine (bundle children)

  // ── Quantity (billing) ──
  quantity,                    // invoiced qty (≤ SO remaining billable unless override)
  unitOfMeasure,

  // ── Pricing snapshots (copied from SO line or manual resolve once) ──
  unitPriceSnapshot, listPriceSnapshot,
  pricingSourceSnapshot, priceBookIdSnapshot, priceBookNameSnapshot,
  priceBookEntryIdSnapshot, pricingAsOfDateSnapshot,
  discountType, discountValue, discountAmount,
  taxSnapshot,                 // Mixed JSON — see §9

  lineSubtotal, lineTaxTotal, lineTotal,

  currencySnapshot, exchangeRateSnapshot,
  skuSnapshot, itemNameSnapshot, descriptionSnapshot,
  attributesSnapshot, bundleSnapshot,

  optionalLine, hiddenLine,

  // ── Source lineage (required when sourceType = sales_order) ──
  sourceSalesOrderLineId,
  sourceSalesOrderId,
  sourceSalesOrderSectionId,
  sourceQuoteLineId,
  sourceQuoteId,
  salesOrderInvoiceAllocationId,  // set on Post — links to bridge row

  // ── Credit / write-off readiness (future) ──
  quantityCredited,            // rolled from credit note allocations
  quantityWrittenOff,
  amountWrittenOff,

  lockedSnapshot                 // true after invoice Posted
}
```

**Bundle invoicing (locked — see §8):**

| Rule | Behavior |
|------|----------|
| Default grain | Invoice **bundle_parent** only; components `hiddenLine: true` on invoice |
| Rollup mode | Parent line qty/price reflects bundle; children not separately billable |
| Fixed mode | Parent + visible children each invoiced with preserved bundleSnapshot |
| Partial bundle qty | Invoiced qty applies to parent; children scale proportionally (same as SO fulfillment grain) |
| Allocation | One `SalesOrderInvoiceAllocation` per **invoiced SO line row** (parent or each visible child per mode) |

---

### 5.4 `InvoiceAllocation` (logical entity — implemented as bridge + rollups)

**Naming clarification:** The authoritative cross-module allocation record is **`SalesOrderInvoiceAllocation`** (SO3 — already in codebase). In invoice domain language this is the **InvoiceAllocation** bridge: it binds SO execution lines to invoice billing lines.

```javascript
// server/models/SalesOrderInvoiceAllocation.js (existing — canonical)
{
  organizationId,
  salesOrderId,                // ObjectId
  salesOrderLineId,            // String UUID

  sourceQuoteLineId,           // denormalized

  invoiceId,                   // ObjectId → Invoice (set on Post)
  invoiceLineId,               // String UUID (set on Post)

  salesOrderInvoiceAllocationId,

  quantityAllocated,
  amountAllocated,
  taxAmountAllocated,

  allocationType,              // 'standard' | 'progress' | 'milestone' | 'deposit'
  status,                      // 'active' | 'reversed'

  allocatedAt, allocatedBy,
  reversedAt, reversalReason
}
```

**Invoice-side mirror (denormalized on `InvoiceLine`):** `salesOrderInvoiceAllocationId`, `sourceSalesOrderLineId`.

**Future `PaymentAllocation` (payment readiness — not INV0):**

```javascript
// planned — links Payment to Invoice; does not replace SalesOrderInvoiceAllocation
{
  organizationId,
  paymentId,
  invoiceId,
  invoiceLineId,               // optional — line-level apply
  paymentAllocationId,

  amountApplied,
  currency,
  exchangeRateSnapshot,

  status,                      // active | reversed
  appliedAt, appliedBy
}
```

**Rules:**

1. Creating a Posted invoice from SO **must** insert active allocations and roll up SO line `quantityInvoiced`.
2. Voiding/reversing an invoice **must** mark allocations `reversed` (not delete) and roll back SO quantities.
3. Sum of active `quantityAllocated` per `salesOrderLineId` must never exceed billable qty for that line (policy + override audit).
4. `allocationType: 'deposit'` — header-level deposit lines without SKU; still writes allocation row with `salesOrderLineId` null and SO header ref (SO deposit contract — SO3 stub).

---

## 6. Invoice status lifecycle

### 6.1 Header statuses

| Status | Meaning | Editable | Allocations |
|--------|---------|----------|-------------|
| **Draft** | Composing invoice lines | Yes (lines, sections, discounts) | None |
| **Pending Approval** | Submitted for workflow | Limited (withdraw to Draft) | None |
| **Approved** | Workflow cleared; ready to post | Limited | None |
| **Posted** | Receivable document issued | No commercial edits | **Active** allocations written |
| **Partially Posted** | *Reserved future state* — partial GL/revenue recognition (not INV0) | No commercial edits | Active (partial recognition — future) |
| **Partially Paid** | Future — payment applied | No | Active |
| **Paid** | Future — fully applied | No | Active |
| **Void** | Cancelled before payment completion | No | Allocations **reversed** |
| **Written Off** | Future — bad debt closure | No | May coexist with partial payment |

**Default transitions:**

```text
Draft → Pending Approval → Approved → Posted → Partially Paid → Paid
Draft → Posted                    (when approval not required)
Posted → Void                     (before material payment; manager override if paid)
Posted → Written Off              (future — collections)
Posted → Partially Posted         (reserved — documentation only; no INV0 implementation)
Partially Posted → Posted           (reserved — close partial recognition; future)
```

> **`Partially Posted` (reserved):** Documented for future partial revenue/GL recognition workflows. Not implemented in INV0–INV2. No API transitions, permissions, or UI until a dedicated phase. Included in lifecycle enum for forward compatibility only.

**Partial invoice handling (SO perspective — unchanged):**

- SO `invoiceStatus`: `not_invoiced` | `partially_invoiced` | `fully_invoiced` (existing SO3 rollup).
- Multiple Posted invoices per SO are **expected** until `fully_invoiced`.
- Invoice header has its own lifecycle — independent of SO fulfillment status except bill-on-fulfill gates.

### 6.2 Cancellation rules

| Action | Allowed when | Effect |
|--------|--------------|--------|
| **Delete Draft** | `status === Draft` | Hard delete invoice + lines + sections |
| **Void Posted** | Posted; payments reversible or none | Reverse allocations; SO rollups recalc; audit `invoice_voided` |
| **Credit Note** | Posted invoice exists | New document `invoiceType: credit_note`; negative lines; reverse proportional allocation |
| **Amend Posted** | — | **Not allowed INV0** — use credit note + re-invoice |

Void requires permission `invoices.void`. Paid invoices require payment reversal first (future).

### 6.3 Commercial lock (Posted and beyond)

**Posted invoices are commercially immutable.**

Once `status` reaches **Posted** (or any downstream receivable state: **Partially Posted**, **Partially Paid**, **Paid**, **Written Off**), the following MUST NOT be edited on the invoice document:

| Locked domain | Fields / structure |
|---------------|-------------------|
| Quantities | Line `quantity`, bundle qty scaling |
| Pricing | `unitPriceSnapshot`, `listPriceSnapshot`, price book snapshots |
| Discounts | Line, section, and global discount inputs and amounts |
| Taxes | `taxSnapshot`, computed tax totals |
| Sections | Section CRUD, order, titles, section discounts |
| Line structure | Add/remove/reorder lines; bundle parent/child relationships |

**Allowed after Posted:** Non-commercial metadata only (e.g. internal notes, owner, custom fields not on commercial path) — org policy may further restrict.

**Corrections MUST occur through:**

| Mechanism | Purpose |
|-----------|---------|
| **Credit Note** | Negative billing document against Posted invoice |
| **Void** | Cancel Posted invoice before material payment; reverse allocations |
| **Write Off** | Bad-debt closure (future) |
| **Payments** | Cash application — does not change commercial line structure |

Direct amendment of Posted commercial content is **forbidden**. `lockedSnapshot: true` on lines/sections after Post enforces this at the service layer.

---

## 7. Sales Order → Invoice conversion contract

### 7.1 Entry points

| Path | API (planned) | Description |
|------|---------------|-------------|
| **SO invoice wizard** | `POST /api/invoices/from-sales-order/:salesOrderId` | Primary path — line picker + qty |
| **Multi-SO invoice** | `POST /api/invoices/from-sales-orders` | Same customer; body `{ salesOrderIds, lines[] }` |
| **Section milestone** | `POST /api/invoices/from-sales-order/:id/sections/:sectionId` | All eligible lines in section |
| **Manual invoice** | `POST /api/invoices` | No SO — catalog resolve once; no SO allocation |
| **Credit note** | `POST /api/invoices/from-invoice/:invoiceId/credit-note` | Future INV2 |

### 7.2 Conversion flow (atomic)

1. **Validate eligibility** — SO not Cancelled; lines have billable qty > 0; bill-on-fulfill policy satisfied (§10).
2. **Resolve line set** — user-selected lines + qty OR section milestone auto-set.
3. **Create Invoice** in **`Draft`** (or `Approved` if auto-post policy — default Draft).
4. **Create InvoiceSection** rows — map from SO sections (title/order/type); partial sections allowed.
5. **Create InvoiceLine** rows — copy snapshots from `SalesOrderLine`; set `quantity` = invoice qty ≤ remaining.
6. **`invoiceTotalsService.recompute`** — persist header/section/line totals.
7. **On Post only:** insert `SalesOrderInvoiceAllocation` rows; set `invoiceId` / `invoiceLineId` on allocations; roll up SO `quantityInvoiced`, `invoicedAmount`, `invoiceStatus`; write activity on both modules.

**Quote module responsibility:** None at invoice time — traceability via SO `sourceQuoteLineId` only.

### 7.3 Multi-SO invoice rules

| Rule | Value |
|------|-------|
| Same customer | `organizationRefId` + `contactId` must match across SOs (or org policy allows account-only match) |
| Currency | All SOs same `currency` or explicit FX conversion snapshot on invoice header |
| Allocations | Each line writes allocation against its source SO line |
| SO rollups | Each source SO recalculated independently |

### 7.4 Idempotency

- Re-posting same draft must not double-allocate — Post is single-use transition with optimistic lock on invoice `status`.
- Optional client key `idempotencyKey` on Post (future) for API retries.

---

## 8. Partial invoicing rules

| Pattern | Description | allocationType |
|---------|-------------|----------------|
| **Line partial** | Invoice 40% of fulfilled qty; repeat until fully invoiced | `standard` or `progress` |
| **Section milestone** | Invoice all eligible lines in SO section when section fulfilled | `milestone` |
| **Progress billing** | Fixed schedule % against line independent of fulfill (contract override) | `progress` |
| **Deposit** | Header line before fulfill (org policy allows bill-on-order) | `deposit` |
| **Multi-SO** | One invoice, lines from SO-0001 + SO-0002 | `standard` per line |

**Validation (locked):**

```javascript
quantityToInvoice <= quantityRemainingToInvoice   // per SO line, bill-on-fulfill default
Σ active quantityAllocated <= quantityFulfilled - quantityCancelled   // unless billOn === 'order'
```

**Override:** permission `invoices.overrideBillOnFulfill` + activity reason required.

---

## 9. Bill-on-fulfill behavior

**Org policy key:** `billing.billOn` — `'fulfill'` (default) | `'order'`.

| Policy | Billable base per SO line | Remaining formula |
|--------|---------------------------|-------------------|
| **`fulfill`** (default) | `quantityFulfilled - quantityCancelled` | `billableBase - quantityInvoiced` |
| **`order`** | `quantity - quantityCancelled` | `(quantity - quantityCancelled) - quantityInvoiced` |

Implemented today in `salesOrderInvoiceAllocationService.computeLineRemainingToInvoice()` — invoice module must call this service, not reimplement.

**Invoice before full fulfill:** Allowed only when `billOn === 'order'` OR override permission. Architecture default remains **fulfill** to align product/service/hybrid SO execution.

**Section milestone:** Section billable when all **non-cancelled** lines in section have `quantityFulfilled > 0` OR org policy defines section-level fulfill rollup (future flag).

---

## 10. Tax snapshot strategy

**MVP (INV0–INV1):** Tax is **snapshot JSON**, not a live engine.

| Layer | Strategy |
|-------|----------|
| **SO → Invoice copy** | Copy `SalesOrderLine.taxSnapshot` verbatim to `InvoiceLine.taxSnapshot` |
| **Manual invoice** | Resolve once from org tax table JSON + variant tax class at line add |
| **Totals** | `invoiceTotalsService` sums `lineTaxTotal`; section tax = Σ line tax in section |
| **Historical integrity** | Posted invoice tax unchanged when org tax tables update |
| **Multi-currency** | Tax amounts in invoice currency; FX from line `exchangeRateSnapshot` |

**taxSnapshot shape (compatible with QuoteLine):**

```javascript
{
  taxCode,                     // org-defined code
  taxName,
  rate,                        // decimal e.g. 0.0825
  taxableAmount,
  taxAmount,
  jurisdiction,                // optional ISO / region key
  inclusive,                   // tax-included pricing flag
  breakdown: []                // future multi-jurisdiction
}
```

**Future tax engine:** Replace manual JSON with `taxResolutionService` at invoice line create only — same snapshot contract.

---

## 11. Credit note readiness

Credit notes are **negative invoices** (`invoiceType: 'credit_note'`) — not implemented INV0, but schema and contracts are defined now.

| Concept | Design |
|---------|--------|
| Document | `Invoice` with `invoiceType: 'credit_note'`, `sourceInvoiceId` → original |
| Lines | Negative `quantity` / negative `lineTotal`; reference `sourceInvoiceLineId` |
| Allocations | Reverse proportional `SalesOrderInvoiceAllocation` (status `reversed`) OR create offset allocation rows |
| SO rollups | Decrease `quantityInvoiced` on SO lines when credit note Posted |
| Partial credit | Credit subset of invoice lines/qty |
| Reason codes | `creditReason` enum — duplicate, return, pricing_error, goodwill (future) |

**Rules:**

1. Credit note cannot exceed credited invoice line remaining (qty and amount).
2. Credit note Post requires permission `invoices.createCreditNote`.
3. Activity: `credit_note_created`, `credit_note_posted`, `invoice_credited`.

---

## 12. Write-off readiness

Write-offs are **non-payment balance reductions** — future collections module; schema-ready on invoice header.

| Field | Purpose |
|-------|---------|
| `Invoice.writeOffTotal` | Σ write-off amounts |
| `Invoice.amountDue` | `grandTotal - amountPaid - writeOffTotal` |
| `InvoiceLine.lineType: 'write_off'` | Line-level bad debt (optional) |
| `InvoiceWriteOff` (future collection) | `{ invoiceId, amount, reason, approvedBy, writtenOffAt }` |

**Rules:**

1. Write-off allowed only when `Posted` and `amountDue > 0`.
2. Does not reverse SO allocations — execution already billed; write-off is receivable-only.
3. Permission: `invoices.writeOff` + optional approval workflow.
4. Activity: `invoice_written_off`.

---

## 13. Payment readiness

Payments are **out of scope INV0**, but invoice architecture reserves:

| Field / entity | Purpose |
|----------------|---------|
| `Invoice.paymentStatus` | `unpaid` \| `partially_paid` \| `paid` |
| `Invoice.amountPaid` | Rolled from `PaymentAllocation` |
| `Invoice.amountDue` | Outstanding receivable |
| `Payment` (future) | Header: amount, method, date, currency |
| `PaymentAllocation` (future) | Apply payment to invoice(s) — partial apply supported |

**Future payment allocation strategy (locked direction):**

1. **Invoice-level apply default** — payment reduces `amountDue` on header first (simplest).
2. **Line-level apply optional** — for partial dispute resolution; `PaymentAllocation.invoiceLineId` set.
3. **Multi-invoice payment** — one payment, many `PaymentAllocation` rows across invoices (same customer).
4. **Overpayment** — create customer credit balance entity (future) — not invoice scope.
5. **Reversal** — reverse `PaymentAllocation` (status `reversed`); restore `amountDue`; never delete.

Invoice module **emits** `invoice.posted`, `invoice.paid` events for GL (later).

---

## 14. Activity and audit model

**Service:** `invoiceActivityService.js` — mirror `salesOrderActivityService` / `quoteActivityService`.

**Storage:** `RecordActivity` with `moduleKey: 'invoices'`, `recordId: invoice._id`.

### 14.1 Mandatory events

| Category | Actions |
|----------|---------|
| Lifecycle | `invoice_created`, `invoice_updated`, `invoice_submitted`, `invoice_approved`, `invoice_rejected`, `invoice_posted`, `invoice_voided` |
| Lines | `invoice_line_added`, `invoice_line_updated`, `invoice_line_removed` |
| Sections | `invoice_section_created`, `invoice_section_updated`, `invoice_section_deleted` |
| Allocation | `invoice_allocation_posted`, `invoice_allocation_reversed` |
| SO linkage | `sales_order_invoiced` (also written on SO via existing activity service) |
| Credit / write-off | `credit_note_created`, `credit_note_posted`, `invoice_written_off` (future) |
| Payment | `payment_applied`, `payment_reversed` (future — on payment module) |

### 14.2 Audit rules

1. User-attributed (`author`, `organizationId`).
2. Append-only — no mutation of historical activity rows.
3. Posted transitions log totals snapshot in `details`.
4. Allocation reversals log `reversalReason` (required for void/credit).
5. Exportable via platform audit export (Helpdesk pattern — future).

### 14.3 SO-side mirror events

When invoice Posts, SO activity MUST include:

- `sales_order_invoiced` with `{ invoiceId, invoiceNumber, quantityAllocatedSummary }`
- Per-allocation optional detail in `details.allocations[]`

---

## 15. Totals engine

**Service:** `invoiceTotalsService.js` — mirrors `salesOrderTotalsService` / `quoteTotalsService`.

```text
Line gross → line discount → line subtotal → line tax
  → section subtotal → section discount → section total
    → invoice subtotal → global discount → tax → grand total
```

**Rules:**

1. Bundle rollup modes match SO/Quote (`fixed` vs `rollup`).
2. Optional sections excluded from header total when `includeInInvoiceTotal === false`.
3. Server recomputes on every line/section/discount mutation in Draft.
4. Posted invoices freeze totals — changes require credit note.

---

## 16. Workflow integration

Mirror Quotes approval pattern:

| Stage | Invoice status | approvalLocked |
|-------|----------------|----------------|
| Compose | Draft | false |
| Submit | Pending Approval | true |
| Approve | Approved | true |
| Post | Posted | true (permanent commercial lock) |

**Process Designer integration (future INV2):** `entityType: 'invoice'`, gates on `grandTotal`, `customerId`, `sourceType`.

Org setting: `invoices.requireApprovalAboveAmount` — skip workflow below threshold.

---

## 17. Permissions (target)

| Permission | Notes |
|------------|-------|
| `invoices.view` | List/detail |
| `invoices.create` | Manual + from SO |
| `invoices.edit` | Draft only |
| `invoices.delete` | Draft only |
| `invoices.submit` | Start approval |
| `invoices.approve` | Workflow |
| `invoices.post` | Draft/Approved → Posted |
| `invoices.void` | Posted → Void |
| `invoices.createCreditNote` | Future |
| `invoices.writeOff` | Future |
| `invoices.overrideBillOnFulfill` | Bill before fulfill |
| `invoices.overridePricing` | Manual price on draft lines |
| `invoices.export` | PDF/email |

Platform module registration: `moduleKey: invoices`, `entityType: TRANSACTION`, core module in Settings (mirror `sales_orders`).

---

## 18. API surface (target — not implementation list)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/invoices` | List/filter |
| POST | `/api/invoices` | Manual create |
| GET | `/api/invoices/:id` | Header + sections + lines |
| PATCH | `/api/invoices/:id` | Draft header |
| DELETE | `/api/invoices/:id` | Draft delete |
| POST | `/api/invoices/:id/lines` | Add line |
| PATCH | `/api/invoices/:id/lines/:lineId` | Update line |
| DELETE | `/api/invoices/:id/lines/:lineId` | Remove line |
| GET/POST/PATCH/DELETE | `/api/invoices/:id/sections/...` | Section CRUD |
| POST | `/api/invoices/:id/submit` | Approval |
| POST | `/api/invoices/:id/approve` | Approve |
| POST | `/api/invoices/:id/post` | **Post + write allocations** |
| POST | `/api/invoices/:id/void` | Void + reverse allocations |
| POST | `/api/invoices/from-sales-order/:salesOrderId` | SO conversion |
| POST | `/api/invoices/from-sales-orders` | Multi-SO |
| GET | `/api/sales-orders/:id/invoice-readiness` | Existing — returns real data after INV0 |

Sales Order UI: replace readiness stub with "Create Invoice" action when module live.

---

## 19. Locked decisions (approved)

| # | Decision | Value |
|---|----------|-------|
| 1 | Default bill-on policy | **`fulfill`** — align with SO3 `DEFAULT_BILL_ON` |
| 2 | Multiple invoices per SO | **Yes** — until SO `fully_invoiced` |
| 3 | Partial line invoicing | **Yes** — multiple allocations per SO line |
| 4 | Section milestone billing | **Yes** — `allocationType: milestone` |
| 5 | Bundle default grain | Invoice **parent**; components hidden (rollup mode) |
| 6 | Allocation authority | **`SalesOrderInvoiceAllocation`** — existing collection |
| 7 | Post transition | Allocations written **only on Post**, not Draft |
| 8 | Cross-module IDs | `invoiceId` / `invoiceLineId` UUIDs; bridge stores both ObjectId and UUID |
| 9 | Credit note model | Separate **`invoiceType: credit_note`** document (not negative Posted edit) |
| 10 | Payment apply | Header-level default; line-level optional (future) |
| 11 | Tax MVP | Snapshot copy — no live engine INV0 |
| 12 | Invoice revisions | **No** INV0 — credit note + re-invoice |
| 13 | Manual invoice | Allowed without SO — no allocation rows |
| 14 | Multi-SO invoice | Same account/contact + currency |
| 15 | Void | Reverses allocations; restores SO rollups |
| 16 | Partially Posted lifecycle | **Reserved** — documentation only until GL/revenue phase |
| 17 | Platform source metadata | **`sourceContext`** + **`sourceRef { moduleKey, recordId }`** on invoice header |
| 18 | Posted commercial lock | **Immutable** qty/pricing/discounts/taxes/sections/lines — corrections via credit note, void, write-off, payments |

---

## 20. Out of scope (Invoice MVP)

- Payment capture / `Payment` module implementation
- GL / revenue recognition posting
- Inventory / COGS integration
- Automated dunning / collections workflows
- Full tax engine / Avalara integration
- Invoice PDF/email (INV2+ — follow Quotes Q7 pattern)
- Customer portal invoice pay (portal module)
- Proforma → standard conversion automation
- Multi-warehouse / multi-entity billing

---

## 21. Relationship to existing SO3 stub

| Artifact | Status | Invoice module action |
|----------|--------|------------------------|
| `SalesOrderInvoiceAllocation` model | ✅ Live | Use as canonical allocation bridge |
| `salesOrderInvoiceAllocationService` | ✅ Rollups only | Extend with `postAllocations`, `reverseAllocations` |
| `GET …/invoice-readiness` | ✅ Stub UI | Wire to real remaining qty after INV0 |
| `assertInvoiceAllocationAvailable()` | Removed INV0 | Replaced by `postInvoiceAllocations` |
| SO line `quantityInvoiced` | ✅ Field | Updated by allocation service on Post |
| SO header `invoiceStatus` | ✅ Field | Existing `rollupInvoiceFieldsFromLines` |

---

## 22. Implementation phases (preview — detailed roadmap after approval)

| Phase | Deliverable |
|-------|-------------|
| **INV0** | Models, constants, totals service, allocation post/reverse, platform module registration, SO Post API stub |
| **INV1** | SO → Invoice conversion, Post/Void, SO rollup integration, readiness UI |
| **INV2** | Agent UI (list, record, sections/lines), approval workflow, activity |
| **INV3** | PDF/email, credit note, multi-SO wizard |
| **INV4** | Payment readiness fields + event hooks (payment module separate) |

**Implementation:** See `docs/INVOICE_ROADMAP.md`. INV0 complete; INV1 next.

---

## 23. Summary

| Question | Answer |
|----------|--------|
| Is Invoice an SO clone? | **No.** Billing document with allocation contracts and receivable lifecycle. |
| What is copied from SO? | Commercial **snapshots** + structure for selected lines/sections only. |
| How are partial invoices handled? | Multiple Posted invoices; `SalesOrderInvoiceAllocation` per qty slice. |
| Default bill-on? | **Fulfill** — invoice ≤ fulfilled qty unless org/policy override. |
| Where do allocations live? | **`SalesOrderInvoiceAllocation`** — already defined in SO3. |
| Credit notes? | Separate negative invoice document — schema-ready, INV3. |
| Payments? | `PaymentAllocation` future — invoice reserves `amountDue` / `paymentStatus`. |
| Traceability? | Quote → SO → Invoice via UUID lineage from day one. |

---

## Appendix A — Reference: existing upstream touchpoints

| Layer | Files |
|-------|-------|
| SO allocation model | `server/models/SalesOrderInvoiceAllocation.js` |
| SO allocation service | `server/services/salesOrderInvoiceAllocationService.js` |
| SO invoice readiness API | `server/controllers/salesOrderController.js` → `getInvoiceReadiness` |
| SO architecture §11 | `docs/SALES_ORDER_ARCHITECTURE.md` |
| Quote tax snapshot | `server/models/QuoteLine.js` → `taxSnapshot` |
| SO totals pattern | `server/services/salesOrderTotalsService.js` |
| Readiness UI stub | `client/src/components/record-page/sections/SalesOrderInvoiceReadinessRecordSection.vue` |

## Appendix B — Traceability field matrix

| Field | Quote | Sales Order | Invoice |
|-------|-------|-------------|---------|
| Document public id | `quoteNumber` + `revisionNumber` | `salesOrderNumber` | `invoiceNumber` |
| Line public id | `quoteLineId` | `salesOrderLineId` | `invoiceLineId` |
| Section public id | `quoteSectionId` | `salesOrderSectionId` | `invoiceSectionId` |
| Cross-ref to parent line | — | `sourceQuoteLineId` | `sourceSalesOrderLineId` |
| Allocation bridge | — | `salesOrderInvoiceAllocationId` | same id on `InvoiceLine` |
