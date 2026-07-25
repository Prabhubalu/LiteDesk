# Commercial Platform Retrospective

**Purpose:** Freeze the commercial transaction layer (Catalog → Quotes → Sales Orders → Invoices) as a stable platform foundation before **Payments (INV4)** and downstream finance/inventory work.

**Status:** Authoritative snapshot as of **2026-06-02**  
**Audience:** Engineering, product, platform architecture  
**Scope:** C0–C5 · Q0–Q9 · SO0–SO4 · INV0–INV3  

**Source documents:**

| Layer | Architecture | Roadmap |
|-------|--------------|---------|
| Catalog | — | `docs/CATALOG_ROADMAP.md` |
| Quotes | `docs/QUOTE_SECTIONS_ARCHITECTURE.md` | `docs/QUOTES_ROADMAP.md` |
| Sales Orders | `docs/SALES_ORDER_ARCHITECTURE.md` | `docs/SALES_ORDER_ROADMAP.md` |
| Invoices | `docs/INVOICE_ARCHITECTURE.md` | `docs/INVOICE_ROADMAP.md` |

---

## Executive summary

LiteDesk shipped a **four-layer commercial stack** in dependency order:

```text
Catalog (C0–C5)     ItemVariant · price books · bundles · lifecycle
       ↓
Quotes (Q0–Q9)      Snapshot proposal · sections · portal · PDF/email · conversion links
       ↓
Sales Orders (SO0–SO4)  Execution · fulfillment · split/merge · invoice allocation bridge
       ↓
Invoices (INV0–INV3)    Billing · post/void · credit notes · PDF/email · multi-SO merge
       ↓
Payments (INV4+)      NOT STARTED — next phase
```

**Platform bets that held:**

1. **Variant-first catalog** — transactional lines always reference `variantId`, never parent `Item` alone.
2. **Snapshot commercial truth** — price, SKU, tax, bundle structure frozen at line create; upstream catalog changes do not retroactively alter posted commerce.
3. **Stable public UUIDs** — cross-module contracts use `quoteLineId`, `salesOrderLineId`, `invoiceLineId`, `salesOrderInvoiceAllocationId`; Mongo `_id` is internal only.
4. **Server authority** — totals, allocation rollups, and lifecycle transitions enforced in services; UI is a client.
5. **Append-only audit** — activity events and allocation reversals; no hard-delete of commercial history.
6. **Platform modules** — `quotes`, `sales_orders`, `invoices` registered as core platform entities (`appKey: platform`), not Sales-app-only.

**Explicitly not shipped:** Payment capture, GL/revenue recognition, inventory ledger, procurement, tax engine integration, dunning/collections automation.

---

## 1. Catalog (C0–C5)

### 1.1 What shipped

| Phase | Deliverable |
|-------|-------------|
| **C0** | `lifecycle_state` (Draft / Active / Discontinued / Archived); legacy `status` sync; stock-centric list UX removed |
| **C1** | `ItemMedia` gallery; barcode/QR fields; `ItemVariant` scaffold + APIs |
| **C2** | `CatalogCategory` tree; `CatalogAttributeTemplate`; validated `attributeValues` on items |
| **C3** | Parent `Item` + sellable `ItemVariant` split; flat-item migration; default variant per parent |
| **C4** | `CatalogPriceBook` + `CatalogPriceBookEntry`; `catalogPriceResolver` with effective dating |
| **C5** | `ItemBundleComponent`; bundle pricing modes (`fixed` / `rollup`); expand preview API |

**Key server artifacts:** `server/constants/catalogLifecycle.js`, `server/services/catalogPriceResolver.js`, `server/services/catalogBundleService.js`, `/api/catalog/*`, `/api/items/:id/media`, `/api/items/:id/variants`.

**Key client artifacts:** catalog gallery/category UI, settings → Catalog (categories, price books), variant detail, lifecycle badges in Items list.

### 1.2 Architectural decisions

