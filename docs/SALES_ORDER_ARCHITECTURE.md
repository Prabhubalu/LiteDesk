# Sales Orders — Platform Architecture

**Status:** Approved — SO3 complete  
**Scope:** Operational execution transaction module — first downstream consumer of Quotes  
**Last updated:** 2026-06-02 (architecture review locked)  
**Audience:** Engineering, product, commerce platform design  
**Prerequisite:** Quotes Q0–Q9 + Quote Sections (S1–S4) complete — see `docs/QUOTES_ROADMAP.md`, `docs/QUOTE_SECTIONS_ARCHITECTURE.md`

---

## 1. Executive summary

The **Sales Order** module is Arivu's **operational execution transaction**: the moment a commercial proposal becomes a commitment to deliver, fulfill, and (later) invoice.

| Module | Role | Commercial truth | Operational truth |
|--------|------|------------------|-------------------|
| **Quote** | Proposal / negotiation | Snapshot at send & accept | None — no fulfillment |
| **Sales Order** | Execution contract | Copied snapshots at conversion | Fulfillment qty, status, lineage |
| **Invoice** (future) | Billing document | Allocated from SO snapshots | Payment / GL (later) |

**Sales Order is not a Quote clone.** It inherits **snapshot integrity** and **structural patterns** (sections, bundles, totals hierarchy) from Quotes, but introduces its own lifecycle, fulfillment semantics, split/merge lineage, and invoice allocation contracts. Quotes may revise; Sales Orders **do not revise in SO0** — corrections use cancellation, split, or future amendment flows.

**Foundation inherited from Quotes:**

- Snapshot-driven commercial fields (never live catalog after save)
- Section-aware three-tier totals (line → section → order)
- Bundle-aware parent/child integrity
- Conversion-safe traceability via `QuoteConversionLink`
- Audit-safe immutable activity events
- Activity-driven UI (server totals authority)

**SO0 complete:** Models, constants, totals, coverage service, module registration. **SO1:** quote convert service + real SO creation in progress.

---

## 2. Position in the commerce chain

```text
┌─────────────────────────────────────────────────────────────────┐
│  Catalog (C0–C5): ItemVariant · PriceBooks · Bundles          │
└────────────────────────────┬────────────────────────────────────┘
                             │ resolve at quote line-add only
┌────────────────────────────▼────────────────────────────────────┐
│  Quote: proposal · portal accept · sections · revisions         │
│         QuoteConversionLink (acceptedLineIds, sectionBreakdown) │
└────────────────────────────┬────────────────────────────────────┘
                             │ convert (full | partial | split)
┌────────────────────────────▼────────────────────────────────────┐
│  Sales Order: execution · fulfillment · split/merge lineage   │
│               SalesOrderInvoiceAllocation (future contract)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoice (future)
┌────────────────────────────▼────────────────────────────────────┐
│  Invoice · Payments · GL · Inventory (explicitly later)         │
└─────────────────────────────────────────────────────────────────┘
```

**Traceability requirement (day one):** Cross-module contracts use **stable public UUIDs**, not Mongo `_id`:

| Layer | Public id | Mongo `_id` |
|-------|-----------|-------------|
| Quote | `quoteLineId`, `quoteSectionId` | internal only |
| Sales Order | `salesOrderId`, `salesOrderLineId`, `salesOrderSectionId` | internal only |
| Conversion link | `targetRecordId` = **`salesOrderId` UUID** | never Mongo `_id` |

Every SO line MUST retain: `sourceQuoteLineId`, `sourceQuoteSectionId`, `sourceQuoteId`, `sourceRevisionNumber`.

Every invoice line (future) MUST retain: `sourceSalesOrderLineId`, `sourceSalesOrderId`.

---

## 3. Architectural principles (locked)

| Principle | Sales Order rule |
|-----------|------------------|
| **Operational-first** | Header status reflects fulfillment progress, not quote negotiation |
| **Snapshot copy at conversion** | SO commercial fields are **copied once** from quote (or manual SO create re-resolves catalog once) |
| **No quote coupling after create** | SO services never read live `QuoteLine` for totals; only `source*` lineage fields |
| **Section-aware** | `SalesOrderSection` mirrors accepted quote sections; partial sections allowed |
| **Bundle-aware** | Parent/child lines move as atomic groups; pricing mode rules match Quotes |
| **Conversion-safe** | `QuoteConversionLink.targetRecordId` = `salesOrderId` UUID (never Mongo `_id`) |
| **Conversion coverage** | Quote → `Partially Converted` until all accepted lines mapped; then `Converted` |
| **Audit-safe** | Append-only activity; no hard-delete of fulfillment or allocation history |
| **Activity-driven** | All mutations via `/api/sales-orders/*`; UI is a client |
| **Multi-tenant** | Strict `organizationId` isolation on every collection |
| **No SO revisions (SO0)** | One SO document = one execution contract; use split/cancel/amend later |