| Decision | Value |
|----------|-------|
| Sellable unit | **`ItemVariant`** — parent `Item` is catalog identity only |
| Lifecycle authority | **`lifecycle_state`** — `isCatalogItemSellable()` ⇒ Active only |
| Pricing authority | **`catalogPriceResolver`** — `{ variantId, priceBookId, quantity, asOfDate }` |
| Bundle structure | **`ItemBundleComponent`** referencing **variant IDs**; pricing mode on bundle variant |
| Legacy compat | `status`, `selling_price`, `item_code` on Item shimmed via default variant during transition |
| Stock fields | Schema retained; **not** catalog concerns — UI/stats de-emphasized |

### 1.3 Migration requirements

Run in order on deploy (idempotent; support `--dry-run`):

| Script | Phase |
|--------|-------|
| `migrateItemLifecycleState.js` | C0 |
| `migrateItemProductImageToGallery.js` | C1 |
| `migrateItemFlatCategories.js` | C2 |
| `migrateFlatItemsToVariants.js` | C3 (**critical**) |
| `migrateVariantPricesToDefaultBook.js` | C4 |

Verification: `npm run verify:catalog` after migrations.

**Tenant note:** Scripts target master URI (`arivu_master` / `MASTER_DB_NAME`). Per-tenant DB deployments must run the same scripts per tenant connection.

### 1.4 Deferred items

- Warehouse / multi-location inventory
- Stock ledger / movement history
- Reservations / allocations (→ Orders/inventory module)
- Batch / lot / serial tracking at fulfillment grain
- Procurement / purchase orders
- Cost accounting beyond list/cost price fields
- CSV import/export refresh for variant model (partially stale)
- Variant-specific custom fields (deferred from C3)
- Deprecation removal of `PATCH /items/:id/stock` (API retained, hidden)

### 1.5 Technical debt

- Dual-write period: `status` + `lifecycle_state`, `product_image` + gallery — new UI uses canonical fields only
- Top-level API shims (`item_code`, `selling_price` on Item) — consumers should read `defaultVariant`
- `linked_invoices` placeholder on Item — superseded by Invoice module
- Deal linking remains on Item parent until fully replaced by quote/SO flows
- Settings → Items status picklist partially legacy (local-only patterns)

### 1.6 Future dependencies

| Consumer | Catalog contract |
|----------|------------------|
| Quotes / SO / Invoice line-add | `variantId` required |
| Unit price | `catalogPriceResolver` + optional price book |
| Sellability gate | `lifecycle_state === 'Active'` |
| Bundle lines | `catalogBundleService` expand + component graph |
| PDF/description | Parent Item name + variant options from snapshots |

### 1.7 Cross-module contracts

```text
QuoteLine.variantId ──► ItemVariant
QuoteLine.priceBookIdSnapshot ──► CatalogPriceBook (at snapshot time)
QuoteLine.bundleSnapshot ──► ItemBundleComponent graph (frozen)
```

Downstream modules **must not** re-resolve catalog for totals after line save.

### 1.8 Known limitations

- No inventory quantity enforcement at catalog layer
- Tax class stored on variant; no live tax engine
- Single default price book seed per org — advanced book strategy is manual
- Bundle cycle detection in C5 — no runtime inventory explosion

### 1.9 Integration points

- **Quotes Q1:** `quotePricingResolutionService` → `catalogPriceResolver`
- **Quotes Q4:** `quoteBundleLineService` → `catalogBundleService`
- **SO manual line-add:** catalog resolve once at line create (same pattern)
- **Settings:** Categories, price books, attribute templates admin UI

---

## 2. Quotes (Q0–Q9)

### 2.1 What shipped

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **Q0** | ✅ Done | `Quote`, `QuoteLine`, lifecycle constants, platform `quotes` module, auto-number `QT-{seq}` |
| **Q1** | 🟡 MVP | Line add with full snapshots via `catalogPriceResolver`; sellability validation |
| **Q2** | 🟡 MVP | `quoteTotalsService`; server-authoritative totals; recalculate API |
| **Q3** | 🟡 MVP | CRUD API, list, record page, lines section, quick create |
| **Q4** | 🟡 MVP | Bundle parent/child lines; fixed/rollup; optional components; drag reorder |
| **Q5** | 🟡 MVP | `POST /revise`; revision timeline; immutable past revisions |
| **Q6** | 🟡 MVP | Submit/approve/reject; `QuoteApproval`; Process Designer + `ApprovalInstance` |
| **Q7** | ✅ Done | Branded PDF (`QuoteDocument`); email send; public share link; draft vs formal send |
| **Q8** | 🟡 Stub | `QuoteConversionLink`; convert eligibility UI; **real SO conversion delegated to SO1** |
| **Q9** | ✅ Done | Portal accept/reject/partial; typed signature; agreement; messages; expiry automation |

**Quote Sections (S1–S4, parallel track):** section-aware totals, partial sections, section discounts — see `docs/QUOTE_SECTIONS_ARCHITECTURE.md`.

**Tests:** `npm run test:quotes` (52+ unit tests); CI on PRs; `npm run smoke:quotes` for live API.

### 2.2 Architectural decisions

| Decision | Value |
|----------|-------|
| Commercial lock | **≥ Sent** — lines commercially immutable; changes via revision or `override_pricing` |
| Variant-first lines | **`variantId` required** — never `itemId` alone |
| Totals authority | **`quoteTotalsService`** only — client never sends authoritative `grandTotal` |
| Revisions | One active revision; historical revisions read-only |
| Conversion traceability | **`QuoteConversionLink`** — no embedded SO/Invoice schema |
| Platform module | `moduleKey: quotes`, `appKey: platform` |
| Tax MVP | `taxSnapshot` JSON on lines — no live tax engine |
| Multi-currency | Header `currency` + `exchangeRateSnapshot`; line snapshots at create |
| Source metadata | `sourceContext` + optional `sourceRef { moduleKey, recordId }` |

### 2.3 Migration requirements

| Script | Purpose |
|--------|---------|
| `migrateQuotesToCoreModule.js` | Platform module registration |
| `migrateQuoteSections.js` | Section model backfill (if upgrading pre-sections data) |
| `migrateQuoteConversionLinkIndex.js` | Drop legacy unique index — allow multiple SO links per quote revision (**required before SO1 in existing deployments**) |

No destructive schema drops — additive migrations only.

### 2.4 Deferred items

- Inventory reservations / stock deduction on accept
- GL / accounting postings
- Payment capture
- Parallel approval workflows / SLA timers
- WhatsApp share channel
- Full tax engine / Avalara
- FX provider integration (snapshot at create only today)
- Multi-layout PDF template designer
- `lineGroupKey` milestone grouping (placeholder only)
- Quote → Invoice direct conversion (never planned — SO is intermediate)

### 2.5 Technical debt

- Q1–Q6 marked **MVP** — edge cases in approval parallelism, revision re-resolve pricing flags
- Portal + formal send policy spread across org settings — multiple code paths to test
- `QuoteConversionLink` index migration easy to miss on older deployments
- Some quote strings synced to locales; not all locales may be complete
- Process Designer triggers for quotes — minimum threshold rules shipped; advanced conditions later

### 2.6 Future dependencies

- **SO1+** consumes `QuoteConversionLink` and accepted line sets
- **Invoice** traceability via `sourceQuoteLineId` denormalized on SO/Invoice lines
- **Payments** — none at quote layer
- **Inventory** — quote accept does not reserve stock

### 2.7 Cross-module contracts

```text
Quote.quoteLineId
  → QuoteConversionLink (sourceQuoteId, sourceRevision, targetModule, targetRecordId)
  → SalesOrderLine.sourceQuoteLineId / sourceQuoteSectionId
  → InvoiceLine.sourceQuoteLineId (denormalized)
```

**Convert eligibility:** `Accepted` | `Partially Accepted` | `Partially Converted` → coverage drives `Converted`.

**Public IDs in links:** `targetRecordId` = **`salesOrderId` UUID** (never Mongo `_id`).