**Forbidden:** Treating SO as "editable quote with different status." Price changes on SO require explicit override permission + audit, not quote-style revision.

---

## 4. What Sales Order IS and IS NOT

### 4.1 Sales Order IS

- The **execution record** for accepted commercial terms
- The **fulfillment authority** (what qty to pick, ship, deliver, complete)
- The **invoice source document** (future billing allocates against SO lines)
- A **platform module** (`moduleKey: sales_orders`) usable by Sales, FSM, Helpdesk-linked deals — not Sales-app-only

### 4.2 Sales Order IS NOT

- A proposal or customer portal artifact (no public share token)
- A revision tree (no `revisionNumber` on SO in SO0)
- An invoice or payment
- An inventory transaction (reservations ship later)
- A GL posting

---

## 5. Domain model

### 5.1 `SalesOrder` (header)

First-class MongoDB document. Auto-number per org: `SO-{seq}` (configurable prefix).

```javascript
// server/models/SalesOrder.js (planned)
{
  organizationId,              // required, indexed
  salesOrderNumber,            // String, unique per org, e.g. SO-0001
  salesOrderId,                // String UUID — stable public id (portal/API/integrations)

  // ── Lifecycle (operational, not quote lifecycle) ──
  status,                      // see §6 state machine
  fulfillmentStatus,           // derived mirror: Open | Partial | Fulfilled | Cancelled

  // ── Commercial snapshots (from quote or manual create) ──
  currency,
  exchangeRateSnapshot,
  subtotal, lineDiscountTotal, sectionDiscountTotal, globalDiscountTotal,
  taxTotal, adjustmentTotal, grandTotal,   // persisted by salesOrderTotalsService

  globalDiscountType, globalDiscountValue, globalDiscountAmount,  // inputs

  // ── Party & context (copied from quote header or set on manual create) ──
  customerId,                  // dynamic lookup ref
  organizationRefId, contactId, dealId, caseId,
  billToAddressSnapshot, shipToAddressSnapshot,   // Mixed JSON snapshots

  paymentTermsSnapshot, incotermsSnapshot, termsConditionsSnapshot,

  orderDate,                   // Date — execution start
  requestedDeliveryDate,       // optional
  promisedDeliveryDate,        // optional — operational commitment

  ownerId, createdBy, modifiedBy,

  // ── Source lineage (quote conversion) ──
  sourceType,                  // 'quote' | 'manual' | 'split' | 'merge' | 'api'
  sourceQuoteId,               // ObjectId → Quote (nullable)
  sourceQuoteNumber,
  sourceRevisionNumber,
  quoteConversionLinkId,       // ObjectId → QuoteConversionLink

  conversionType,              // 'full' | 'partial' | 'split' — mirrors link

  // ── Split / merge lineage ──
  lineageType,                 // 'standalone' | 'split_child' | 'split_parent' | 'merged_result' | 'merged_source'
  parentSalesOrderId,          // split: order this was split from
  rootSalesOrderId,            // top of split tree for reporting
  mergedFromSalesOrderIds,     // [ObjectId] — sources merged into this order (merge)
  mergedIntoSalesOrderId,      // if this order was absorbed by merge

  // ── Invoice readiness (future; schema-ready SO0) ──
  invoiceStatus,               // 'not_invoiced' | 'partially_invoiced' | 'fully_invoiced'
  invoicedAmount,              // persisted rollup
  remainingBillableAmount,     // grandTotal - invoicedAmount (approx; line-level canonical)

  // ── Notes ──
  internalNotes, customerNotes,

  // Trash
  deletedAt, deletedBy, deletionReason,
  customFields                   // ModuleDefinition-driven
}
```

**Indexes (minimum):** `{ organizationId, salesOrderNumber }` unique; `{ organizationId, status }`; `{ organizationId, sourceQuoteId }`; `{ organizationId, rootSalesOrderId }`.

---

### 5.2 `SalesOrderSection`

Parallel to `QuoteSection`. Created at conversion from accepted quote sections (full or partial).

```javascript
{
  organizationId,
  salesOrderId,                // ObjectId → SalesOrder
  salesOrderSectionId,         // String UUID — stable public id

  sectionTitle, sectionDescription, sectionOrder,
  sectionType,                 // 'standard' | 'optional' | 'future' — copied; 'future' typically excluded at convert

  // Section discount inputs (copied when section fully accepted — see §8.3)
  sectionDiscountType, sectionDiscountValue, sectionDiscountAmount,

  // Persisted computed totals (salesOrderTotalsService)
  sectionSubtotal, sectionLineDiscountTotal, sectionDiscountTotal,
  sectionTaxTotal, sectionTotal,

  showSectionTotal, hiddenSection,

  // ── Source lineage ──
  sourceQuoteSectionId,        // quoteSectionId UUID from quote
  sourceQuoteId,
  sourceRevisionNumber,
  sectionAcceptanceType,       // 'full' | 'partial' | 'line_only' — how section landed on SO

  lockedSnapshot               // true after status >= Confirmed (commercial lock)
}
```