### 2.8 Known limitations

- No quote-side fulfillment or billing
- Expired quote conversion requires override permission
- Partial portal accept creates `Partially Accepted` — SO convert must respect accepted line subset
- Bundle optional components — UI picker MVP; complex bundle edits may need revision
- Record lock on terminal statuses (`Expired`, `Rejected`, `Cancelled`, `Converted`) — must revise to edit

### 2.9 Integration points

- **Catalog:** line-add, bundle expand, sellability
- **Process Designer / ApprovalInstance:** Q6 approval gates
- **Public routes:** `/api/public/quotes/:token/*` — rate-limited portal
- **Email:** `quoteEmailService` + org branding settings
- **PDF:** `quoteDocumentController.renderQuotePdf`
- **SO convert:** `POST /quotes/:id/convert` → `salesOrderConversionService`

---

## 3. Sales Orders (SO0–SO4)

### 3.1 What shipped

| Phase | Deliverable |
|-------|-------------|
| **SO0** | `SalesOrder`, `SalesOrderSection`, `SalesOrderLine`; lifecycle + fulfillment constants; `salesOrderTotalsService`; `quoteConversionCoverageService`; platform module; quote `Partially Converted` status |
| **SO1** | Quote → SO conversion in **`Confirmed`**; `QuoteConversionLink`; coverage rollups; activity; minimal record UI |
| **SO2** | Manual Draft SO create; line CRUD; fulfillment events + reversals; list statistics; fulfillment UI |
| **SO3** | Split / merge services; **`SalesOrderInvoiceAllocation`** model + rollups; invoice readiness API (stub → live) |
| **SO4** | Section CRUD (Draft); merge modal (list bulk action); settings core module parity |

**Key APIs:** `/api/sales-orders/from-quote/:quoteId`, fulfillments, split, merge, sections, lines, `invoice-readiness`, `billing-coverage` (via invoice module).

**Tests:** `npm run test:sales-orders` (47+ tests at SO4 completion).

### 3.2 Architectural decisions

| Decision | Value |
|----------|-------|
| Status on quote convert | **`Confirmed`** — never Draft |
| Quote coverage | **`Partially Converted`** → **`Converted`** when all accepted lines mapped |
| Cross-module IDs | `salesOrderId`, `salesOrderLineId`, `salesOrderSectionId` UUIDs |
| No SO revisions (SO0–SO4) | Corrections via cancel, split, merge — not revision tree |
| Snapshot copy | Commercial fields copied once from quote; no live quote reads for totals |
| Fulfillment model | `fulfillmentMode`: product / service / hybrid |
| Partial section discount | **No section discount** on partial sections |
| Invoice bridge | **`SalesOrderInvoiceAllocation`** — schema live SO3; post/reverse implemented INV0 |
| Default bill-on | **`fulfill`** — billable = fulfilled − cancelled − invoiced |

### 3.3 Migration requirements

| Script | Purpose |
|--------|---------|
| `migrateSalesOrdersToCoreModule.js` | Platform `sales_orders` module registration |
| `migrateQuoteConversionLinkIndex.js` | Multiple conversion links per quote revision (**shared with Quotes**) |
| `migrateSalesOrderLineSourceIndex.js` | Per-SO `sourceQuoteLineId` uniqueness (split/merge lineage) |

Run `migrateSalesOrdersToCoreModule.js` on each environment before SO UI/settings.

### 3.4 Deferred items

- SO revision / amendment flows
- Inventory reservations / pick-pack-ship ledger
- GL postings on fulfillment
- Automated invoice generation on fulfill (policy engine)
- Section-level fulfill rollup flags (architecture mentions future org policy)
- Warehouse / multi-location fulfillment
- Cost of goods / COGS

### 3.5 Technical debt

- Fulfillment events collection — compensating reversals implemented; no full event-sourcing UI at scale
- Merge UI on list only — no record-page merge entry
- Invoice readiness was stub through SO3 — fully wired INV1
- Manual SO line-add re-resolves catalog once — parity with quote pricing overrides incomplete vs `override_pricing`
- Settings module parity added SO4 — some field metadata gaps vs Quotes depth

### 3.6 Future dependencies

- **INV0+** posts to `SalesOrderInvoiceAllocation`; updates `quantityInvoiced`, `invoiceStatus`, `invoicedAmount`
- **Inventory module** will consume fulfillment qty — not SO's job today
- **Payments** — no SO payment fields

### 3.7 Cross-module contracts

```text
SalesOrderLine.sourceQuoteLineId ──► Quote.quoteLineId
SalesOrderInvoiceAllocation ──► { salesOrderLineId, invoiceId, invoiceLineId, quantityAllocated, status }
  status: active | reversed
  allocationType: standard | progress | milestone | deposit | credit_reversal (added INV3)
```

**Rollups on SO header:** `invoiceStatus`, `invoicedAmount`, `remainingBillableAmount` — updated only by allocation service.

### 3.8 Known limitations

- No public customer portal for SO
- Split/merge requires compatible lineage and permissions (`sales_orders.merge`)
- Cancelled SO lines excluded from billable base; partial cancel semantics manual
- Bundle fulfillment grain follows parent — component hidden lines on invoice by default
- Multi-SO invoice requires matching account, contact, currency (enforced INV3)

### 3.9 Integration points

- **Quote convert:** `salesOrderConversionService` + `quoteConversionCoverageService`
- **Invoice convert:** `invoiceConversionService`, `invoiceMultiSoConversionService`
- **Invoice readiness UI:** `SalesOrderInvoiceReadinessRecordSection`, `SalesOrderBillingCoverageRecordSection`
- **Activity:** `salesOrderActivityService` mirrors invoice events (`sales_order_invoiced`, `sales_order_invoice_credited`, etc.)
- **List bulk:** Merge orders; **Combined invoice** (INV3) opens multi-SO wizard

---

## 4. Invoices (INV0–INV3)

### 4.1 What shipped

| Phase | Deliverable |
|-------|-------------|
| **INV0** | `Invoice`, `InvoiceSection`, `InvoiceLine`; lifecycle constants; `invoiceTotalsService`; `postInvoiceAllocations` / `reverseInvoiceAllocations`; platform module; `POST /post` |
| **INV1** | SO → Invoice conversion; Void + allocation reverse; billing coverage API; readiness UI; create-invoice modal |
| **INV2** | Full CRUD; section/line CRUD (Draft); approval workflow (submit/approve/reject); list + record UI; activity + i18n |
| **INV3** | **Credit notes** (`invoiceType: credit_note`); **PDF** (`InvoiceDocument`); **email** send/resend; **multi-SO wizard** (`sourceType: merge`) |

**Key services:** `invoiceConversionService`, `invoiceCreditNoteService`, `invoicePostService`, `invoiceVoidService`, `invoiceWorkflowService`, `invoiceDocumentController`, `invoiceEmailService`, `invoiceMultiSoConversionService`, `salesOrderInvoiceAllocationService`.

**Tests:** `npm run test:invoices` (29+ tests at INV3 completion).

### 4.2 Architectural decisions

| Decision | Value |
|----------|-------|
| Default bill-on | **`fulfill`** — aligns with SO `DEFAULT_BILL_ON` |
| Multiple invoices per SO | **Yes** — until `fully_invoiced` |
| Partial line invoicing | **Yes** — multiple allocations per SO line |
| Allocation authority | **`SalesOrderInvoiceAllocation`** — written **only on Post**, not Draft |
| Posted commercial lock | Immutable qty/pricing/discounts/taxes/sections/lines |
| Corrections | Credit note, Void, Write-off (future), Payments (future) — **not** Posted edits |
| Credit notes | Separate **`invoiceType: credit_note`** document; `sourceInvoiceId` lineage |
| Partial credit | `credit_reversal` allocation rows; `quantityCredited` on source lines |
| Cross-module IDs | `invoiceId`, `invoiceLineId`, `salesOrderInvoiceAllocationId` |
| Partially Posted | **Reserved** — enum only; no transitions INV0–INV3 |
| Source metadata | `sourceContext` + `sourceRef { moduleKey, recordId }` |
| Manual invoices | Allowed — no SO allocation rows |
| Multi-SO invoice | Same `organizationRefId`, `contactId`, `currency` |
| PDF/email branding | Reuses quote org branding via `invoiceBrandingService` |