**Rules:**

1. Every SO line references `salesOrderSectionId` (soft rule: auto "General" section if none).
2. Bundle parent + all children share the same `salesOrderSectionId`.
3. `future` quote sections are **excluded** from conversion unless explicitly overridden (admin).
4. Section totals on SO are **recomputed from SO lines**, not copied verbatim from quote section totals (partial acceptance may differ).

---

### 5.3 `SalesOrderLine`

First-class entity — **not** embedded on header. Stable `salesOrderLineId` (UUID).

```javascript
{
  organizationId,
  salesOrderId,
  salesOrderLineId,            // String UUID

  salesOrderSectionId,         // ObjectId → SalesOrderSection

  variantId,                   // required — catalog ref (identity only post-snapshot)
  lineType,                    // standard | bundle_parent | bundle_component | adjustment
  lineOrder,

  parentBundleLineId,          // ObjectId → SalesOrderLine (bundle children)

  // ── Quantity (operational) ──
  quantity,                    // ordered qty (from quote at convert)
  unitOfMeasure,

  // ── Pricing snapshots (copied from QuoteLine) ──
  unitPriceSnapshot, listPriceSnapshot,
  pricingSourceSnapshot, priceBookIdSnapshot, priceBookNameSnapshot,
  priceBookEntryIdSnapshot, pricingAsOfDateSnapshot,
  discountType, discountValue, discountAmount,
  taxSnapshot,                 // Mixed JSON

  lineSubtotal, lineTaxTotal, lineTotal,   // persisted by totals service

  currencySnapshot, exchangeRateSnapshot,
  skuSnapshot, itemNameSnapshot, descriptionSnapshot,
  attributesSnapshot, bundleSnapshot,

  optionalLine, hiddenLine,

  // ── Fulfillment (operational — core SO differentiation) ──
  fulfillmentStatus,           // Open | Partially Fulfilled | Fulfilled | Cancelled | Backordered
  quantityFulfilled,           // cumulative shipped/delivered (domain-defined)
  quantityCancelled,           // cancelled on this SO
  quantityBackordered,
  quantityInvoiced,            // future — rolled from InvoiceAllocation
  quantityRemainingToFulfill,  // derived: quantity - fulfilled - cancelled

  // ── Source lineage (conversion traceability) ──
  sourceQuoteLineId,           // quoteLineId UUID — **required when sourceType=quote**
  sourceQuoteSectionId,        // quoteSectionId UUID
  sourceQuoteId,
  sourceRevisionNumber,
  quoteConversionLinkId,

  lockedSnapshot                 // true after SO commercially locked
}
```

**Bundle preservation (see §8.4):** On conversion, create parent lines first, build `quoteLineId → salesOrderLineId` map, then children with remapped `parentBundleLineId`. Copy `bundleSnapshot` verbatim. Apply same fixed/rollup display rules as Quotes in totals engine.

---

### 5.4 Fulfillment model

Fulfillment is **line-quantity authoritative** with mode-aware status semantics. The platform must **not** hardcode product-only states (ship/backorder) — service and hybrid orders use the same schema with different active status paths.

#### 5.4.0 `fulfillmentMode` (locked decision)

Set on `SalesOrder` header at create (from org default, quote conversion, or manual):

| Mode | Primary execution | Typical line progression |
|------|-------------------|-------------------------|
| **`product`** | Pick → pack → ship | `Open` → `Backordered` → `Partially Fulfilled` → `Fulfilled` |
| **`service`** | Schedule → deliver → complete | `Open` → `In Progress` → `Partially Fulfilled` → `Fulfilled` |
| **`hybrid`** | Mixed catalog | All line statuses available; per-line `fulfillmentGrain` optional |

**Rules:**

1. All modes share the **same line qty fields** (`quantity`, `quantityFulfilled`, `quantityCancelled`, …).
2. `fulfillmentStatus` on line + header is derived from qty + mode — not a separate product-only enum.
3. Org setting `settings.salesOrders.defaultFulfillmentMode` (default: `hybrid`).
4. Quote conversion inherits org default unless quote `sourceContext` implies service (future automation).
5. SO1+ fulfillment events (`SalesOrderFulfillment`) include `fulfillmentType` appropriate to mode (`ship`, `deliver`, `complete`, `cancel`, `backorder`).

**Line fulfillment statuses (mode-capable, not product-only):**

`Open` · `In Progress` · `Backordered` · `Partially Fulfilled` · `Fulfilled` · `Cancelled`

**Header fulfillment rollup:**

`Not Started` · `In Progress` · `Partially Fulfilled` · `Fulfilled` · `Cancelled`

#### 5.4.1 Line-level fulfillment (SO0 — required)