### 4.3 Migration requirements

| Script | Purpose |
|--------|---------|
| `migrateInvoicesToCoreModule.js` | Platform `invoices` module registration — **required on deploy** |

No line-level backfill required for greenfield. Existing SOs gain invoice capabilities once module migration runs.

### 4.4 Deferred items

| Item | Status |
|------|--------|
| **Payment capture** | Schema-ready fields (`amountPaid`, `amountDue`, `paymentStatus`) — **INV4 next** |
| **GL / revenue recognition** | `Partially Posted` reserved for future |
| **Write-offs** | Schema-ready (`writeOffTotal`, `InvoiceWriteOff` planned) — not implemented |
| **Tax engine** | Snapshot copy only; no Avalara/service |
| **Proforma invoices** | `invoiceType: proforma` in enum — not implemented |
| **Debit notes** | Enum only |
| **Customer portal pay** | Out of scope |
| **Dunning / collections** | Out of scope |
| **Invoice amendments** | No revision tree — credit note + re-invoice |
| **Void credit notes** | Blocked in current release |
| **Payment reversal before void** | Required when `amountPaid > 0` — payments not live yet |
| **Idempotency key on Post** | Documented future |
| **Multi-warehouse / multi-entity billing** | Out of scope |

### 4.5 Technical debt

- **`Partially Posted`** in lifecycle enum without implementation — must not expose in UI transitions until GL phase
- Credit note void not supported — operational workaround: additional credit adjustments manual policy
- PDF/email reuse quote branding — no invoice-specific branding settings screen (inherits org quote settings)
- `moduleController` invoice registration less exhaustive than `sales_orders` in some platform query paths (core paths wired INV2)
- Multi-SO wizard entry only from SO list bulk action — no invoice-list entry point
- Approval workflow mirrors quotes MVP — no parallel approver chains
- Manual invoice lines — catalog resolve on add; less mature than quote line editor
+ Manual invoice / SO draft Lines — shared Quote Lines workspace via `commercialLines` adapters (INV/SO commercial draft APIs)

### 4.6 Future dependencies (INV4+)

**Payment module must:**

1. Implement `Payment` + `PaymentAllocation` without mutating Posted commercial snapshots
2. Roll up `Invoice.amountPaid`, reduce `amountDue`, transition `paymentStatus`
3. Emit `payment_applied` / `payment_reversed` activity (hooks reserved on invoice)
4. Block invoice Void when `amountPaid > 0` until payment reversed
5. Respect header-level apply default; optional line-level apply per architecture §13

**GL module (later):** may consume `Partially Posted` reserved state — **do not implement until dedicated phase**.

### 4.7 Cross-module contracts

**Full lineage (locked):**

```text
Quote.quoteLineId
  → SalesOrderLine.sourceQuoteLineId
    → SalesOrderInvoiceAllocation.salesOrderLineId
      → InvoiceLine.sourceSalesOrderLineId
        → InvoiceLine.sourceInvoiceLineId (credit notes)
          → PaymentAllocation.invoiceLineId (future)
```

**Allocation lifecycle:**

| Event | SO effect | Allocation row |
|-------|-----------|----------------|
| Invoice Post | `quantityInvoiced` ↑ | `status: active`, `allocationType: standard` |
| Invoice Void | `quantityInvoiced` ↓ | all active → `reversed` |
| Credit note Post | `quantityInvoiced` ↓ | new `credit_reversal` row; source line `quantityCredited` ↑ |
| Source invoice | `amountDue` ↓ by credited amount | — |

**API surface (stable):**

| Route | Purpose |
|-------|---------|
| `POST /api/invoices/from-sales-order/:salesOrderId` | Single SO conversion |
| `POST /api/invoices/from-sales-orders` | Multi-SO merge |
| `POST /api/invoices/from-invoice/:invoiceId/credit-note` | Credit note create |
| `POST /api/invoices/:id/post` | Post (allocations) |
| `POST /api/invoices/:id/void` | Void (full reversal) |
| `GET /api/invoices/:id/credit-summary` | Credit traceability |
| `POST /api/invoices/:id/documents/generate` | PDF |
| `POST /api/invoices/:id/send-email` | Email / resend |

### 4.8 Known limitations

- No payment recording — `amountDue` only reduced by credit notes and void semantics
- Write-off permission exists in constants — no write-off service
- Tax is presentation-only snapshot — no jurisdictional engine
- Credit note cannot be voided — create offsetting entries manually if needed
- Invoice PDF watermark: DRAFT/VOID for non-final statuses
- Email requires org email integration configured (same as quotes)
- `Partially Paid` / `Paid` statuses exist in lifecycle — **transitions depend on Payment module**
- Bundle invoice lines: parent grain default; components `hiddenLine: true`

### 4.9 Integration points

- **SO billing coverage:** `GET /api/sales-orders/:id/billing-coverage`
- **SO readiness:** `GET /api/sales-orders/:id/invoice-readiness`
- **Activity (both modules):** `invoiceActivityService`, `salesOrderActivityService` mirrored events
- **Client record sections:** lines, credits, billing coverage, workflow header actions, PDF/email drawer
- **Permissions:** `invoices.createCreditNote`, `invoices.export`, `invoices.post`, `invoices.void`, etc.

---

## 5. Platform-wide synthesis

### 5.1 Cross-module contracts (master reference)

| Contract | Rule |
|----------|------|
| **Tenant isolation** | Every query filtered by `organizationId` |
| **Public IDs** | UUIDs in APIs, links, activity, conversion — not Mongo `_id` |
| **Snapshot immutability** | After commercial lock (Quote ≥ Sent, Invoice Posted), change via revision/credit note/void — not edit |
| **Totals authority** | `*TotalsService` on server for Quote, SO, Invoice |
| **Section totals** | Three-tier: line → section → header |
| **Bundle grain** | Parent line billable; components hidden on invoice by default |
| **Allocation bridge** | Single collection: `SalesOrderInvoiceAllocation` |
| **Activity** | Append-only `RecordActivity` per module |
| **Platform modules** | `items`, `quotes`, `sales_orders`, `invoices` — core platform entities |

### 5.2 Integration map

```text
                    ┌─────────────────┐
                    │  catalogPrice   │
                    │  Resolver       │
                    └────────┬────────┘
                             │ once at line-add
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
 quoteTotalsService   salesOrderTotalsService   invoiceTotalsService
     │                       │                       │
     ▼                       ▼                       ▼
  Quote ──convert──► SalesOrder ──invoice──► Invoice ──credit──► Credit Note
     │                       │                       │
     │                  fulfillment              PDF / email
     │                       │                       │
     └──── QuoteConversionLink ──── SalesOrderInvoiceAllocation ────┘
```

### 5.3 Deployment migration checklist (ordered)

Run on each environment before enabling commercial features:

```bash
# Catalog (if not already applied)
node server/scripts/migrateItemLifecycleState.js
node server/scripts/migrateItemProductImageToGallery.js
node server/scripts/migrateItemFlatCategories.js
node server/scripts/migrateFlatItemsToVariants.js
node server/scripts/migrateVariantPricesToDefaultBook.js

# Quotes / SO
node server/scripts/migrateQuotesToCoreModule.js
node server/scripts/migrateQuoteSections.js          # if upgrading legacy quotes
node server/scripts/migrateQuoteConversionLinkIndex.js
node server/scripts/migrateSalesOrdersToCoreModule.js
node server/scripts/migrateSalesOrderLineSourceIndex.js

# Invoices
node server/scripts/migrateInvoicesToCoreModule.js
```