Canonical quantities live on `SalesOrderLine`:

| Field | Meaning |
|-------|---------|
| `quantity` | Ordered |
| `quantityFulfilled` | Cumulative fulfilled (shipped/delivered/completed — org policy) |
| `quantityCancelled` | Removed from execution |
| `quantityBackordered` | Accepted but not yet available |
| `quantityInvoiced` | Sum of invoice allocations (future) |
| `fulfillmentStatus` | Derived from qty fields |

Header `fulfillmentStatus` = rollup of line statuses (worst-case or weighted — document: **any line open → header Partial**).

#### 5.4.2 `SalesOrderFulfillment` (SO1+ — recommended collection)

Append-only fulfillment events for operational audit (not inventory ledger):

```javascript
{
  organizationId,
  salesOrderId,
  salesOrderFulfillmentId,     // String UUID

  fulfillmentType,             // 'ship' | 'deliver' | 'complete' | 'cancel' | 'backorder'
  status,                      // 'posted' | 'reversed'
  fulfilledAt,
  fulfilledBy,

  // Line deltas
  lines: [{
    salesOrderLineId,
    quantityDelta,             // +fulfill, +cancel
    priorQuantityFulfilled,
    newQuantityFulfilled
  }],

  carrier, trackingNumber, warehouseId,   // optional logistics
  externalRef,                 // WMS/3PL id

  activityAction               // maps to sales_order_fulfillment_posted
}
```

**Rules:**

1. Posting a fulfillment event updates line qty fields + recomputes header status atomically.
2. Cannot fulfill more than `quantity - quantityCancelled`.
3. Reversal creates compensating event — never mutate history rows.
4. Inventory reservation/deduction is **out of scope** — hook emits `sales_order.fulfillment.posted` for future inventory module.

#### 5.4.3 Partial fulfillment architecture

| Scenario | Behavior |
|----------|----------|
| Ship 3 of 10 | `quantityFulfilled += 3`, line → `Partially Fulfilled` |
| Cancel remaining 7 | `quantityCancelled += 7`, line → `Fulfilled` or `Cancelled` per policy |
| Split SO for unfulfilled qty | New SO via **split lineage** (§7) — remaining lines move to child SO |
| Invoice before full fulfill | Allowed via allocation contract (§9) — org policy flag |

**Partial fulfillment does not change commercial snapshots** (`unitPriceSnapshot` fixed). Qty changes on SO after conversion require `edit_sales_order` + audit, not catalog re-resolve.

---

## 6. Sales Order lifecycle

**Statuses (SO0):**

```text
Draft ──► Confirmed ──► In Fulfillment ──► Partially Fulfilled ──► Fulfilled
  │           │                │                      │
  ▼           ▼                ▼                      ▼
Cancelled   On Hold         Cancelled              Closed
```

| Status | Meaning |
|--------|---------|
| `Draft` | Created; lines editable; not yet execution commitment |
| `Confirmed` | Execution authorized; commercial lock (mirror quote Sent+ lock) |
| `In Fulfillment` | At least one fulfillment event or pick started |
| `Partially Fulfilled` | Some lines partially or fully fulfilled |
| `Fulfilled` | All lines fulfilled or cancelled |
| `On Hold` | Blocks fulfillment; reversible |
| `Cancelled` | Terminal; no further fulfill/invoice |
| `Closed` | Terminal after fulfilled + invoiced (future gate) |

**No revision states.** Quote reaches **`Converted`** only when all accepted lines are mapped (see §7.4).

**Conversion entry (locked):** Quote → SO **always** creates SO in **`Confirmed`** status — never `Draft`. Manual SO create may start in `Draft`.

---

## 7. Quote → Sales Order conversion contract

### 7.1 Existing upstream artifacts

| Artifact | Location | Role |
|----------|----------|------|
| `QuoteConversionLink` | `server/models/QuoteConversionLink.js` | One link per convert operation (partial allows multiple per revision) |
| `buildConversionMetadata()` | `quoteConversionService.js` | `acceptedLineIds`, `acceptedSectionIds`, `sectionBreakdown` |
| `quoteConversionCoverageService` | SO0 | Computes mapped vs accepted lines → quote status |
| `POST /api/quotes/:id/convert` | stub today | Delegates to SO convert (SO1) |

**Link fields used — UUID contract (locked):**

```javascript
{
  quoteId, quoteNumber, revisionNumber,
  conversionType,              // full | partial | split
  targetModuleKey: 'sales_orders',
  targetRecordId,              // salesOrderId UUID — NEVER Mongo _id
  metadata: {
    salesOrderId,              // duplicate for query convenience
    linesOnThisOrder: [quoteLineId, ...],
    acceptedLineIds,
    acceptedSectionIds,
    sectionBreakdown,
    acceptedGrandTotal
  }
}
```

### 7.2 Conversion flow (atomic)

```text
1. Validate quote eligibility (Accepted | Partially Accepted | Partially Converted; not fully Converted)
2. Resolve line set from acceptedLineIds not yet mapped (+ bundle child expansion)
3. Resolve section set from sectionBreakdown + acceptedSectionIds
4. Create SalesOrder header in **Confirmed** (snapshots from quote header + fulfillmentMode)
5. Create SalesOrderSection rows (from quote sections — partial rules §8.3)
6. Create SalesOrderLine rows (from quote lines — §8.2)
7. Run salesOrderTotalsService.recompute()
8. Update QuoteConversionLink.targetRecordId = salesOrderId UUID + metadata.linesOnThisOrder
9. Recompute quote conversion coverage → **Partially Converted** or **Converted** (§7.4)
10. Write activity: quote_partially_converted / quote_converted + sales_order_created
```

**Idempotency:** Unique index on `{ organizationId, sourceQuoteId, sourceQuoteLineId }` on `SalesOrderLine` prevents duplicate line mapping. Multiple conversion links per quote revision allowed for partial execution.

### 7.4 Quote conversion coverage statuses (locked)

Quote lifecycle adds **`Partially Converted`** alongside **`Converted`**, driven by accepted-line coverage:

| Coverage | Quote status | Condition |
|----------|--------------|-----------|
| None | `Accepted` / `Partially Accepted` | No accepted lines mapped to SO yet |
| Partial | **`Partially Converted`** | Some but not all `acceptedLineIds` appear on SO lines |
| Full | **`Converted`** | Every `acceptedLineId` mapped to exactly one SO line |

**Transitions:**

```text
Accepted ──────────► Partially Converted ──► Converted
Partially Accepted ──► Partially Converted ──► Converted
Accepted ──────────► Converted   (single-shot full convert)
Partially Accepted ► Converted   (single-shot full convert)
```

**Rules:**

1. **`Converted` only when coverage = full** — never on first partial convert.
2. **`Partially Converted` quotes remain convert-eligible** until all accepted lines are mapped.
3. Coverage computed from `SalesOrderLine.sourceQuoteLineId` (canonical).
4. `Partially Converted` is record-read-only for quote header/line edits.
5. Service: `quoteConversionCoverageService.resolveQuoteConversionCoverage()`.

### 7.5 Manual SO create (non-quote)

- `sourceType: 'manual'`
- Catalog resolution at line-add (same as quote line-add pattern)
- No `QuoteConversionLink`
- Full section/line CRUD like quotes but operational lifecycle

---

## 8. Conversion mapping decisions (locked)

### 8.1 Which quote snapshots are copied?

| Source | Copy to SO? | Notes |
|--------|-------------|-------|
| **Quote header** | | |
| `currency`, `exchangeRateSnapshot` | ✅ | |
| `customerId`, `contactId`, `organizationRefId`, `dealId`, `caseId` | ✅ | |
| Address fields | ✅ | Snapshot JSON on SO |
| `paymentTerms`, `incoterms`, `termsConditions` | ✅ | As `*Snapshot` fields |
| Global discount inputs | ✅ | Recompute totals on SO lines |
| Quote totals | ❌ | **Recomputed** on SO from copied lines |
| `validUntil`, portal fields, approval flags | ❌ | Quote-only |
| `customerResponse` | ❌ | Referenced via conversion link metadata only |
| **QuoteSection** | | |
| `sectionTitle`, `description`, `order`, `type` | ✅ | If section has ≥1 converted line |
| Section discount inputs | ✅/⚠️ | See §8.3 |
| Section computed totals | ❌ | Recomputed on SO |
| **QuoteLine** | | |
| All `*Snapshot` commercial fields | ✅ | For each accepted line |
| `quantity` | ✅ | Becomes SO ordered qty |
| `lineOrder` | ✅ | Preserved within section |
| `variantId` | ✅ | Identity reference |
| `quoteLineId` | → `sourceQuoteLineId` | Lineage only |
| Hidden bundle components (fixed mode) | ✅ | Copied if parent accepted |
| `adjustment` lines | ✅ | If in `acceptedLineIds` |

**Never copied:** Live catalog prices, mutable variant fields, quote `status`, share tokens.

### 8.2 How `acceptedLineIds` map into Sales Orders

1. **Input:** `quote.customerResponse.acceptedLineIds` or full selectable set on full accept.
2. **Expand bundles:** If `quoteLineId` is a `bundle_parent`, include all non-hidden children (same as `linesForSelection()` in `quotePublicAcceptanceService.js`).
3. **Exclude:** `hiddenLine`, `bundle_component` rows not reachable from accepted parent.
4. **One SO line per accepted quote line** (1:1 lineage).
5. **Partial quote conversion:** `conversionType: 'partial'` — only accepted lines appear on SO; quote may convert remaining lines to **another SO later** via split contract (§9) if product allows multiple links per revision — **decision:** allow **multiple SO links per quote revision** with disjoint line sets (see §10 split lineage).