Verify:

```bash
cd server && npm run verify:catalog
cd server && npm run test:quotes
cd server && npm run test:sales-orders
cd server && npm run test:invoices
```

### 5.4 Technical debt register (cross-cutting)

| ID | Area | Description | Risk | Before Payments |
|----|------|-------------|------|-----------------|
| TD-01 | Catalog | Legacy `status` / flat item shims | Medium | Document-only; remove shims in major version |
| TD-02 | Quotes | Q1–Q6 MVP depth | Low | Harden edge cases as needed |
| TD-03 | Quotes | Conversion link index migration | **High** if skipped | Verify index dropped in prod |
| TD-04 | SO | No inventory reservation | **High** for inventory phase | Expected — document dependency |
| TD-05 | Invoice | `Partially Posted` enum without logic | Medium | Hide from UI; implement with GL or remove |
| TD-06 | Invoice | Credit note void unsupported | Medium | Policy + future service |
| TD-07 | Platform | Tax snapshot only | **High** for tax compliance | Payment phase may expose gap |
| TD-08 | Branding | Invoice PDF/email uses quote settings | Low | Accept or split settings |
| TD-09 | moduleController | Partial invoice platform registration | Low | Complete parity if settings gaps found |

### 5.5 Known platform limitations (frozen)

1. **No financial ledger** — balances on invoice are receivable tracking only until Payments + GL
2. **No inventory** — fulfillment records qty events but does not move stock
3. **No tax engine** — manual/tax JSON snapshots only
4. **No document revision on Invoice/SO** — use credit notes or cancel/split/merge
5. **Single currency per merged invoice** — no FX conversion on multi-SO merge
6. **Bill-on-fulfill default** — org override permission exists but policy UI limited
7. **Email/PDF** — Quotes and Invoices only; SO has no customer-facing PDF
8. **Portal** — Quote portal only; no invoice payment portal

### 5.6 Future dependencies for Payments (INV4)

Payments **must** treat this stack as frozen:

| Dependency | Requirement |
|------------|-------------|
| Posted invoice immutability | Payments adjust `amountDue` only — never line snapshots |
| `SalesOrderInvoiceAllocation` | Unchanged by payments — billing truth already fixed at Post |
| Credit notes | Reduce receivable before payment; payment applies to net `amountDue` |
| Activity | New events must not mutate historical invoice/SO activity |
| Permissions | Separate `payments.*` module — do not overload `invoices.edit` |
| Void rules | Payment reversal required before invoice void when paid |
| Multi-invoice payment | Architecture reserves multi-row `PaymentAllocation` |

Recommended INV4 scope (from `INVOICE_ROADMAP.md`):

- `PaymentAllocation` schema + rollups on `Invoice.amountPaid`, `amountDue`, `paymentStatus`
- Event hooks: `payment_applied`, `payment_reversed`
- No GL posting in INV4 — payment capture only

### 5.7 What NOT to change without architecture review

- Cross-module UUID contracts and lineage field names
- `SalesOrderInvoiceAllocation` as the sole billing bridge
- Post-time allocation write semantics
- Posted commercial lock on invoices
- Credit note as separate document type (not negative Posted edit)
- Server-side totals authority pattern
- Variant-first catalog line references

---

## 6. Document control

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-06-02 | Platform engineering | Initial freeze before INV4 / Payments |

**Next document to update after Payments ships:** add §7 Payments (P0–Pn) or extend this retrospective with a Payments section; do not rewrite historical C0–INV3 facts — append amendments.

**Related next steps:**

1. Implement **INV4 Payment readiness** per `docs/INVOICE_ROADMAP.md`
2. Update `docs/INVOICE_ARCHITECTURE.md` §20 out-of-scope list (PDF/email now shipped INV3)
3. Consider **`COMMERCIAL_PLATFORM_OPERATIONS.md`** for runbook-style migration verification per tenant