**Stable key:** `SalesOrderLine.sourceQuoteLineId` = `QuoteLine.quoteLineId` (UUID string).

### 8.3 How `acceptedSectionIds` map into Sales Orders

1. **Full section accept:** Section listed in `acceptedSectionIds` AND all selectable lines in section ∈ `acceptedLineIds`.
   - Copy section metadata + section discount inputs.
   - `sectionAcceptanceType: 'full'`.

2. **Partial section accept:** Some but not all lines in section accepted.
   - Create `SalesOrderSection` with copied title/order/type.
   - **Do not copy section-level discount inputs** (avoid mis-stated rollup); section discount = 0 at section tier; line discounts still apply.
   - `sectionAcceptanceType: 'partial'`.

3. **Line-only (no section):** Lines without `quoteSectionId` → SO "General" section.

4. **Optional / future sections:** Convert only if they contain accepted lines; optional sections do not require `acceptedSectionIds` entry if lines explicitly selected.

5. **`sectionBreakdown` metadata:** Used for UI labels and downstream reporting; SO creation uses live quote sections filtered by accepted lines, cross-checked with breakdown.

### 8.4 Bundle parent/component preservation

| Rule | Implementation |
|------|----------------|
| Atomic group | Parent + included children always convert together |
| ID remap | New `salesOrderLineId`; `parentBundleLineId` → new parent `_id` |
| Pricing mode | `bundleSnapshot.pricingMode` copied; totals service uses same fixed/rollup rules |
| Fixed bundle display | Components may be hidden in UI but stored for fulfillment traceability |
| Rollup bundle | Parent may be hidden from totals; components carry prices |
| Fulfillment | Fulfill parent OR components per org policy — **SO0 decision:** fulfill at **component granularity** when components are visible lines; fixed bundles fulfill at **parent line** only |

### 8.5 Revisions on Sales Orders

**Recommendation (SO0): NO revisions.**

| Approach | Rationale |
|----------|-----------|
| No `revisionNumber` on SO | Execution contracts must not fork silently |
| Quote revises after convert | Does not auto-update SO; user creates amendment SO or cancels |
| Price/qty fix | `Confirmed` SO requires override permission + audit event |
| Structural change | Split SO (§10) or cancel + re-convert |

**Future (SO2+):** `SalesOrderAmendment` append-only child documents — not in SO0 scope.

---

## 9. Split order lineage

**Purpose:** One accepted quote (especially partial) may execute as **multiple Sales Orders** over time — e.g. ship hardware now, services later.

### 9.1 Split from quote (conversion-time)

When not all accepted lines convert in one operation:

```javascript
// Multiple QuoteConversionLink rows OR one link with conversionType split — RECOMMEND:
// One link per SO created; metadata.linesConverted: [quoteLineIds]
QuoteConversionLink {
  conversionType: 'partial',
  metadata: { acceptedLineIds, linesOnThisOrder: [...] }
}
```

**Quote status:** Remains `Partially Accepted` until all accepted lines are on SO(s); then `Converted` when fully allocated.

### 9.2 Split from existing SO (execution-time)

```javascript
SalesOrder (parent) ──split──► SalesOrder (child A) + SalesOrder (child B)

parent.lineageType = 'split_parent'
child.lineageType = 'split_child'
child.parentSalesOrderId = parent._id
child.rootSalesOrderId = parent.rootSalesOrderId || parent._id
```

**Rules:**

1. Split moves **unfulfilled** line qty (or whole lines) to child SO.
2. Commercial snapshots copied to child lines; new `salesOrderLineId`.
3. **`sourceQuoteLineId` preserved** on both parent and child lines for invoice traceability.
4. Activity: `sales_order_split` with `{ parentId, childIds, linesMoved }`.
5. Parent + children share `rootSalesOrderId` for reporting.

### 9.3 Split lineage diagram

```text
Quote QT-0001 Rev 1 (Partially Accepted)
  │
  ├── QuoteConversionLink #1 ──► SO-0001 (Hardware)     rootSalesOrderId = SO-0001
  │
  └── QuoteConversionLink #2 ──► SO-0002 (Services)     rootSalesOrderId = SO-0002

SO-0001 (split execution)
  ├── SO-0001 (parent, partial fulfill)
  └── SO-0003 (child, unfulfilled lines)   parentSalesOrderId = SO-0001
```

---

## 10. Merge order lineage

**Purpose:** Combine open SOs (same customer, compatible terms) before fulfillment or invoicing.

```javascript
SalesOrder (merged result)
  mergedFromSalesOrderIds: [SO-0001, SO-0002]
  lineageType: 'merged_result'

SalesOrder (SO-0001)
  mergedIntoSalesOrderId: SO-0003
  lineageType: 'merged_source'
  status: 'Cancelled' or 'Closed'
```

**Rules:**

1. Merge allowed only for `Draft` or `Confirmed` SOs with **no fulfillment posted** (SO0); relax in SO1+ with reversal flows.
2. Lines renumbered; sections reconciled by title or kept separate.
3. **`sourceQuoteLineId` preserved** on every merged line — never collapse lineage.
4. Conversion links remain on source SOs; new SO gets `sourceType: 'merge'`.
5. Activity: `sales_order_merged`.

**Out of scope SO0:** Merge UI — schema + service contract only.

---

## 11. Future Invoice allocation contract

Invoices are not implemented. SO0 defines the **allocation contract** so billing does not require SO schema changes.

### 11.1 `SalesOrderInvoiceAllocation` (planned collection)

```javascript
{
  organizationId,
  salesOrderId,
  salesOrderLineId,
  sourceQuoteLineId,           // denormalized traceability

  invoiceId,                   // future
  invoiceLineId,               // future

  salesOrderInvoiceAllocationId,

  quantityAllocated,
  amountAllocated,             // snapshot currency
  taxAmountAllocated,

  allocationType,              // 'standard' | 'progress' | 'milestone'
  status,                      // 'active' | 'reversed'

  allocatedAt, allocatedBy,
  reversedAt, reversalReason
}
```

### 11.2 Line-level rollups

```javascript
SalesOrderLine.quantityInvoiced = Σ quantityAllocated (active)
SalesOrderLine.quantityRemainingToInvoice = quantityFulfilled - quantityInvoiced
  // OR quantity - quantityInvoiced — org policy; default: bill on fulfill
```

### 11.3 Partial invoicing architecture

| Pattern | Description |
|---------|-------------|
| **Line partial** | Invoice 40% of line qty — multiple allocations until `quantityInvoiced == quantityFulfilled` |
| **Section milestone** | Invoice entire section when `sectionFulfilled` — allocation references all lines in section |
| **SO deposit** | Header-level invoice line not tied to SKU — allocation type `deposit` (future) |
| **Multi-SO invoice** | One invoice, allocations across SO-0001 + SO-0002 — shared `invoiceId` |

**Traceability chain:**

```text
Quote.quoteLineId
  → SalesOrderLine.sourceQuoteLineId
    → SalesOrderInvoiceAllocation.salesOrderLineId
      → InvoiceLine (future).sourceSalesOrderLineId
```

### 11.4 Header invoice status

| `invoiceStatus` | Condition |
|-----------------|-----------|
| `not_invoiced` | All lines `quantityInvoiced == 0` |
| `partially_invoiced` | Some lines invoiced |
| `fully_invoiced` | All billable qty invoiced |

---

## 12. Totals engine

**Service:** `salesOrderTotalsService.js` — mirrors `quoteTotalsService` three-tier hierarchy.

```text
Line gross → line discount → line subtotal
  → section subtotal → section discount → section total
    → order subtotal → global discount → tax → grand total
```

**Rules:**

- Same bundle fixed/rollup filtering as quotes (`filterIncludedLines` equivalent).
- Optional sections: excluded from order total unless explicitly included.
- **No client-side totals authority.**
- Recompute on: line CRUD, section discount patch, fulfillment does **not** change commercial totals (qty fulfilled ≠ commercial qty unless line qty edited).

---

## 13. Activity & audit

Extend `salesOrderActivityService` (mirror quote pattern):

| Action | When |
|--------|------|
| `sales_order_created` | Manual or convert |
| `sales_order_converted_from_quote` | Quote convert |
| `sales_order_status_changed` | Lifecycle transition |
| `sales_order_line_added` / `_updated` / `_deleted` | Line CRUD |
| `sales_order_section_*` | Section CRUD |
| `sales_order_fulfillment_posted` | Fulfillment event |
| `sales_order_split` | Split lineage |
| `sales_order_merged` | Merge lineage |
| `sales_order_invoice_allocated` | Future |

Quote module continues logging `quote_converted`; SO module logs conversion receipt with `{ quoteId, quoteConversionLinkId, salesOrderId }`.

---

## 14. Platform module registration

| Decision | Value |
|----------|-------|
| `appKey` | `platform` |
| `moduleKey` | `sales_orders` |
| `entityType` | `TRANSACTION` |
| API namespace | `/api/sales-orders` |
| Relationships | Optional → `quotes`, `deals`, `organizations`, `people` |

**Permissions (initial):**

| Permission | Notes |
|------------|-------|
| `create_sales_order` | Manual create |
| `edit_sales_order` | Draft / policy-gated after Confirmed |
| `confirm_sales_order` | Draft → Confirmed |
| `fulfill_sales_order` | Post fulfillment events |
| `cancel_sales_order` | Terminal cancel |
| `split_sales_order` | Split lineage |
| `merge_sales_orders` | Merge lineage |
| `convert_quote_to_sales_order` | Uses quote accept state |
| `override_sales_order_pricing` | Bypass commercial lock |
| `invoice_sales_order` | Future |

---

## 15. API surface (target — not SO0 implementation list)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | List/filter |
| POST | `/` | Manual create |
| GET | `/:id` | Header + sections + lines + totals |
| PATCH | `/:id` | Header fields |
| POST | `/:id/confirm` | Draft → Confirmed |
| POST | `/:id/lines` | Add line (manual SO) |
| PATCH | `/:id/lines/:lineId` | Update line |
| POST | `/:id/fulfillments` | Post fulfillment event |
| POST | `/:id/split` | Split order |
| POST | `/merge` | Merge orders |
| POST | `/from-quote/:quoteId` | Convert quote → SO (**primary path** from quote module) |

Quote module `POST /quotes/:id/convert` becomes a thin delegate to SO convert service.

---

## 16. Out of scope (SO0)

- Invoice module implementation
- Payment capture / GL
- Inventory reservations / stock movements
- WMS / carrier integrations (fulfillment event hooks only)
- SO revisions / amendments UI
- Merge UI
- Multi-warehouse allocation
- Returns / RMA (future `SalesOrderReturn`)

---

## 17. Locked decisions (approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | SO status on quote convert | **`Confirmed`** (never Draft) |
| 2 | Quote conversion coverage | **`Partially Converted`** → **`Converted`** when all accepted lines mapped |
| 3 | Cross-module IDs | **`salesOrderId` / `salesOrderLineId` / `salesOrderSectionId` UUIDs** in conversion contracts; `targetRecordId` = `salesOrderId` |
| 4 | Fulfillment model | **`fulfillmentMode`:** `product` \| `service` \| `hybrid` — mode-aware statuses, not product-only |
| 5 | Multiple SOs per quote revision | **Yes** — disjoint line sets; quote stays `Partially Converted` until full |
| 6 | Partial section discount | **No section discount** on partial sections; line discounts only |
| 7 | Fixed bundle fulfillment grain | Fulfill at **parent** line (product mode) |
| 8 | SO revisions | **No** in SO0 |
| 9 | Manual SO sections | Auto **General** + section CRUD (SO1 UI) |

---

## 18. Implementation phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **SO0** | Models, lifecycle constants, fulfillment mode, totals service, permissions, module registration, quote coverage service | **Done** |
| **SO1** | Quote convert service, `POST /from-quote`, link update, agent UI | **Done** |
| **SO2** | Fulfillment events, manual create, line edit, reversals, list stats | Done |
| **SO3** | Split/merge services, invoice allocation schema stub | ✅ Done |
| **SO4** | Manual section CRUD, merge list UI, core module settings | ✅ Done |

---

## 19. Summary

| Question | Answer |
|----------|--------|
| Is SO a Quote clone? | **No.** Operational execution with fulfillment, lineage, and invoice contracts. |
| What is copied from Quote? | Commercial **snapshots** + structure for **accepted** lines/sections only. |
| How are sections handled? | Full accept copies section discounts; partial accept copies structure without section discount. |
| How are bundles handled? | Atomic convert + ID remap; `sourceQuoteLineId` on every line. |
| Revisions? | **No** on SO in SO0. |
| Fulfillment? | Line-level qty fields + optional fulfillment events (SO1). |
| Partial invoicing? | `SalesOrderInvoiceAllocation` contract; roll up to `quantityInvoiced`. |
| Traceability? | Quote → SO → Invoice via stable UUID lineage fields from day one. |

---

## Appendix A — Reference: existing quote touchpoints

| Layer | Files |
|-------|-------|
| Conversion link | `server/models/QuoteConversionLink.js` |
| Conversion metadata | `server/services/quoteConversionService.js` |
| Quote convert stub | `server/controllers/quoteController.js` → `convertQuote` |
| Section breakdown | `buildConversionSectionBreakdown()`, `computeAcceptedSectionIds()` |
| Acceptance | `server/services/quotePublicAcceptanceService.js` |
| Quote lines/sections | `server/models/QuoteLine.js`, `QuoteSection.js` |
| Totals pattern | `server/services/quoteTotalsService.js` |
| UI stub | `client/src/components/record-page/sections/QuoteConversionRecordSection.vue` |

## Appendix B — Traceability field matrix

| Field | Quote | Sales Order | Invoice (future) |
|-------|-------|-------------|------------------|
| Document public id | `quoteNumber` + `revisionNumber` | `salesOrderNumber` | `invoiceNumber` |
| Line public id | `quoteLineId` | `salesOrderLineId` | `invoiceLineId` |
| Section public id | `quoteSectionId` | `salesOrderSectionId` | — |
| Upstream line ref | — | `sourceQuoteLineId` | `sourceSalesOrderLineId` |
| Conversion link | `QuoteConversionLink` | `quoteConversionLinkId` | `sourceSalesOrderId` |
